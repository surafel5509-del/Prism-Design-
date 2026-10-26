import { z } from 'zod';
import { ensureUserId, jsonError } from '@/lib/server/session';
import { listCloudProjects, saveCloudProject, getCloudProject, deleteCloudProject, audit } from '@/lib/server/store';
import type { Project } from '@/lib/engine/types';
import { normalizeLayer } from '@/lib/engine/ops';
import { rateLimit } from '@/lib/server/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const userId = ensureUserId();
  const id = new URL(req.url).searchParams.get('id');
  if (id) {
    const project = await getCloudProject(userId, id);
    if (!project) return jsonError('Project not found', 404, { code: 'not_found' });
    return Response.json({ project });
  }
  const projects = await listCloudProjects(userId);
  return Response.json({
    projects: projects.map((p) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, width: p.width, height: p.height, duration: p.duration, thumbnail: p.thumbnail, folderId: p.folderId, tags: p.tags })),
  });
}

const SaveSchema = z.object({
  project: z.object({
    id: z.string().min(1).max(80), name: z.string().min(1).max(120),
    width: z.number().min(64).max(7680), height: z.number().min(64).max(7680),
    duration: z.number().min(0.5).max(600), fps: z.number().min(6).max(60).optional(),
    thumbnail: z.string().max(2_000_000).nullable().optional(),
    folderId: z.string().max(80).nullable().optional(),
    tags: z.array(z.string().max(40)).max(12).optional(),
    layers: z.array(z.unknown()).max(400),
  }).passthrough(),
});

export async function POST(req: Request) {
  const userId = ensureUserId();
  if (!rateLimit(`save:${userId}`, 120, 60_000).ok) return jsonError('Autosave throttled — retrying shortly.', 429, { code: 'rate_limited' });
  const parsed = SaveSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid project payload', 400, { code: 'bad_request' });
  const p = parsed.data.project as unknown as Project;
  const doc: Project = {
    ...p,
    layers: (p.layers ?? []).map((l) => normalizeLayer(l as never)),
    updatedAt: Date.now(),
  };
  const record = await saveCloudProject(userId, {
    id: doc.id, name: doc.name, updatedAt: doc.updatedAt, width: doc.width, height: doc.height,
    duration: doc.duration, thumbnail: doc.thumbnail ?? null, data: doc,
    folderId: doc.folderId ?? null, tags: doc.tags ?? [],
  });
  return Response.json({ ok: true, id: record.id, updatedAt: record.updatedAt });
}

export async function DELETE(req: Request) {
  const userId = ensureUserId();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return jsonError('id required', 400, { code: 'bad_request' });
  await deleteCloudProject(userId, id);
  await audit(userId, 'project.delete', id);
  return Response.json({ ok: true });
}

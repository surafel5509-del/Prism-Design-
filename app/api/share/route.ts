import { z } from 'zod';
import { nanoid } from 'nanoid';
import { ensureUserId, jsonError } from '@/lib/server/session';
import { getShare, putShare, audit } from '@/lib/server/store';
import { normalizeLayer } from '@/lib/engine/ops';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Schema = z.object({
  projectId: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  data: z.object({ layers: z.array(z.unknown()).max(400) }).passthrough(),
  allowComments: z.boolean().optional(),
  existingId: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  const userId = ensureUserId();
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid share payload', 400, { code: 'bad_request' });
  const { projectId, name, data, allowComments, existingId } = parsed.data;

  const doc = { ...data, layers: (data.layers as never[]).map((l) => normalizeLayer(l)) };

  if (existingId) {
    const found = await getShare(existingId);
    if (found && (!found.ownerId || found.ownerId === userId)) {
      found.name = name; found.data = doc; found.allowComments = allowComments ?? found.allowComments; found.updatedAt = Date.now();
      await putShare(found);
      return Response.json({ id: found.id, url: `/s/${found.id}`, updated: true });
    }
  }

  const id = nanoid(10);
  await putShare({
    id, projectId, ownerId: userId, name, data: doc, createdAt: Date.now(), updatedAt: Date.now(),
    allowComments: allowComments ?? true, comments: [],
  });
  await audit(userId, 'share.create', `${projectId} → ${id}`);
  return Response.json({ id, url: `/s/${id}`, created: true });
}

export async function GET() {
  const userId = ensureUserId();
  return Response.json({ userId, ready: true });
}

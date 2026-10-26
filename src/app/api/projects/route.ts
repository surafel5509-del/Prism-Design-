import { NextRequest } from "next/server";
import { mutateDb, readDb } from "@/lib/db";
import type { PrismProject } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Project persistence (local file store in dev; swap db.ts for Postgres in prod). */

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const db = readDb();
  if (id) {
    const project = db.projects.find((p) => p.id === id);
    return project ? Response.json({ project }) : Response.json({ error: "Not found" }, { status: 404 });
  }
  const summaries = [...db.projects]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((p) => ({
      id: p.id, name: p.name, width: p.width, height: p.height, duration: p.duration,
      background: p.background, layerCount: p.layers.length, updatedAt: p.updatedAt, createdAt: p.createdAt,
      accent: p.brandKit?.colors?.[0] ?? "#7c3aed",
      headline: p.layers.find((l) => l.type === "text")?.text?.split("\n")[0]?.slice(0, 42) ?? "",
    }));
  return Response.json({ projects: summaries });
}

export async function POST(req: NextRequest) {
  const { project } = (await req.json()) as { project: PrismProject };
  if (!project?.id) return Response.json({ error: "project.id required" }, { status: 400 });
  mutateDb((db) => {
    db.projects = [...db.projects.filter((p) => p.id !== project.id), { ...project, updatedAt: new Date().toISOString() }];
  });
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  mutateDb((db) => { db.projects = db.projects.filter((p) => p.id !== id); });
  return Response.json({ ok: true });
}

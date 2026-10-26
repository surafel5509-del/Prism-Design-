'use client';
import { idbAll, idbDelete, idbPut } from './idb';
import type { Project } from '@/lib/engine/types';
import { uid } from '@/lib/utils';

/** Real version history: full document snapshots in IndexedDB, throttled and trimmed. */
export interface VersionSnapshot {
  vid: string;
  projectId: string;
  at: number;
  label: string;
  layers: number;
  keyframes: number;
  project: Project;
}

const MAX_VERSIONS = 10;
const MIN_GAP_MS = 45_000;
const lastWrite = new Map<string, number>();

export function countKeyframes(project: Project) {
  return project.layers.reduce((n, l) => n + Object.values(l.keyframes ?? {}).reduce((m, list) => m + (list?.length ?? 0), 0), 0);
}

export async function recordVersion(project: Project, label = 'Autosave', opts: { force?: boolean } = {}): Promise<boolean> {
  const previous = lastWrite.get(project.id) ?? 0;
  if (!opts.force && Date.now() - previous < MIN_GAP_MS) return false;
  lastWrite.set(project.id, Date.now());
  const snapshot: VersionSnapshot = {
    vid: uid('ver'),
    projectId: project.id,
    at: Date.now(),
    label,
    layers: project.layers.length,
    keyframes: countKeyframes(project),
    project,
  };
  await idbPut('versions', snapshot);
  await trim(project.id);
  return true;
}

async function trim(projectId: string) {
  const all = (await idbAll<VersionSnapshot>('versions')).filter((v) => v.projectId === projectId).sort((a, b) => b.at - a.at);
  for (const stale of all.slice(MAX_VERSIONS)) await idbDelete('versions', stale.vid);
}

export async function listVersions(projectId: string): Promise<VersionSnapshot[]> {
  return (await idbAll<VersionSnapshot>('versions'))
    .filter((v) => v.projectId === projectId && v.project && Array.isArray(v.project.layers))
    .sort((a, b) => b.at - a.at);
}

export async function clearVersions(projectId: string) {
  const all = await listVersions(projectId);
  for (const v of all) await idbDelete('versions', v.vid);
  lastWrite.delete(projectId);
}

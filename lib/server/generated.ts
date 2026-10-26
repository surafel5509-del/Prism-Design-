import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

const DIR = path.join(process.cwd(), '.data', 'generated');

/** Persist a data: URL produced by an image/speech model and return a stable web path. */
export async function saveGenerated(dataUrl: string, extHint?: string): Promise<{ url: string; bytes: number }> {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error('Unsupported asset payload (expected a data URL)');
  const mime = m[1] ?? 'application/octet-stream';
  const isB64 = Boolean(m[2]);
  const raw = isB64 ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
  const ext = extHint ?? ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg', 'video/mp4': 'mp4' } as Record<string, string>)[mime] ?? 'bin';
  await fs.mkdir(DIR, { recursive: true });
  const name = `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}.${ext}`;
  await fs.writeFile(path.join(DIR, name), raw);
  return { url: `/api/assets/${name}`, bytes: raw.byteLength };
}

export function generatedDir() { return DIR; }

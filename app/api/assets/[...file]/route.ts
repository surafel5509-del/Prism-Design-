import { promises as fs } from 'node:fs';
import path from 'node:path';
import { generatedDir } from '@/lib/server/generated';

const TYPES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
  svg: 'image/svg+xml', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', mp4: 'video/mp4', webm: 'video/webm', json: 'application/json',
};

export async function GET(_req: Request, { params }: { params: { file: string[] } }) {
  const name = params.file.join('/');
  if (name.includes('..') || name.startsWith('/')) return new Response('Bad request', { status: 400 });
  const file = path.join(generatedDir(), name);
  try {
    const buf = await fs.readFile(file);
    const ext = path.extname(name).slice(1).toLowerCase();
    return new Response(buf, {
      headers: {
        'content-type': TYPES[ext] ?? 'application/octet-stream',
        'cache-control': 'public, max-age=31536000, immutable',
        'content-length': String(buf.byteLength),
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

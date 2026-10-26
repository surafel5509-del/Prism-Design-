import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';

function secret(): string {
  const s = process.env.PRISM_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (s && s.length >= 16) return s;
  // Dev fallback: derived from machine + project, still never leaves the server.
  return `prism-dev-secret-${process.env.NODE_ENV ?? 'development'}-do-not-use-in-production`;
}

function key(): Buffer {
  return crypto.createHash('sha256').update(secret()).digest();
}

export interface EncryptedBox { v: 1; iv: string; tag: string; data: string }

export function encryptSecret(plain: string): EncryptedBox {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return { v: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: enc.toString('base64') };
}

export function decryptSecret(box: EncryptedBox | string | null | undefined): string | null {
  if (!box) return null;
  try {
    const b = typeof box === 'string' ? (JSON.parse(box) as EncryptedBox) : box;
    const decipher = crypto.createDecipheriv(ALGO, key(), Buffer.from(b.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(b.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(b.data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function maskKey(key: string | null | undefined): string {
  if (!key) return '';
  const clean = key.trim();
  if (clean.length <= 8) return '••••••••';
  return `${clean.slice(0, 3)}…${clean.slice(-4)}`;
}

export function fingerprint(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 12);
}

import fs from 'node:fs/promises';
import path from 'node:path';
import type { EncryptedBox } from './crypto';

export interface StoredProvider {
  provider: string;
  key?: EncryptedBox;
  baseUrl?: string;
  connected: boolean;
  status: 'connected' | 'error' | 'unconfigured';
  message?: string;
  lastChecked?: number;
  defaultModel?: string;
  models?: { id: string; name: string }[];
}

export interface AISettings {
  defaultProvider: string;
  defaultModel: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  reasoningEffort: 'low' | 'medium' | 'high';
  defaultMode: 'agent' | 'thinking' | 'fast';
  streaming: boolean;
  toolCalling: boolean;
  requireApproval: boolean;
  systemPromptExtra: string;
  fallbackEnabled: boolean;
  fallbackProvider?: string;
  fallbackModel?: string;
  taskProviders: Record<string, { provider: string; model: string }>;
}

export interface UsageEntry {
  id: string; at: number; provider: string; model: string; tokensIn: number; tokensOut: number; cost: number; runId?: string; kind: 'chat' | 'image' | 'speech' | 'vision' | 'copy';
}

export interface RunRecord {
  id: string; at: number; prompt: string; provider: string; model: string; status: string; toolCalls: number; steps: number;
  tokensIn: number; tokensOut: number; cost: number; durationMs: number; error?: string;
  ops?: unknown[];
  plan?: unknown;
}

export interface ProjectRecord {
  id: string; name: string; updatedAt: number; width: number; height: number; duration: number; thumbnail?: string | null;
  data: unknown; folderId?: string | null; tags?: string[];
}

export interface ShareRecord { id: string; projectId: string; ownerId?: string; name: string; data: unknown; createdAt: number; updatedAt?: number; allowComments: boolean; revoked?: boolean; comments: { id: string; author: string; text: string; at: number; t?: number }[] }

export interface UserRecord {
  id: string; email?: string; name?: string; avatar?: string; createdAt: number; role: 'owner' | 'editor' | 'viewer';
  providers: Record<string, StoredProvider>;
  settings: AISettings;
  usage: UsageEntry[];
  runs: RunRecord[];
  projects: Record<string, ProjectRecord>;
}

export interface DBShape { version: number; users: Record<string, UserRecord>; shares: Record<string, ShareRecord>; audit: { at: number; userId: string; action: string; detail?: string }[] }

export const DEFAULT_SETTINGS: AISettings = {
  defaultProvider: 'openai',
  defaultModel: 'gpt-4.1',
  temperature: 0.7,
  topP: 1,
  maxTokens: 4096,
  reasoningEffort: 'medium',
  defaultMode: 'agent',
  streaming: true,
  toolCalling: true,
  requireApproval: false,
  systemPromptExtra: '',
  fallbackEnabled: true,
  fallbackProvider: 'anthropic',
  fallbackModel: 'claude-sonnet-4-20250514',
  taskProviders: {
    textToMotion: { provider: 'openai', model: 'gpt-4.1' },
    textToDesign: { provider: 'openai', model: 'gpt-4.1' },
    imageGen: { provider: 'openai', model: 'gpt-image-1' },
    vision: { provider: 'openai', model: 'gpt-4.1' },
    speech: { provider: 'openai', model: 'tts-1' },
    music: { provider: 'local', model: 'procedural' },
  },
};

const DATA_DIR = process.env.PRISM_DATA_DIR || path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'prism-store.json');
const EMPTY: DBShape = { version: 1, users: {}, shares: {}, audit: [] };

let cache: DBShape | null = null;
let writing: Promise<void> | null = null;

// Optional Postgres backend (single JSONB row per user) — enabled with DATABASE_URL.
type PgClient = { query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };
let pg: PgClient | null = null;
let pgTried = false;

async function pgClient(): Promise<PgClient | null> {
  if (pgTried) return pg;
  pgTried = true;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  try {
    const mod = (await import('pg')) as unknown as { default: { Pool: new (o: { connectionString: string; ssl?: boolean | { rejectUnauthorized: boolean } }) => PgClient } };
    pg = new mod.default.Pool({ connectionString: url, ssl: url.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined });
    await pg.query(`CREATE TABLE IF NOT EXISTS prism_users (id text primary key, data jsonb not null, updated_at timestamptz default now())`);
  } catch (err) {
    console.warn('[prism] Postgres unavailable, using file store:', err instanceof Error ? err.message : err);
    pg = null;
  }
  return pg;
}

async function readFileDb(): Promise<DBShape> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as DBShape;
    return { ...EMPTY, ...parsed, users: parsed.users ?? {} };
  } catch {
    return { ...EMPTY, users: {} };
  }
}

async function writeFileDb(db: DBShape) {
  if (writing) await writing;
  writing = (async () => {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const tmp = `${DATA_FILE}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(db), 'utf8');
      await fs.rename(tmp, DATA_FILE);
    } catch (err) {
      console.warn('[prism] failed to persist store', err);
    } finally {
      writing = null;
    }
  })();
  await writing;
}

export async function getDb(): Promise<DBShape> {
  if (cache) return cache;
  cache = await readFileDb();
  return cache;
}

export async function saveDb(db: DBShape) {
  cache = db;
  await writeFileDb(db);
}

export async function getUser(userId: string): Promise<UserRecord> {
  const client = await pgClient();
  if (client) {
    try {
      const res = await client.query('SELECT data FROM prism_users WHERE id = $1', [userId]);
      if (res.rows[0]?.data) {
        const u = res.rows[0].data as UserRecord;
        return { ...u, settings: { ...DEFAULT_SETTINGS, ...u.settings }, providers: u.providers ?? {}, usage: u.usage ?? [], runs: u.runs ?? [], projects: u.projects ?? {} };
      }
      const fresh = newUser(userId);
      await client.query('INSERT INTO prism_users (id, data) VALUES ($1, $2)', [userId, JSON.stringify(fresh)]);
      return fresh;
    } catch (err) {
      console.warn('[prism] postgres getUser failed, falling back', err);
    }
  }
  const db = await getDb();
  if (!db.users[userId]) {
    db.users[userId] = newUser(userId);
    await saveDb(db);
  }
  const u = db.users[userId];
  return { ...u, settings: { ...DEFAULT_SETTINGS, ...u.settings }, providers: u.providers ?? {}, usage: u.usage ?? [], runs: u.runs ?? [], projects: u.projects ?? {} };
}

export async function saveUser(user: UserRecord): Promise<void> {
  const client = await pgClient();
  if (client) {
    try {
      await client.query('INSERT INTO prism_users (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = now()', [user.id, JSON.stringify(user)]);
      return;
    } catch (err) {
      console.warn('[prism] postgres saveUser failed, falling back', err);
    }
  }
  const db = await getDb();
  db.users[user.id] = user;
  await saveDb(db);
}

export function newUser(id: string): UserRecord {
  return { id, createdAt: Date.now(), role: 'owner', providers: {}, settings: { ...DEFAULT_SETTINGS }, usage: [], runs: [], projects: {} };
}

export async function getShare(id: string): Promise<ShareRecord | null> {
  const db = await getDb();
  return db.shares[id] ?? null;
}

export async function putShare(share: ShareRecord) {
  const db = await getDb();
  db.shares[share.id] = share;
  await saveDb(db);
}

export async function audit(userId: string, action: string, detail?: string) {
  try {
    const db = await getDb();
    db.audit = [{ at: Date.now(), userId, action, detail }, ...db.audit].slice(0, 500);
    await saveDb(db);
  } catch { /* non-fatal */ }
}

// ── Cloud projects ──────────────────────────────────────────────────────────
export async function listCloudProjects(userId: string): Promise<ProjectRecord[]> {
  const user = await getUser(userId);
  return Object.values(user.projects ?? {}).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getCloudProject(userId: string, id: string): Promise<ProjectRecord | null> {
  const user = await getUser(userId);
  return user.projects?.[id] ?? null;
}

export async function saveCloudProject(userId: string, project: ProjectRecord): Promise<ProjectRecord> {
  const user = await getUser(userId);
  user.projects = { ...(user.projects ?? {}), [project.id]: project };
  // keep the last 60 projects per user
  const entries = Object.entries(user.projects).sort((a, b) => b[1].updatedAt - a[1].updatedAt);
  if (entries.length > 60) user.projects = Object.fromEntries(entries.slice(0, 60));
  await saveUser(user);
  return project;
}

export async function deleteCloudProject(userId: string, id: string): Promise<void> {
  const user = await getUser(userId);
  if (user.projects?.[id]) {
    delete user.projects[id];
    await saveUser(user);
  }
}

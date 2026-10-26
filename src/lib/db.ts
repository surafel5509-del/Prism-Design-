import fs from "node:fs";
import path from "node:path";
import type { ProviderId, PrismProject } from "./types";

/**
 * Zero-setup local store for development/self-hosting.
 * Persists to `data/prism-db.json` (gitignored). Provider keys are stored
 * ONLY as AES-256-GCM ciphertext (see crypto.ts).
 *
 * For production multi-user deployments, swap this module for Postgres —
 * the schema is provided in `prisma/schema.prisma` and
 * `supabase/migrations/0001_prism.sql`. The function signatures here are the
 * repository interface to re-implement.
 */

export interface StoredProviderKey {
  provider: ProviderId;
  ciphertext: string;
  baseURL: string | null;
  isDefault: boolean;
  updatedAt: string;
}

export interface UsageRecord {
  id: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  steps: number;
  createdAt: string;
}

interface DbShape {
  providerKeys: StoredProviderKey[];
  projects: PrismProject[];
  usage: UsageRecord[];
  settings: Record<string, unknown>;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "prism-db.json");

let memory: DbShape | null = null;
let writable = true;

function emptyDb(): DbShape {
  return { providerKeys: [], projects: [], usage: [], settings: {} };
}

export function readDb(): DbShape {
  if (memory) return memory;
  try {
    if (fs.existsSync(DB_PATH)) {
      memory = { ...emptyDb(), ...(JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as DbShape) };
      return memory;
    }
  } catch {
    writable = false;
  }
  memory = emptyDb();
  return memory;
}

export function writeDb(db: DbShape): void {
  memory = db;
  if (!writable) return;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${DB_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_PATH);
  } catch {
    writable = false;
  }
}

export function mutateDb<T>(fn: (db: DbShape) => T): T {
  const db = readDb();
  const out = fn(db);
  writeDb(db);
  return out;
}

export function getStoredKey(provider: ProviderId): StoredProviderKey | undefined {
  return readDb().providerKeys.find((k) => k.provider === provider);
}

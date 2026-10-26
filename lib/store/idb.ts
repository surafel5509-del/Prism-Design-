'use client';

// Tiny promise-based IndexedDB wrapper (projects, assets, misc). No dependencies.
const DB_NAME = 'prism-studio';
const DB_VERSION = 2;
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('misc')) db.createObjectStore('misc');
        if (!db.objectStoreNames.contains('versions')) db.createObjectStore('versions', { keyPath: 'vid' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  try { return await tx<T>(store, 'readonly', (s) => s.get(key) as IDBRequest<T>); } catch { return undefined; }
}
export async function idbPut(store: string, value: unknown, key?: string): Promise<void> {
  try { await tx(store, 'readwrite', (s) => (key ? s.put(value, key) : s.put(value))); } catch { /* quota / private mode */ }
}
export async function idbDelete(store: string, key: string): Promise<void> {
  try { await tx(store, 'readwrite', (s) => s.delete(key)); } catch { /* noop */ }
}
export async function idbAll<T>(store: string): Promise<T[]> {
  try { return await tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>); } catch { return []; }
}

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * AES-256-GCM encryption for user-supplied provider API keys.
 *
 * Key source order:
 *  1. PRISM_ENCRYPTION_KEY env (64 hex chars = 32 bytes) — REQUIRED in production.
 *  2. A locally generated `.prism-secret` file (dev convenience, gitignored).
 * Ciphertext format: `v1:<iv b64>:<authTag b64>:<data b64>`.
 * Plaintext keys are never returned to the client — only masked previews.
 */

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;
  const env = process.env.PRISM_ENCRYPTION_KEY?.trim();
  if (env) {
    if (/^[0-9a-fA-F]{64}$/.test(env)) {
      cachedKey = Buffer.from(env, "hex");
      return cachedKey;
    }
    // Accept any passphrase by hashing to 32 bytes.
    cachedKey = crypto.createHash("sha256").update(env).digest();
    return cachedKey;
  }
  const secretPath = path.join(process.cwd(), ".prism-secret");
  try {
    if (fs.existsSync(secretPath)) {
      const hex = fs.readFileSync(secretPath, "utf8").trim();
      if (/^[0-9a-fA-F]{64}$/.test(hex)) {
        cachedKey = Buffer.from(hex, "hex");
        return cachedKey;
      }
    }
    const generated = crypto.randomBytes(32);
    fs.writeFileSync(secretPath, generated.toString("hex"), { mode: 0o600 });
    // eslint-disable-next-line no-console
    console.warn(
      "[prism] PRISM_ENCRYPTION_KEY not set — generated a dev secret at .prism-secret. Set PRISM_ENCRYPTION_KEY in production.",
    );
    cachedKey = generated;
    return cachedKey;
  } catch {
    // Read-only filesystem (e.g. serverless without env): ephemeral key.
    // Saved keys will not survive restarts — set PRISM_ENCRYPTION_KEY.
    cachedKey = crypto.createHash("sha256").update("prism-ephemeral-dev-key").digest();
    return cachedKey;
  }
}

export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${data.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("Invalid ciphertext format");
  const key = loadKey();
  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const data = Buffer.from(parts[3], "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** `sk-…abcd` style masked preview. Never exposes more than the last 4 chars. */
export function maskKey(key: string): string {
  if (!key) return "";
  const tail = key.slice(-4);
  const head = key.startsWith("sk-") ? "sk-" : key.slice(0, 3);
  return `${head}…${tail}`;
}

import { NextRequest } from "next/server";
import { z } from "zod";
import { PROVIDERS, getProviderMeta } from "@/lib/providers";
import { encryptSecret } from "@/lib/crypto";
import { mutateDb, readDb } from "@/lib/db";
import { maskedFor } from "@/lib/ai/provider-factory";
import type { ProviderId, ProviderStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function statuses(): ProviderStatus[] {
  const db = readDb();
  return PROVIDERS.map((meta) => {
    const stored = db.providerKeys.find((k) => k.provider === meta.id);
    const { masked, source } = maskedFor(meta.id);
    const connected = meta.needsKey ? !!source : !!(stored || source);
    return {
      provider: meta.id,
      connected,
      source,
      maskedKey: connected ? masked : null,
      baseURL: stored?.baseURL ?? meta.defaultBaseURL,
      isDefault: stored?.isDefault ?? false,
      updatedAt: stored?.updatedAt ?? null,
    };
  });
}

/** GET — list provider connection status. Only masked keys are ever returned. */
export async function GET() {
  const db = readDb();
  const usageByProvider: Record<string, { runs: number; totalTokens: number }> = {};
  for (const u of db.usage) {
    usageByProvider[u.provider] ??= { runs: 0, totalTokens: 0 };
    usageByProvider[u.provider].runs++;
    usageByProvider[u.provider].totalTokens += u.totalTokens;
  }
  return Response.json({ providers: statuses(), usageByProvider });
}

const saveSchema = z.object({
  provider: z.enum(["openai", "anthropic", "google", "openrouter", "deepseek", "groq", "together", "fireworks", "ollama", "custom"]),
  apiKey: z.string().min(1).max(512).optional(),
  baseURL: z.string().url().max(512).nullable().optional(),
  isDefault: z.boolean().optional(),
});

/** POST — save (encrypt) a provider key / base URL. */
export async function POST(req: NextRequest) {
  let body: z.infer<typeof saveSchema>;
  try {
    body = saveSchema.parse(await req.json());
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Invalid body" }, { status: 400 });
  }
  const provider = body.provider as ProviderId;
  try {
  mutateDb((db) => {
    if (body.isDefault) db.providerKeys.forEach((k) => (k.isDefault = false));
    const existing = db.providerKeys.find((k) => k.provider === provider);
    const needsKey = getProviderMeta(provider).needsKey;
    let ciphertext: string | undefined;
    if (body.apiKey) ciphertext = encryptSecret(body.apiKey.trim());
    else if (existing?.ciphertext) ciphertext = existing.ciphertext;
    else if (!needsKey) ciphertext = encryptSecret("local-endpoint");
    if (!ciphertext) throw new Error("An API key is required the first time you save this provider.");
    const record = {
      provider,
      ciphertext,
      baseURL: body.baseURL ?? existing?.baseURL ?? null,
      isDefault: body.isDefault ?? existing?.isDefault ?? db.providerKeys.length === 0,
      updatedAt: new Date().toISOString(),
    };
    db.providerKeys = [...db.providerKeys.filter((k) => k.provider !== provider), record];
  });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Save failed" }, { status: 400 });
  }
  return Response.json({ ok: true, providers: statuses() });
}

/** DELETE ?provider=xxx — remove a saved key. */
export async function DELETE(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider") as ProviderId | null;
  if (!provider) return Response.json({ error: "provider query param required" }, { status: 400 });
  mutateDb((db) => {
    db.providerKeys = db.providerKeys.filter((k) => k.provider !== provider);
  });
  return Response.json({ ok: true, providers: statuses() });
}

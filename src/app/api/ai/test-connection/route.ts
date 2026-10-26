import { NextRequest } from "next/server";
import { z } from "zod";
import { modelsEndpoint, type ResolvedProvider } from "@/lib/ai/provider-factory";
import { getProviderMeta } from "@/lib/providers";
import type { ProviderId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  provider: z.enum(["openai", "anthropic", "google", "openrouter", "deepseek", "groq", "together", "fireworks", "ollama", "custom"]),
  apiKey: z.string().min(1).max(512),
  baseURL: z.string().url().max(512).nullable().optional(),
});

/**
 * POST /api/ai/test-connection — validates a candidate key against the
 * provider's models endpoint. The key is used for this request only and
 * is never stored or logged.
 */
export async function POST(req: NextRequest) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return Response.json({ ok: false, message: "Enter an API key first." }, { status: 400 });
  }
  const meta = getProviderMeta(body.provider as ProviderId);
  const resolved: ResolvedProvider = {
    provider: body.provider as ProviderId,
    apiKey: body.apiKey.trim(),
    baseURL: body.baseURL ?? meta.defaultBaseURL,
    source: "saved",
  };
  const endpoint = modelsEndpoint(resolved);
  if (!endpoint) return Response.json({ ok: false, message: "A Base URL is required for this provider." }, { status: 400 });

  const started = Date.now();
  try {
    const res = await fetch(endpoint.url, { headers: endpoint.headers, signal: AbortSignal.timeout(15_000) });
    const ms = Date.now() - started;
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as { data?: unknown[]; models?: unknown[] };
      const count = Array.isArray(data.data) ? data.data.length : Array.isArray(data.models) ? data.models.length : null;
      return Response.json({ ok: true, message: `Connected to ${meta.label} in ${ms}ms${count ? ` — ${count} models visible to this key` : ""}.` });
    }
    const text = (await res.text()).slice(0, 220);
    return Response.json({
      ok: false,
      message: res.status === 401 || res.status === 403
        ? `${meta.label} rejected this key (HTTP ${res.status}). Double-check it and try again.`
        : `${meta.label} responded HTTP ${res.status}. ${text}`,
    });
  } catch (err) {
    return Response.json({ ok: false, message: `Could not reach ${meta.label}: ${err instanceof Error ? err.message : "network error"}. Check the Base URL / local server.` });
  }
}

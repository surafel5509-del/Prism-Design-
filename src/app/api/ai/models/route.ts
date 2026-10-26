import { NextRequest } from "next/server";
import { curatedModels, inferCapabilities } from "@/lib/providers";
import { modelsEndpoint, resolveProvider } from "@/lib/ai/provider-factory";
import type { ModelInfo, ProviderId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ai/models?provider=xxx
 * Returns the provider's live model list (via its models endpoint with the
 * user's key) merged with curated metadata. Falls back to curated only.
 */
const cache = new Map<string, { at: number; models: ModelInfo[] }>();

export async function GET(req: NextRequest) {
  const provider = (req.nextUrl.searchParams.get("provider") ?? "openai") as ProviderId;
  const curated = curatedModels(provider);
  const resolved = resolveProvider(provider);
  if (!resolved) return Response.json({ models: curated, live: false });

  const hit = cache.get(provider);
  if (hit && Date.now() - hit.at < 60_000) return Response.json({ models: hit.models, live: true });

  const endpoint = modelsEndpoint(resolved);
  if (!endpoint) return Response.json({ models: curated, live: false });

  try {
    const res = await fetch(endpoint.url, { headers: endpoint.headers, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return Response.json({ models: curated, live: false });
    const data = (await res.json()) as { data?: { id: string }[]; models?: { name: string; displayName?: string }[] };
    let live: ModelInfo[] = [];
    if (Array.isArray(data.data)) {
      live = data.data
        .map((m) => m.id)
        .filter((id) => id && !/(embedding|whisper|tts|audio|moderation|rerank)/i.test(id))
        .map((id) => {
          const c = curated.find((x) => x.id === id);
          return c ?? { id, label: id, capabilities: inferCapabilities(id), source: "live" as const };
        });
    } else if (Array.isArray(data.models)) {
      live = data.models.map((m) => {
        const id = m.name.replace(/^models\//, "");
        const c = curated.find((x) => x.id === id);
        return c ?? { id, label: m.displayName ?? id, capabilities: inferCapabilities(id), source: "live" as const };
      });
    }
    const merged = [...curated, ...live.filter((m) => !curated.some((c) => c.id === m.id))];
    cache.set(provider, { at: Date.now(), models: merged });
    return Response.json({ models: merged, live: true });
  } catch {
    return Response.json({ models: curated, live: false });
  }
}

import { streamText, generateText, type CoreMessage } from "ai";
import { NextRequest } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { resolveProvider, getLanguageModel } from "@/lib/ai/provider-factory";
import { buildTools, type ToolContext } from "@/lib/ai/tools";
import { buildSystemPrompt, PLAN_FALLBACK_INSTRUCTION } from "@/lib/ai/prompts";
import { curatedModels, inferCapabilities } from "@/lib/providers";
import { mutateDb } from "@/lib/db";
import type { AgentMode, ProviderId, TaskKind } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  provider: z.enum(["openai", "anthropic", "google", "openrouter", "deepseek", "groq", "together", "fireworks", "ollama", "custom"]),
  model: z.string().min(1),
  mode: z.enum(["agent", "thinking", "fast"]).default("agent"),
  task: z.enum(["design", "motion", "image", "edit"]).default("motion"),
  prompt: z.string().min(1).max(12000),
  images: z.array(z.string()).max(10).default([]),
  temperature: z.number().min(0).max(2).optional(),
  customSystemPrompt: z.string().max(4000).optional(),
  project: z.object({
    name: z.string(),
    width: z.number(),
    height: z.number(),
    duration: z.number(),
    background: z.string(),
    layers: z.array(z.object({ id: z.string(), type: z.string(), name: z.string() })).default([]),
  }),
});

function supportsTools(provider: ProviderId, modelId: string): boolean {
  const curated = curatedModels(provider).find((m) => m.id === modelId);
  if (curated) return curated.capabilities.includes("tools");
  if (/reasoner|deepseek-r1/i.test(modelId)) return false;
  const inferred = inferCapabilities(modelId);
  return inferred.length === 0 ? true : inferred.includes("tools");
}

function encode(obj: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(obj)}\n`);
}

export async function POST(req: NextRequest) {
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch (err) {
    return Response.json({ error: `Invalid request: ${err instanceof Error ? err.message : "bad body"}` }, { status: 400 });
  }

  const { provider, model: modelId, mode, task, prompt, images, project } = parsed;
  const resolved = resolveProvider(provider);
  if (!resolved) {
    return Response.json(
      { error: `No API key configured for ${provider}. Add one in Settings → AI Providers (keys are encrypted at rest and never sent to the client).` },
      { status: 401 },
    );
  }

  const model = getLanguageModel(resolved, modelId);
  const system = buildSystemPrompt({
    mode: mode as AgentMode,
    task: task as TaskKind,
    project,
    hasImages: images.length > 0,
    customSystemPrompt: parsed.customSystemPrompt,
  });

  const userContent: CoreMessage["content"] = [
    { type: "text", text: prompt },
    ...images.map((dataUrl) => {
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      return { type: "image" as const, image: base64 };
    }),
  ];
  const messages: CoreMessage[] = [{ role: "user", content: userContent }];

  const isReasoningModel = /^(o1|o3|o4)|reasoner/i.test(modelId);
  const temperature = isReasoningModel ? undefined : (parsed.temperature ?? (mode === "thinking" ? 0.5 : 0.7));
  const toolCapable = supportsTools(provider, modelId);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        try { controller.enqueue(encode(obj)); } catch { /* client gone */ }
      };
      send({ type: "run-start", provider, model: modelId, mode, task, toolCapable });

      try {
        if (toolCapable) {
          const ctx: ToolContext = { canvas: { width: project.width, height: project.height, duration: project.duration }, ops: [] };
          const tools = buildTools(ctx);
          const result = streamText({
            model,
            system,
            messages,
            tools,
            maxSteps: mode === "fast" ? 8 : mode === "thinking" ? 32 : 24,
            ...(temperature !== undefined ? { temperature } : {}),
            abortSignal: req.signal,
            onStepFinish: (step) => send({ type: "step-finish", step: ctx.ops.length, text: step.text?.slice(0, 200) ?? "" }),
          });

          let stepNo = 0;
          for await (const part of result.fullStream) {
            const p = part as unknown as Record<string, unknown>;
            switch (part.type) {
              case "text-delta":
                send({ type: "text-delta", text: String(p.textDelta ?? "") });
                break;
              case "reasoning":
                send({ type: "reasoning-delta", text: String(p.textDelta ?? p.text ?? "") });
                break;
              case "tool-call":
                send({ type: "tool-call", toolCallId: p.toolCallId, toolName: p.toolName, args: p.args });
                break;
              case "tool-result":
                send({ type: "tool-result", toolCallId: p.toolCallId, toolName: p.toolName, result: p.result });
                break;
              case "step-finish":
                stepNo++;
                send({ type: "step-finish", step: stepNo });
                break;
              case "error":
                send({ type: "error", error: p.error instanceof Error ? p.error.message : String(p.error ?? "stream error") });
                break;
              default:
                break;
            }
          }
          const usage = await result.usage.catch(() => null);
          if (usage) {
            const num = (v: number | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
            const u = {
              promptTokens: num(usage.promptTokens),
              completionTokens: num(usage.completionTokens),
              totalTokens: num(usage.totalTokens) || num(usage.promptTokens) + num(usage.completionTokens),
            };
            send({ type: "usage", usage: u });
            mutateDb((db) => db.usage.push({ id: nanoid(10), provider, model: modelId, ...u, steps: stepNo, createdAt: new Date().toISOString() }));
          }
        } else {
          // ---- Structured JSON plan fallback for models without tool calling ----
          send({ type: "text-delta", text: `Note: ${modelId} doesn't support tool calling, so I'm generating a structured build plan and executing it deterministically.\n\n` });
          const { text, usage } = await generateText({
            model,
            system: `${system}\n\n${PLAN_FALLBACK_INSTRUCTION}`,
            messages,
            ...(temperature !== undefined ? { temperature } : {}),
            abortSignal: req.signal,
          });
          const cleaned = text.replace(/```(?:json)?/g, "").trim();
          const start = cleaned.indexOf("{");
          const end = cleaned.lastIndexOf("}");
          if (start < 0 || end <= start) throw new Error("Model did not return a valid JSON plan. Try a tool-capable model (GPT-4o, Claude, Gemini…).");
          const plan = JSON.parse(cleaned.slice(start, end + 1)) as { summary?: string; ops?: unknown[] };
          const ops = Array.isArray(plan.ops) ? plan.ops : [];
          send({ type: "tool-call", toolCallId: "json-plan", toolName: "execute_plan", args: { opCount: ops.length } });
          send({ type: "tool-result", toolCallId: "json-plan", toolName: "execute_plan", result: { ok: true, ops } });
          if (plan.summary) send({ type: "text-delta", text: plan.summary });
          if (usage) {
            send({ type: "usage", usage: { promptTokens: usage.promptTokens ?? 0, completionTokens: usage.completionTokens ?? 0, totalTokens: usage.totalTokens ?? 0 } });
          }
        }
        send({ type: "done" });
      } catch (err) {
        if ((err as Error)?.name === "AbortError") send({ type: "error", error: "Run cancelled by user." });
        else send({ type: "error", error: friendlyError(err, provider) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}

function friendlyError(err: unknown, provider: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/401|invalid.*api.*key|authentication/i.test(msg)) return `${provider} rejected the API key (401). Check the key in Settings → AI Providers and use “Test connection”.`;
  if (/404|model.*not found/i.test(msg)) return `Model not found for this key. Pick a different model from the picker — the live list shows what your key can access. (${msg.slice(0, 160)})`;
  if (/429|rate limit|quota/i.test(msg)) return `Rate limit / quota hit on ${provider}. Wait a moment, switch model, or configure a fallback provider. (${msg.slice(0, 140)})`;
  if (/fetch failed|ECONNREFUSED|ENOTFOUND/i.test(msg)) return `Couldn't reach ${provider}. If this is a local endpoint (Ollama/LM Studio), make sure it's running and the Base URL is correct. (${msg.slice(0, 140)})`;
  return msg.slice(0, 400);
}

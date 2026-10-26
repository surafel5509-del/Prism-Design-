# PRISM — AI Agent Pipeline

The agent is a **builder, not a chatbot**. Every AI action is a real provider
API call made server-side through the Vercel AI SDK with the user's own key.

## Request lifecycle (`POST /api/ai/chat`)

```
Browser (AIPanel)                Next.js server                     Provider
─────────────────                ───────────────                  ────────
prompt + images + project state ─▶ resolveProvider()  (decrypt key, AES-256-GCM)
                                 ─▶ buildSystemPrompt() (skills index + project state)
                                 ─▶ streamText({ model, tools, maxSteps }) ──▶ LLM
        ◀── NDJSON stream ───────  tool-call / tool-result / text / reasoning ◀──
applyOp() → Zustand store        tools execute server-side, return AgentOp
canvas + timeline update live
auto-play preview on `done`
```

### Pipeline phases (enforced by the system prompt, `src/lib/ai/prompts.ts`)

1. **CREATE** — `create_project` sizes the canvas (IG 1080², Story 1080×1920,
   YT thumb 1280×720, HD 1920×1080, poster 1240×1754…) and sets duration/background.
2. **ART DIRECT** — `generate_palette` commits a palette + font pairing to the brand kit.
3. **BUILD** — layers added back-to-front: background shapes → imagery → text. Server mints
   layer ids so the model can deterministically chain create → style → keyframe.
4. **ANIMATE** — `add_keyframe` entrances (opacity/position/scale/rotation) with eased
   segments (`easeOutCubic`, `easeOutBack`, `easeOutElastic`, `spring`, …), staggered.
5. **POLISH** — `add_effect` glows/shadows; contrast and hierarchy checks.
6. **NARRATE + PREVIEW** — `narrate` notes + streamed text explain progress; on completion
   the client rewinds and plays the composition, then offers Refine / Export.

### Modes

| Mode | Behavior |
|---|---|
| **Agent** | Autonomous, up to 24 steps, narrates phases. |
| **High Thinking** | Up to 32 steps, lower temperature, deeper art-direction reasoning (reasoning tokens surfaced when the model emits them). |
| **Fast** | Max 8 steps, minimal narration, composite builds. |

### Toolbelt (`src/lib/ai/tools.ts`)

All Zod-schema'd, executed server-side, returning structured `AgentOp`s that the
client applies to the editor store (`store.applyOp`):

`create_project`, `set_background`, `add_text`, `add_shape`, `add_image`,
`set_layer_property`, `delete_layer`, `add_keyframe`, `add_effect`,
`set_duration`, `generate_palette`, `narrate`.

### Fallback: structured JSON plans

Models without tool-calling (e.g. `deepseek-reasoner`) automatically switch to
*plan mode*: the model returns a Zod-shaped JSON op list (see
`PLAN_FALLBACK_INSTRUCTION`), the server validates and streams it as a single
`execute_plan` tool result, and the deterministic client runner applies the ops.
Errors are mapped to actionable messages (bad key → 401 guidance, missing model →
404 guidance, quota → fallback suggestion).

### Vision

Attached images (≤10, click/paste/drop) are forwarded as image parts to
vision-capable models; the system prompt instructs the agent to extract palette,
subject and mood. Optionally the uploads are placed on the canvas first so the
agent can animate them ("image-to-motion").

### Cancellation & observability

- The browser holds an `AbortController`; **Stop** aborts the fetch, the signal is
  forwarded into `streamText({ abortSignal })`, halting provider spend immediately.
- The Agent Run panel shows each tool call (name, args, status), the reasoning
  stream (collapsible), step counter, op counter, progress bar, and final
  token usage. Usage is persisted per provider and shown in Settings.

### Security

Keys are encrypted at rest with AES-256-GCM (`src/lib/crypto.ts`), decrypted only
in server memory per request, and never serialized to the client — the API returns
only masked previews like `sk-…abcd`. See `docs/DEPLOYMENT.md` for the Postgres path.

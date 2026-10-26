# The Prism agent pipeline

Prism's agent is a **real** tool-calling loop. There is no mocked plan, no canned response, and no
"preview" that bypasses the document. This document describes exactly what happens between a prompt
and a changed canvas.

---

## 1. Request lifecycle

```
editor (useAgentRun)
  │  POST /api/ai/chat
  │  { messages, provider?, model?, mode, outputKind, project, runId }
  ▼
route (app/api/ai/chat/route.ts)
  ├─ ensureUserId()            ← signed cookie session
  ├─ rateLimit(chat:<user>)    ← 30 runs / minute (PRISM_CHAT_RATE_LIMIT)
  ├─ resolveTarget()           ← per-task route → default → request override
  ├─ settings + capabilities   ← vision / image / speech / tools availability
  ├─ createToolbelt(project)   ← server-side document copy + op log
  └─ streamText({ model, system, messages, tools, maxSteps, … })
        │  data stream (AI SDK v4 protocol)
        ▼
consumeAgentStream()  →  text · reasoning · tool calls/results · finish
        │
        ├─ each tool result carries `ops[]` and optional `clientAction`
        ├─ useEditor.applyAgentOps(ops)      ← live canvas mutation
        ├─ useAgent.*                        ← tool log, plan, reasoning, status
        └─ emitAgentAction()                 ← preview / export / ask / saved
```

The run is persisted on finish: steps, tool calls, tokens, cost, duration and the op list
(`prism_users.runs`, trimmed to 60).

---

## 2. Modes

| Mode | `maxSteps` | Behaviour |
| --- | --- | --- |
| `thinking` | 32 | reason first, fewer experiments, explains craft decisions |
| `agent` | 24 | default: plan → build → refine → preview |
| `fast` | 10 | minimal narration, fewest calls that still finish |

`outputKind` (`design` · `motion` · `image` · `edit`) selects the craft guidance block in the system prompt.

---

## 3. The system prompt (`lib/ai/system-prompt.ts`)

The prompt is assembled per run and contains:

1. **Operating contract** — understand → plan → build → narrate → review → summarise; never claim an untooled action.
2. **Units** — layer positions are canvas fractions; keyframes are design pixels/degrees/0–1; times in seconds.
3. **Craft standards** — hierarchy ratio, palette discipline, type details (display tracking −2…−4, leading 0.9–1.05),
   composition, the 12 principles in motion terms, timing ranges, one restrained finishing pass.
4. **Tool discipline** — composite generators first, then surgical edits; batch independent calls; honest capability errors.
5. **Environment** — provider, model, available capabilities (vision/image/speech), mode, expected output kind.
6. **Current document** — canvas size/fps/duration plus up to 40 layers with ids, geometry, timing, animation and text.
7. **User extra prompt** — `settings.systemPromptExtra` appended verbatim.

Because the document summary is injected, the agent can edit by name (`"headline"`, `"CTA button"`) or by id.

---

## 4. The toolbelt (`lib/ai/tools.ts`)

`createToolbelt({ project, userId, generateImage, generateSpeech, vision })` returns:

```ts
{ tools, toolNames, getOps(), getProject() }
```

Every tool:

- declares a **Zod schema** (validated by the AI SDK before execution),
- receives canvas-fraction coordinates and converts them to design pixels,
- resolves layers by id / exact name / partial name,
- **applies its own ops** to the server-side document before returning, so subsequent tools see the result,
- returns `{ ok, summary, ops?, data?, error?, clientAction? }`.

The editor applies the same ops in the order they stream. This is why a run is reproducible and why the
server can reason about a document it just built without a round-trip.

### Tool groups

| Group | Tools |
| --- | --- |
| Orchestration | `set_plan` · `complete_step` · `ask_user` · `get_project_state` |
| Composition | `create_project` · `generate_design` · `generate_motion_scene` · `apply_template` · `set_copy` |
| Primitives | `add_shape` · `add_text` · `add_image` · `add_icon` · `add_backdrop` · `add_video` · `add_captions` · `add_music` · `add_voiceover` |
| Structure | `set_layer` · `duplicate_layers` · `delete_layers` · `reorder_layer` · `group_layers` · `ungroup_layer` · `parent_layer` · `align_layers` · `distribute_layers` |
| Motion | `add_keyframe` · `set_keyframes` · `clear_keyframes` · `apply_motion_preset` · `add_transition` · `animate_image` · `add_particles` · `add_physics` · `set_timing` · `trim_layer` |
| Look & feel | `add_effect` · `remove_effect` · `add_mask` · `apply_style_transfer` · `generate_palette` · `auto_layout` · `smart_reframe` |
| Real media | `generate_image` · `analyze_image` · `extract_colors` · `detect_text` |
| Library | `search_stock` · `search_icons` · `search_fonts` · `search_music` |
| Delivery | `render_preview` · `export_project` · `save_project` |

### Anatomy of a tool

```ts
const addKeyframeTool = tool({
  description: 'Add a keyframe to any animatable property…',
  parameters: z.object({
    layer: z.string(),
    property: z.enum(ANIM_PROPS),
    time: z.number(),
    value: z.number(),
    easing: z.enum(['linear','easeIn','easeOut','easeInOut','expo','spring','bounce','elastic']),
  }),
  execute: async (a) => {
    const layer = find(a.layer);                       // id | name | partial name
    const value = a.property === 'x' ? fx(a.value, W()) : a.value;   // fractions → px
    return done(`Keyframed ${layer.name}.${a.property}`,
      commit([{ op: 'add_keyframe', layerId: layer.id, prop: a.property,
                time: ts(a.time), value, easing: ease(a.easing) }], 'Keyframed'));
  },
});
```

### Adding a tool

1. Write the Zod schema with tight ranges and a description that tells the model *when* to use it.
2. Convert fractions to pixels with `fx`, clamp times with `ts`.
3. Emit op(s); call `commit(ops, label)` — never mutate `state.project` directly.
4. Return `done(summary, ops, { data })` or `nope('actionable reason')`.
5. Add it to the `tools` map and to the README table.
6. Add a test in `lib/ai/__tests__/tools.test.ts` that replays the ops and asserts server == client.

---

## 5. Human-in-the-loop

| Action | Effect |
| --- | --- |
| `ask_user({ kind: 'question' })` | the run pauses, the composer shows options, the next user message resumes the same thread |
| `ask_user({ kind: 'approval' })` | used after `set_plan` when `settings.requireApproval` is on; the editor shows an approve/edit-plan affordance |
| **Cancel** | aborts the fetch; the server's `abortSignal` stops the provider call; status becomes `cancelled`, partial ops remain applied |
| **Pause** | the client stops consuming; the server run finishes or is aborted depending on mode; resumed by answering |

Pausing is implemented by aborting the request while `pausedRef` is true — an `AbortError` is **not** treated
as a user cancel in that state (see `use-agent-run.ts`).

---

## 6. ClientActions

Tool results can request UI behaviour without touching the document:

```ts
{ type: 'plan',    summary, steps }
{ type: 'step',    index, note }
{ type: 'ask',     kind: 'question'|'approval', question, options, reason }
{ type: 'preview', autoplay }
{ type: 'export',  options: { format, preset?, fps?, scale?, transparent? } }
{ type: 'saved',   id }
```

They are emitted by `lib/ai/bus.ts` and consumed by `EditorShell` (preview dialog, export dialog, save flag)
and by the AI panel (plan checklist, question composer).

---

## 7. Capabilities and honest failure

The route resolves capabilities once per request:

```ts
capabilities(user) → { vision, imageGen, speech, tools, imageTarget, visionTarget, speechTarget }
```

- If a tool needs a capability that is missing (e.g. `generate_image` with no image model), it returns
  `{ ok: false, summary: 'Image generation is not available: …' }`. The model is instructed to tell the user
  which provider to connect and continue with what it can build.
- `search_stock` reports `UNSPLASH_ACCESS_KEY` / `PEXELS_API_KEY` missing instead of inventing results.
- Provider errors are translated (`providerErrorMessage`) into 401 / 429 / 404 / network / context-length advice,
  surfaced in the panel's `ErrorCard` with a retry affordance.

---

## 8. Reliability

- **Deterministic ordering:** tool ops are emitted in call order; the client applies them sequentially.
- **Retries:** the tool instructions tell the model to fix arguments and retry once, then change approach.
- **Auto-fallback:** with `fallbackEnabled`, the server probes the primary provider's `/models` (no token spend)
  and switches to the fallback provider/model before streaming if the key is dead.
- **Aborts:** `req.signal` is passed to `streamText`; the belt refuses to keep mutating after abort.
- **Large payloads:** generated media is written to `.data/generated` and referenced by URL — never inlined into
  the model context or the op log.
- **Context:** only the last 14 messages and an 8,000-character project summary are sent; the rest is state.

---

## 9. Cost & observability

Per step, `onStepFinish` accumulates prompt/completion tokens and tool-call counts. On finish the route:

```ts
recordUsage(userId, { provider, model, tokensIn, tokensOut, cost, kind: 'chat', runId });
recordRun(userId, { runId, prompt, provider, model, status, toolCalls, steps,
                    tokensIn, tokensOut, cost, durationMs, ops });
audit(userId, 'ai.run', `${provider}/${model} · ${toolCalls} tools`);
```

Cost uses `estimateCost(modelInfo, tokensIn, tokensOut)` with published per-million pricing; image and speech
calls are recorded as flat estimates. The dashboard (`/dashboard?tab=activity`) and `/settings/ai#usage`
both read the same records.

---

## 10. Server-side vision, image and speech

| Capability | Implementation | Provider default |
| --- | --- | --- |
| Vision | `generateText` with a text + image content part, `temperature 0.2`, `maxTokens 900` | `settings.taskProviders.vision` → default |
| Image | `generateImage` (images API) → `saveGenerated()` → `/api/assets/<file>` | `openai` `gpt-image-1`, or Google Imagen |
| Speech | `generateSpeechOpenAI` (TTS) → `saveGenerated()` → audio layer | `openai` `tts-1` |

None of these paths use the browser; keys never leave the server.

---

## 11. What the agent cannot do (by design)

- It cannot call arbitrary URLs, run shell commands, or read files outside the project payload.
- It cannot modify provider keys or settings — those routes are user-only.
- It cannot claim an export happened; it can only request one through `export_project`, which the editor performs
  with the real renderer.
- It cannot bypass capability checks: a missing key produces a message, never a placeholder image.

# PRISM — Motion Graphics & Design Studio with a True BYO-AI Agent

**Describe it. Watch the agent build it.**

Prism is a browser-based creative studio that combines a professional motion-graphics
editor (multi-track timeline, keyframes, easing, effects), a graphic-design suite
(vector shapes, rich text, gradients, brand kits, templates), and an **autonomous AI
agent** that plans, selects tools, edits your real canvas step by step, narrates its
work, and auto-plays the preview — powered entirely by **your own API keys** through
the **Vercel AI SDK**. No fake AI: every AI action is a real provider call; with no key
configured, the agent says so (a clearly-labeled offline template builder is included
for trying the pipeline mechanics, and it never pretends to be AI).

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

1. Open **Settings → AI Providers** and paste a key (OpenAI, Anthropic, Google
   Gemini, OpenRouter, DeepSeek, Groq/Together/Fireworks, Ollama, or any
   OpenAI-compatible endpoint). Use **Test connection**, then **Save** —
   keys are encrypted at rest with AES-256-GCM and never sent back to the browser.
2. Open the **Studio**, pick your provider/model in the AI panel, choose
   **Agent / Thinking / Fast**, describe what to build, hit **Run agent**.
3. Watch tool calls stream in as layers and keyframes appear. Refine in chat
   (task = `edit`), edit manually, then **Export** (video MP4/WebM, GIF, PNG, SVG,
   Lottie, project JSON).

> Optional: `cp .env.example .env.local` to pre-seed provider keys and set
> `PRISM_ENCRYPTION_KEY` (required in production). No database is needed locally —
> state persists to `data/prism-db.json` (gitignored) plus a browser draft.

### Verify the agent without a paid key (wire-protocol test double)

```bash
node scripts/mock-llm.mjs    # OpenAI-compatible mock on :11499 with real tool-calling
```

Then in Settings → **Custom** set Base URL `http://localhost:11499/v1`, Save, and run
the agent with model `prism-mock`. This exercises the genuine end-to-end path —
`streamText` multi-step tool calling → server tool execution → streamed canvas ops —
against a scripted endpoint. Swap in any real provider for real intelligence.

---

## What's inside

### Editor (Studio)
- **Canvas**: shapes (rect/ellipse/polygon/star/line), rich text (10 fonts, tracking,
  leading, gradient fills), images (drop/paste/upload), draw tools, drag/resize/rotate
  with smart snapping, rulers, grid, zoom/pan, inline text editing, blend modes,
  effects (shadow/glow/blur/outline), align-to-canvas, layer lock/visibility/reorder.
- **Timeline**: multi-track clips, per-property keyframe lanes (x/y/scale/rotation/
  opacity), 10 easings (incl. elastic, bounce, spring), playhead scrub, frame stepping,
  loop, animation presets (Fade Up, Pop In, Spin In, Pulse…).
- **Workflow**: undo/redo history, autosave (server + local draft), command palette
  (`⌘K`), Figma/AE-style shortcuts (`V/H/R/O/T`, `Space`, `⌘Z/⇧Z`, `⌘D`, arrows),
  brand kits, 12 production templates (launch, sale post, thumbnail, story, logo
  reveal, lower third, kinetic quote, poster, podcast cover, banner, countdown…).
- **Export**: video (real-time canvas capture — MP4 where supported, else WebM),
  animated GIF (gifenc), PNG frame, SVG frame, Lottie JSON, `.prism.json`.
  All rendered by one deterministic frame renderer, so exports match the canvas.

### AI Agent (`src/lib/ai/`)
- **Real BYO-AI** via Vercel AI SDK (`ai@4.3`): `@ai-sdk/openai`, `-anthropic`,
  `-google`, `-deepseek`, `@openrouter/ai-sdk-provider`, and
  `createOpenAICompatible` for Groq/Together/Fireworks/Ollama/LM Studio/custom.
- **Agent loop**: `streamText` with 12 Zod-validated tools and up to 32 steps:
  create project → art-direct palette → build layers → keyframe → effects →
  summarize. Tool results stream to the client as `AgentOp`s applied live to the
  editor store; reasoning, tool args, step/progress and token usage are all visible,
  and runs are cancellable (abort signal reaches the provider call).
- **Vision**: attach up to 10 images (click/paste/drop); vision models read them,
  and uploads can be placed on the canvas for image-to-motion work.
- **Resilience**: models without tool-calling (e.g. `deepseek-reasoner`) fall back
  to structured-JSON plan mode executed by a deterministic runner; errors map to
  actionable guidance (bad key, missing model, quota, unreachable endpoint).
- **Model picker**: live model lists from each provider's `/models` endpoint
  (capability tags inferred: tools/vision/reasoning) merged with curated metadata —
  switch provider/model mid-conversation.

### Security
AES-256-GCM encrypted keys (`PRISM_ENCRYPTION_KEY`, or a gitignored dev secret),
server-side-only provider calls, masked key previews (`sk-…abcd`) as the only thing
ever returned to clients, Zod-validated API bodies and tool schemas.

## Architecture

```
src/
  app/            routes: dashboard (/), studio (/studio), settings (/settings)
    api/ai/       chat (streaming agent), models, providers (encrypted keys), test-connection
    api/projects  project CRUD
  components/studio/  CanvasStage, Timeline, Inspector, LeftPanel, AIPanel, Export…
  lib/
    types.ts      document model (Layer, Keyframe, PrismProject, AgentOp)
    store.ts      Zustand editor store (history, applyOp, playback state)
    easing.ts     keyframe evaluator + easing library
    render.ts     deterministic Canvas2D renderer (exports + thumbnails)
    templates.ts  12 seeded compositions
    ai/           provider-factory, tools (Zod), prompts (skills index)
    crypto.ts     AES-256-GCM · db.ts local store (Postgres-swappable)
prisma/ supabase/    production Postgres schemas (RLS included)
docs/             AI-PIPELINE.md · DEPLOYMENT.md
scripts/          mock-llm.mjs (tool-calling test double)
tests/            keyframe/ai/crypto critical-flow tests (`npm test`)
```

## Scripts

| Command | What |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Critical-flow tests (node --test) |

## Production

See `docs/DEPLOYMENT.md`: deploy to Vercel with `PRISM_ENCRYPTION_KEY` set, then
swap `src/lib/db.ts` for Postgres (schemas provided) + Supabase/Clerk auth + S3/R2
asset storage for multi-user teams, collaboration and server rendering (FFmpeg).

Built with Next.js 14, React 18, TypeScript, Tailwind, Zustand, Framer-Motion-ready
micro-interactions, and the Vercel AI SDK.

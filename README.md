<div align="center">

# ◆ PRISM

**Motion graphics studio × graphic design platform × autonomous design agent.**

A real, runnable, production-shaped editor — custom canvas renderer, keyframe engine, multi-track timeline,
and an AI agent that builds the actual document through typed tool calls on **your own** model keys.

`Next.js 14` · `React 18` · `TypeScript` · `Tailwind` · `Framer Motion` · `Zustand` · `Vercel AI SDK v4` · `Zod` · `Postgres / Supabase`

</div>

---

## What this is

Prism is not a design mockup generator. Every AI action is a real model call through a provider you connect,
executed through deterministic document operations (`Op`) that the **editor, the server, the preview, the thumbnails
and every export** apply identically. There is no parallel fake path.

- **Editor**: vector shapes, pen/bezier paths, rich text, images, video, audio, masks, groups, parenting,
  effects, blend modes, gradients, snapping, rulers, guides, boolean ops, multi-select and align/distribute.
- **Motion**: multi-track timeline, keyframes on any animatable property, easing including spring/bounce/elastic,
  presets, transitions, particles, physics bake, image motion, audio sync, loop and ping-pong.
- **Agent**: streams reasoning + tool calls, mutates the live document, pauses for approval, cancels cleanly,
  and ends with an inspectable run summary (steps, tools, tokens, cost, duration).
- **BYO-AI**: 11 providers, AES-256-GCM encrypted at rest, server-side only, per-task routing, live model lists
  with curated fallback, real "Test connection".
- **Studio**: dashboard with projects, 1,000+ templates, brand kits, activity, share links with comments,
  and `/s/<id>` viewer.

---

## Quick start

```bash
# 1 — install
npm install

# 2 — configure (optional; the editor works with no keys at all)
cp .env.example .env.local
#    PRISM_SECRET is required to store provider keys:
#    openssl rand -base64 32   →  PRISM_SECRET=…

# 3 — run
npm run dev            # http://localhost:3000
```

Open `http://localhost:3000` → **Open studio**, or jump straight to `http://localhost:3000/editor`.

### Connect a model (30 seconds)

1. `Settings → AI providers` (`/settings/ai`)
2. Pick a provider card → paste a key → **Test connection** → **Save & connect** → optionally **Set as default**
3. Back in the editor, open the AI panel → the model button shows your live model list
4. Ask: *"Build a 9:16 launch film for a battery startup, 8 seconds, confident and minimal, with captions"*

No key? The editor, templates, brand kits, exports and share links all still work — the agent refuses
with a precise message instead of pretending.

---

## The 60-second tour

| Surface | Where | What to try |
| --- | --- | --- |
| Editor | `/editor/new` | Draw shapes, ⌘/Ctrl-drag to duplicate, add keyframes in the Inspector |
| Templates | `/dashboard?tab=templates` | One click → a real, editable document |
| Dashboard | `/dashboard` | Rename/duplicate/delete, search, recent first |
| AI panel | Right dock, ⌘J | Plan → build → preview → export in one run |
| Preview | ⌘⏎ / `render_preview` | Play, scrub, frame-step, loop, compare resolutions |
| Export | ⌘E | MP4/WebM/GIF, PNG/JPG/SVG/PDF, Lottie |
| Share | Top bar → Share | Creates `/s/<id>`, optional comments, "Update snapshot" |
| History | Top bar → Version history | Restore any of the last ten snapshots |
| Command palette | ⌘K | ~34 commands: tools, panels, templates, project, theme |

---

## Feature map

### Canvas & design
- Pure canvas-2D renderer (no Konva/Fabric/GSAP) — identical output in editor, preview, thumbnails, exports
- Shapes: rect, rounded rect, ellipse, polygon, star, triangle, diamond, hexagon, line, arrow
- Pen & path editing, boolean operations (union/subtract/intersect/exclude), masks (rect/ellipse/gradient)
- Typography: font stacks, weights, tracking, leading, case, gradients, stroke, text animators
  (typewriter, word reveal, char rise, count-up)
- Images and video with cover/contain, crop/radius, motion presets (Ken Burns, parallax, reveal, kinetic, 2.5D)
- Gradients (linear/radial/conic), procedural backgrounds (mesh, grain, waves, orb, grid, blob, spotlight, duotone)
- 50+ effects path: blur, glow, dropShadow, chromatic, grain, scanlines, light sweep, bloom, displacement, …
- Blend modes, opacity, guides, snapping, rulers, safe areas, grid, zoom to fit/selection, multi-select

### Motion
- Timeline with layer bars, keyframe diamonds, easing menu, playback, scrub, loop/ping-pong
- Keyframes on `x/y/w/h/rotation/scaleX/scaleY/opacity/blur/hue/saturate/radius/fontSize/letterSpacing/volume`
- Easing: linear, ease in/out/in-out, cubic-bezier, spring, bounce, elastic, hold
- Motion presets (fade, slide, scale pop, rotate in, blur in, typewriter, char rise, float, pulse, sway,
  Ken Burns, glitch, shake, spin, …) with stagger
- Transitions (fade/slide/scale/blur/wipe), time-based trimming, playback rate, audio fades
- Procedural soundtracks & SFX synthesized in-browser (royalty-free by construction) with waveform display

### Agent
- 50+ typed tools over one deterministic op pipeline (see [docs/AI_PIPELINE.md](docs/AI_PIPELINE.md))
- Live tool log, per-step status, reasoning panel, plan checklist, pause/cancel, human-in-the-loop `ask_user`
- Real image generation, vision analysis, TTS voiceover, stock search (when configured) — capability-gated with honest errors
- Per-task model routing, temperature/top-p/max-tokens, approval mode, auto-fallback, usage + cost tracking

### Platform
- Local-first projects (IndexedDB) + optional cloud sync (`/api/projects`) + autosave
- **Version history**: ten local snapshots with live thumbnails, restore that preserves undo
- Brand kits, favorites, 1,544 real vector icons, stock integration, share links with comments
- Dark / light / system themes, reduced-motion friendly, keyboard-first, desktop-first responsive guard
- AES-256-GCM provider secrets, rate limits, audit trail, no keys or prompts in the client

---

## Architecture

```
app/
  page.tsx                 marketing landing
  editor/page.tsx          creates a fresh project id → /editor/<id>
  editor/[id]/page.tsx     EditorShell (single editor mount)
  dashboard/               studio: projects · templates · brand kits · activity
  settings/                workspace settings + /settings/ai (BYO-AI)
  s/[id]/                  public share viewer (player + comments)
  api/
    ai/chat                streaming agent endpoint (streamText + tools + maxSteps)
    ai/providers(+/test)   connect / remove / test providers (encrypted)
    ai/settings            generation defaults, routing, usage
    ai/models              live model lists + curated fallback
    ai/usage               runs, tokens, cost
    projects               cloud project CRUD
    share/[id]             share links + comments
    assets/[...file]       generated media
    stock                  Unsplash / Pexels proxy

components/
  editor/                  TopBar · ToolRail · CanvasStage · Timeline · LeftPanel · Inspector
                           AIPanel · StatusBar · EditorShell · CommandPalette · Onboarding
    panels/                Layers · Assets · Templates · Brand · Effects
    dialogs/               Preview · Export · Share
  ai/                      ProviderPicker · RunPanels · Composer · Markdown
  app/                     AppShell · Dashboard
  settings/                AISettingsPage · ProviderCard
  share/                   SharePlayer
  canvas/SceneCanvas       deterministic renderer surface
  ui/                      shadcn-style primitives

lib/
  engine/                  types · easing · animation · renderer · factory · ops · transform · audio · presets
  ai/                      providers · runtime · tools · skills · system-prompt · stream · bus
  server/                  crypto · store · session · ai-config · ratelimit · generated · assets
  store/                   editor · agent · idb
  export/exporters.ts      PNG/JPG/SVG/PDF/GIF/WebM/MP4/Lottie pipelines
  data/                    ~1,000 templates · icon & media library
  hooks/                   use-ai · use-agent-run · use-playback · use-theme

db/                        SQL migrations (Postgres / Supabase)
docs/                      AI pipeline · deployment
```

### One document, one mutation path

```
agent tool  ──►  Op[]  ──► applyOps(project, ops)  ──►  { project, results }
                              │
        server-side belt copy ┤ streamed to the editor, applied in order
                              └► editor store · preview · thumbnails · exports
```

Because every change is an op, an AI run is reproducible: replay the op log and you get the same document.
The toolbelt keeps its own copy so later tool calls see earlier results; the client receives each tool's ops
as they stream and applies them immediately.

---

## BYO-AI

| Provider | ID | Notes |
| --- | --- | --- |
| OpenAI | `openai` | text, vision, **image** (gpt-image-1 / dall-e-3), **speech** (tts-1) |
| Anthropic | `anthropic` | long-context reasoning, vision |
| Google | `google` | Gemini text/vision + Imagen image generation |
| OpenRouter | `openrouter` | one key → many models; attribution headers included |
| DeepSeek | `deepseek` | deepseek-chat / reasoner |
| Groq · Together · Fireworks | `groq` `together` `fireworks` | OpenAI-compatible, fast inference |
| Ollama · LM Studio | `ollama` `lmstudio` | local; **no key required** |
| Custom | `custom` | any OpenAI-compatible base URL (vLLM, LiteLLM, Azure proxy…) |

- Keys are encrypted with **AES-256-GCM** (`PRISM_SECRET`), stored per user, never returned — only a masked preview.
- "Test connection" calls the provider's `/models` endpoint server-side and reports latency + model count.
- Live model dropdown merges the provider's real list with a curated fallback (context window, capabilities, cost).
- Per-task routing: motion, design, image, vision, speech and music can each use a different model.
- Optional **auto-fallback**: if the primary key fails the server switches to your backup provider for that run.
- Usage/cost is estimated from published per-million-token pricing and shown per run and per provider.

---

## Exports

| Target | Format | Notes |
| --- | --- | --- |
| Video | `MP4` (H.264) | real `MediaRecorder` + canvas frames; falls back to `WebM` when the browser lacks H.264, with a visible note |
| Video | `WebM` | VP9/VP8, transparent-friendly |
| Animation | `GIF` | quantized palette, ≤600 px, 8–24 fps |
| Stills | `PNG`, `JPG` | current frame, transparency supported |
| Vector | `SVG` | real vector output for shapes/text/images |
| Print | `PDF` | single-page 1.4 |
| Motion data | `Lottie JSON` | 5.7.4 subset: layers, transforms, opacity, keyframes |

Presets: 1080p, 4K, Instagram square/portrait, TikTok, YouTube, custom. Exports are client-side — nothing
is uploaded, and a transparent background is honoured end-to-end.

---

## Keyboard

| Keys | Action |
| --- | --- |
| `V H R T P Z I` | select · hand · shape · text · pen · zoom · eyedropper |
| `⌘/Ctrl + K` | command palette |
| `⌘/Ctrl + J` | toggle AI panel |
| `⌘/Ctrl + S` | save (IndexedDB + cloud, when signed in) |
| `⌘/Ctrl + E` | export dialog |
| `⌘/Ctrl + ⏎` | preview |
| `⌘/Ctrl + Z / ⇧Z` | undo / redo |
| `⌘/Ctrl + A / D / G / ⇧G` | select all · duplicate · group · ungroup |
| `⌘/Ctrl + C / V` | copy / paste |
| `Space` | play / pause |
| `Delete` | delete selection |
| `[` `]` | nudge layer order |
| arrows (±1 / ±10) | nudge selection |
| `+ - 0` | zoom in / out / fit |
| `?` | shortcuts overlay |

---

## Data & persistence

| Location | Contents |
| --- | --- |
| IndexedDB `projects` | full project documents, offline-first |
| `.data/prism-store.json` | users, encrypted providers, settings, usage, runs, shares (file mode) |
| `prism_users` (JSONB) | same data in Postgres when `DATABASE_URL` is set |
| `.data/generated/` | images / speech produced by models, served at `/api/assets/…` |
| `localStorage` | theme, brand kits, favorites, last chat, AI target, panel width, onboarding flag |

Cloud saves are throttled (25 s) and capped (300 layers per snapshot) so a runaway agent can't flood the network.
Undo history is per-project and kept in memory + IndexedDB snapshots.

---

## Security

- Provider secrets: AES-256-GCM, random IV per secret, `PRISM_SECRET` in env, decrypted only inside API routes.
- The client never receives a key — `/api/ai/providers` returns `keyPreview` (`sk-…4f2a`) only.
- All model calls, stock lookups and vision requests are server-side; the browser only talks to Prism's routes.
- Rate limits per user per route; audit entries for provider changes and agent runs (no prompt bodies in audit).
- Share snapshots are server-rendered from stored data — no script injection path from project content.

---

## Scripts

```bash
npm run dev        # dev server on 0.0.0.0:3000
npm run build      # production build
npm start          # serve the production build
npm run lint       # next lint
npm run typecheck  # tsc --noEmit
npm test           # vitest: engine ops, sampling, easing, agent toolbelt
```

17 tests cover deterministic ops, easing stability, sampling, hit-testing, the stream protocol and toolbelt replay
(server document == client replay).

---

## Deploy

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for Vercel + Supabase + S3, Docker, auth, and operations.
TL;DR: set `PRISM_SECRET`, optionally `DATABASE_URL`, deploy the Next app, run `db/001_init.sql`.
Generated media lives on the local filesystem by default — switch to S3/R2 (or Supabase Storage) for serverless.

---

## Honest limitations

- **MP4 is browser-dependent.** Recording uses `MediaRecorder`; Chromium usually provides H.264, Firefox/Safari
  often do not and Prism transparently produces WebM with a note instead of a broken file.
- **Stock search needs keys.** Without `UNSPLASH_ACCESS_KEY` / `PEXELS_API_KEY`, `search_stock` says so and the
  agent uses generated images or geometry — it never invents a photo URL.
- **Auth is single-user by default.** The anonymous cookie session is production-safe for personal/self-host use;
  multi-user teams should wire Clerk/Supabase Auth (documented) — the schema and session seam are ready.
- **Audio is synthesized, not licensed.** Music/SFX are procedural and royalty-free by construction; uploads are
  supported for real tracks.
- **AI quality follows your model.** Prism supplies the craft rules, tools and guardrails; a small local model
  will still design like a small local model. Tool-calling models are required for the agent path.
- **Desktop-first.** Below 1024 px the editor shows a "built for desktop" notice; the dashboard and share viewer
  are responsive.

---

<div align="center"><sub>Built for people who want the design <em>and</em> the motion, without the subscription.</sub></div>

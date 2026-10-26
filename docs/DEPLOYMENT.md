# PRISM — Deployment Guide

## Local development

```bash
npm install
cp .env.example .env.local   # optional — keys can be added in the UI instead
npm run dev                  # http://localhost:3000
```

No database is required locally: projects, encrypted provider keys and usage
persist to `data/prism-db.json` (gitignored), with a browser-draft mirror in
localStorage. Generate an encryption key for anything beyond your laptop:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# → set as PRISM_ENCRYPTION_KEY
```

## Vercel (recommended)

1. Import the repo; framework preset = Next.js. No build changes needed
   (`npm run build`).
2. Environment variables:
   - `PRISM_ENCRYPTION_KEY` — **required** (serverless filesystems are ephemeral;
     without it, UI-saved keys won't survive cold starts — env provider keys like
     `OPENAI_API_KEY` still work).
   - Optionally pre-seed provider keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, …).
3. `/api/ai/chat` sets `maxDuration = 300`; on the Hobby plan long agent runs may
   be capped — Pro/Enterprise raises the ceiling.

## Production data (Postgres + Auth + Storage)

The runtime store interface is `src/lib/db.ts` (`readDb/mutateDb/getStoredKey`).
To go multi-user:

1. **Database** — provision Postgres (Supabase or Neon), run
   `supabase/migrations/0001_prism.sql` *or* `npx prisma migrate deploy`
   (`prisma/schema.prisma`), re-implement `db.ts` against it, scoping every row
   by the authenticated user id.
2. **Auth** — Supabase Auth or Clerk (env vars stubbed in `.env.example`).
   The local build uses a single local profile by design; gate `/api/*` with
   your auth middleware when you add accounts.
3. **Assets** — S3-compatible bucket (Cloudflare R2 / AWS S3) for uploaded media;
   store URLs on image layers instead of data URLs.
4. **Realtime collaboration** — layer ops are already serializable `AgentOp`s;
   broadcast them over WebSockets (e.g. Liveblocks/PartyKit) for multiplayer
   cursors, and persist `project_versions` snapshots for history.

## Export pipeline notes

- **PNG / GIF / SVG / Lottie / Project JSON** render fully client-side from the
  deterministic frame renderer (`src/lib/render.ts`) — zero server cost.
- **Video** captures the same renderer with `canvas.captureStream` +
  `MediaRecorder` (MP4 where the browser supports it, WebM otherwise).
- For long-form / 4K / batch renders, run a headless render worker: POST the
  `.prism.json` document, rasterize frames with the same `render.ts` in a
  headless browser or `@napi-rs/canvas`, pipe to FFmpeg
  (`ffmpeg -framerate 30 -i frame_%05d.png -c:v libx264 -pix_fmt yuv420p out.mp4`).

## Hardening checklist

- [ ] `PRISM_ENCRYPTION_KEY` set from a KMS/secret manager; rotate by re-saving keys.
- [ ] Rate-limit `/api/ai/chat` per user/IP (e.g. Upstash Ratelimit) to cap provider spend.
- [ ] Auth on all `/api/*` routes once accounts exist; keys scoped per user (RLS policies included).
- [ ] Cap `maxSteps` per plan tier; usage rows already recorded per provider/model.
- [ ] Serve uploaded assets from your bucket with signed URLs, not data URLs.

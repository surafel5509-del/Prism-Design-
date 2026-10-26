# Deploying Prism

Prism is a standard Next.js 14 App Router app with three server-side concerns: encrypted provider keys,
the user store, and generated media. Everything else is client-side.

---

## 0. Requirements

- Node 20+ (Node 22 tested), npm 10+
- A secret for AES-256-GCM: `openssl rand -base64 32` → `PRISM_SECRET`
- Optional: Postgres (Supabase / Neon / RDS), S3-compatible storage, Clerk or Supabase Auth

---

## 1. Vercel (recommended)

```bash
# from the repo
vercel link
vercel env add PRISM_SECRET production
vercel env add NEXT_PUBLIC_APP_URL production   # https://your-domain.com
vercel --prod
```

Project settings:

| Setting | Value |
| --- | --- |
| Framework preset | Next.js |
| Build command | `npm run build` |
| Node version | 20.x or 22.x |
| Functions region | close to your database and users |

### Required env

```ini
PRISM_SECRET=…                    # 32-byte base64; changing it invalidates stored keys
NEXT_PUBLIC_APP_URL=https://…     # share links + OpenRouter attribution
```

### Strongly recommended

```ini
DATABASE_URL=postgres://…         # pooled connection string (Supabase: port 6543)
UNSPLASH_ACCESS_KEY=…
PEXELS_API_KEY=…
```

### Postgres

```bash
psql "$DATABASE_URL" -f db/001_init.sql
```

With `DATABASE_URL` set, each user's providers, settings, usage, runs and cloud projects live in one
`prism_users.data` JSONB row. That keeps migrations rare while letting you query the pieces you need:

```sql
-- spend per user this month
select id,
       coalesce(sum((u->>'cost')::numeric), 0) as usd
from prism_users,
     jsonb_array_elements(data->'usage') u
where (u->>'at')::bigint > (extract(epoch from now() - interval '30 days') * 1000)
group by id order by usd desc;
```

Schedule `db/002_cleanup.sql` (Vercel Cron → a small `/api/cron/cleanup` route if you prefer HTTP).

### Generated media on serverless

`saveGenerated()` writes to `.data/generated` (ephemeral on Vercel). For production, point it at durable storage.
Two options:

1. **Supabase Storage / S3**: upload the buffer and return the public URL — swap the body of `saveGenerated`
   in `lib/server/generated.ts`; the rest of the app only needs a URL.
2. **Vercel Blob**: same seam.

Until then, generated images last for the life of the function instance — fine for local and single-instance hosts.

---

## 2. Supabase

1. Create a project → copy the **pooled** connection string into `DATABASE_URL`.
2. Run `db/001_init.sql` in the SQL editor.
3. Optional: enable RLS policies (commented in the migration) if you move auth to Supabase.
4. Optional storage: create a public `prism-media` bucket and swap `saveGenerated`.

The file store (`.data/prism-store.json`) remains the zero-dependency fallback; Postgres is used automatically
when `DATABASE_URL` is present.

---

## 3. Docker / self-host

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t prism .
docker run -p 3000:3000 \
  -e PRISM_SECRET="$(openssl rand -base64 32)" \
  -e NEXT_PUBLIC_APP_URL=https://prism.example.com \
  -v prism-data:/app/.data \
  prism
```

Mount `.data` on a volume so projects, share links, encrypted keys and generated media survive restarts.
Put it behind nginx/Caddy with TLS; Prism's session cookie is `Secure` in production.

---

## 4. Authentication

The default is an anonymous, signed cookie session (`lib/server/session.ts`) — safe for personal and
self-hosted use, single-tenant per browser.

For real accounts:

1. Add Clerk: `@clerk/nextjs`, wrap `app/layout.tsx` in `<ClerkProvider>`, add middleware.
2. Replace `ensureUserId()` with `auth().userId` (Clerk) or `supabase.auth.getUser()`.
3. The rest of the stack is already keyed by `userId`: providers, settings, usage, runs, projects, shares.
4. For teams, extend `prism_users.role` and add a `workspace_id` column + RLS; `ProjectRecord` already carries
   an owner id.

Do not expose `/api/ai/*` publicly without auth in a multi-tenant deployment — the routes assume the session
identifies the key owner.

---

## 5. Operations

### Health

```bash
curl -s https://your-domain/api/ai/providers | jq '.providers | length'
```

`/api/ai/providers` requires a session cookie; it returns the catalog even with zero providers connected.

### Rate limits & abuse

`rateLimit()` is in-memory per instance (`lib/server/ratelimit.ts`). For multi-instance deployments move it to
Upstash Redis or Supabase: same function signature, keyed by `route:userId`. Set `PRISM_CHAT_RATE_LIMIT` low
(10–30/min) for public demos, higher for teams.

### Secrets rotation

Changing `PRISM_SECRET` makes existing encrypted keys unreadable. Rotate deliberately:

1. Ask users to re-enter keys (or re-encrypt with both secrets in a migration script), then
2. swap the env var and redeploy.

### Backups

- Postgres: normal automated backups.
- File store: snapshot `.data/` (store JSON + generated media).
- Client projects: IndexedDB is local-only; cloud copies come from autosave (`/api/projects`).

### Observability

- Agent runs are persisted with tokens, cost, steps, tool count and duration.
- `audit()` records provider connects, settings changes and run summaries (no prompt bodies).
- Add Sentry/OTel at `app/api/ai/chat/route.ts` `onFinish` and `catch` boundaries; nothing else is server-heavy.

---

## 6. Performance

- The renderer is canvas-2D and resolution-capped during interaction; preview/export use full resolution.
- Thumbnails in the dashboard render at `quality={0.7}`.
- Autosave is throttled (25 s) and layer-capped (300) before cloud upload.
- The editor hides the Inspector below `lg` and shows a desktop-only notice under 1024 px.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `provider_missing` on every run | no key connected | `/settings/ai` → Test connection → Save |
| `Test connection` fails 401 | wrong/revoked key | re-enter the key |
| 404 from a provider | model id not served by that key | pick from the live model dropdown |
| 429 | provider quota or Prism rate limit | wait, raise the limit, or set a fallback provider |
| MP4 downloads as WebM | browser has no H.264 `MediaRecorder` | use Chromium, or accept WebM (a note is shown) |
| Generated images disappear after a while | serverless ephemeral disk | mount a volume or use S3/Supabase Storage |
| Share link 404 after deploy | file store lost | use Postgres (shares live in `prism_shares` / the user row) or keep `.data` on a volume |
| Fonts look generic | Google Fonts blocked by network | self-host the fonts referenced in `lib/data/library.ts` |

---

## 8. Checklist

- [ ] `PRISM_SECRET` set, backed up
- [ ] `NEXT_PUBLIC_APP_URL` matches the deployment origin
- [ ] `db/001_init.sql` applied (if using Postgres)
- [ ] durable storage for generated media
- [ ] rate limits sized for the audience
- [ ] auth wired if multi-tenant
- [ ] `.data/` volume or managed DB backups
- [ ] smoke test: connect a provider → run one agent prompt → export PNG → open a share link

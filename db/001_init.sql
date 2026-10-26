-- ═══════════════════════════════════════════════════════════════════════════
--  PRISM — initial schema (Postgres 14+ / Supabase)
--  Run with:  psql "$DATABASE_URL" -f db/001_init.sql
--
--  Prism is local-first: without DATABASE_URL it persists to
--  .data/prism-store.json. With DATABASE_URL it writes one JSONB row per user,
--  which keeps provider secrets, settings, usage, runs and cloud projects
--  consistent without a migration per feature.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── Users ──────────────────────────────────────────────────────────────────
-- data: { id, createdAt, role, providers, settings, usage[], runs[], projects }
-- providers[].key is an AES-256-GCM box: { v, iv, tag, data } (base64).
create table if not exists prism_users (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

create index if not exists prism_users_updated_idx on prism_users (updated_at desc);

-- ── Share links (public, no auth required) ─────────────────────────────────
-- Also written to the JSON store's `shares` map on file deployments.
create table if not exists prism_shares (
  id             text primary key,
  project_id     text not null,
  owner_id       text references prism_users (id) on delete set null,
  name           text not null,
  data           jsonb not null,                 -- frozen project snapshot
  allow_comments boolean not null default true,
  revoked        boolean not null default false,
  comments       jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists prism_shares_project_idx on prism_shares (project_id);
create index if not exists prism_shares_owner_idx on prism_shares (owner_id);

-- ── Audit log ──────────────────────────────────────────────────────────────
-- Every provider connect/disconnect, settings change and agent run is recorded
-- without prompt contents. Retention is capped in-app to the 500 newest rows.
create table if not exists prism_audit (
  id      bigserial primary key,
  at      timestamptz not null default now(),
  user_id text not null,
  action  text not null,
  detail  text
);

create index if not exists prism_audit_user_idx on prism_audit (user_id, at desc);

-- ── Row-level security (Supabase) ──────────────────────────────────────────
-- Prism's own cookie session bypasses RLS through the service role. If you
-- switch to Supabase Auth, uncomment and adapt the policies below.
--
-- alter table prism_users enable row level security;
-- create policy "own row" on prism_users
--   for all using (id = auth.uid()::text) with check (id = auth.uid()::text);
--
-- alter table prism_shares enable row level security;
-- create policy "public read" on prism_shares
--   for select using (revoked = false);
-- create policy "owner write" on prism_shares
--   for all using (owner_id = auth.uid()::text) with check (owner_id = auth.uid()::text);

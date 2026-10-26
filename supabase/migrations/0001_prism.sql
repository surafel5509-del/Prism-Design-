-- PRISM — Supabase/Postgres migration (production multi-user path)
-- Mirrors prisma/schema.prisma. Provider keys store AES-256-GCM ciphertext only.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  role text not null default 'editor' check (role in ('owner','editor','viewer')),
  unique (user_id, workspace_id)
);

create table if not exists public.projects (
  id text primary key,
  name text not null,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid references public.workspaces (id),
  document jsonb not null,
  width int not null,
  height int not null,
  duration double precision not null,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_owner_updated_idx on public.projects (owner_id, updated_at desc);

create table if not exists public.project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects (id) on delete cascade,
  document jsonb not null,
  label text,
  created_at timestamptz not null default now()
);

create table if not exists public.provider_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('openai','anthropic','google','openrouter','deepseek','groq','together','fireworks','ollama','custom')),
  ciphertext text not null,
  base_url text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  project_id text references public.projects (id) on delete set null,
  provider text not null,
  model text not null,
  mode text not null default 'agent',
  prompt text not null,
  tool_log jsonb not null default '[]'::jsonb,
  status text not null default 'running',
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  total_tokens int not null default 0,
  steps int not null default 0,
  duration_ms int,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists agent_runs_user_created_idx on public.agent_runs (user_id, created_at desc);

create table if not exists public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  colors text[] not null default '{}',
  fonts jsonb not null default '{}'::jsonb,
  voice text,
  created_at timestamptz not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  url text not null,
  name text not null,
  bytes bigint,
  created_at timestamptz not null default now()
);

-- Row Level Security: users only ever see their own rows.
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.provider_keys enable row level security;
alter table public.agent_runs enable row level security;
alter table public.brand_kits enable row level security;
alter table public.assets enable row level security;

create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own projects" on public.projects for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "own keys" on public.provider_keys for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own runs" on public.agent_runs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own kits" on public.brand_kits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own assets" on public.assets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

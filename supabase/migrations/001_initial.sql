-- ARCenter Supabase schema
-- Run in Supabase SQL Editor before deploying the application.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  photo_url text,
  personal_rules jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.groups (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  parent_id text,
  project_address text,
  project_addresses jsonb not null default '[]'::jsonb,
  lot_area text,
  site_investigation text,
  is_project boolean not null default false,
  urls jsonb not null default '[]'::jsonb,
  files jsonb not null default '[]'::jsonb,
  building_overview jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists groups_owner_id_idx on public.groups(owner_id);
create index if not exists groups_parent_id_idx on public.groups(parent_id);

create table if not exists public.chat_sessions (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  group_id text not null references public.groups(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  is_archived boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists chat_sessions_owner_group_idx
  on public.chat_sessions(owner_id, group_id);

create table if not exists public.chat_messages (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  group_id text not null references public.groups(id) on delete cascade,
  session_id text not null references public.chat_sessions(id) on delete cascade,
  text text not null,
  sender text not null check (sender in ('user', 'model', 'system', 'ai')),
  timestamp timestamptz not null default now(),
  url_context jsonb not null default '[]'::jsonb,
  grounding_chunks jsonb not null default '[]'::jsonb,
  was_search_enabled boolean,
  suggested_rules jsonb not null default '[]'::jsonb
);

create index if not exists chat_messages_session_timestamp_idx
  on public.chat_messages(session_id, timestamp);

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "profiles_owner_all" on public.profiles;
create policy "profiles_owner_all"
on public.profiles
for all
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "groups_owner_all" on public.groups;
create policy "groups_owner_all"
on public.groups
for all
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "sessions_owner_all" on public.chat_sessions;
create policy "sessions_owner_all"
on public.chat_sessions
for all
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "messages_owner_all" on public.chat_messages;
create policy "messages_owner_all"
on public.chat_messages
for all
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('knowledge-files', 'knowledge-files', false, 26214400)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "knowledge_files_select_own" on storage.objects;
create policy "knowledge_files_select_own"
on storage.objects
for select
using (
  bucket_id = 'knowledge-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "knowledge_files_insert_own" on storage.objects;
create policy "knowledge_files_insert_own"
on storage.objects
for insert
with check (
  bucket_id = 'knowledge-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "knowledge_files_update_own" on storage.objects;
create policy "knowledge_files_update_own"
on storage.objects
for update
using (
  bucket_id = 'knowledge-files'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'knowledge-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "knowledge_files_delete_own" on storage.objects;
create policy "knowledge_files_delete_own"
on storage.objects
for delete
using (
  bucket_id = 'knowledge-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.groups;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.chat_sessions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null;
end $$;

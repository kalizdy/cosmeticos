-- BIM Cosmetics · esquema mínimo para sincronización de catálogo.
-- Ejecuta este bloque UNA vez en Supabase → SQL Editor → New query → Run.
-- La app usa una sola fila (id = 'main') con el snapshot completo en JSONB.

create table if not exists public.bim_cloud (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.bim_cloud enable row level security;

drop policy if exists "bim_cloud_select" on public.bim_cloud;
drop policy if exists "bim_cloud_insert" on public.bim_cloud;
drop policy if exists "bim_cloud_update" on public.bim_cloud;

create policy "bim_cloud_select"
  on public.bim_cloud for select
  to anon, authenticated
  using (true);

create policy "bim_cloud_insert"
  on public.bim_cloud for insert
  to anon, authenticated
  with check (id = 'main');

create policy "bim_cloud_update"
  on public.bim_cloud for update
  to anon, authenticated
  using (id = 'main')
  with check (id = 'main');

grant select, insert, update on public.bim_cloud to anon, authenticated;

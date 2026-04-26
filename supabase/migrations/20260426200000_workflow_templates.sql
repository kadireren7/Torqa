-- Dashboard: user-scoped workflow JSON templates (library) for re-run scans.

create table public.workflow_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  source text not null check (source in ('n8n', 'generic')),
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.workflow_templates is 'Saved workflow JSON per user; content is a parsed object root (not executed server-side except via /api/scan).';

create index workflow_templates_user_updated_idx
  on public.workflow_templates (user_id, updated_at desc);

alter table public.workflow_templates enable row level security;

create policy workflow_templates_select_own on public.workflow_templates
  for select using (user_id = auth.uid());

create policy workflow_templates_insert_own on public.workflow_templates
  for insert with check (user_id = auth.uid());

create policy workflow_templates_update_own on public.workflow_templates
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy workflow_templates_delete_own on public.workflow_templates
  for delete using (user_id = auth.uid());

grant select, insert, update, delete on public.workflow_templates to authenticated;
grant all on public.workflow_templates to service_role;

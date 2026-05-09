-- v0.4.1 — Governance Playbooks

create table if not exists public.playbooks (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  trigger         jsonb not null default '{}',
  conditions      jsonb not null default '[]',
  actions         jsonb not null default '[]',
  enabled         boolean not null default true,
  last_run_at     timestamptz,
  last_run_status text check (last_run_status in ('success','partial','failed')),
  run_count       integer not null default 0,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.playbooks enable row level security;

create policy "users_read_own_playbooks"
  on public.playbooks for select
  using (
    user_id = auth.uid() or
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

create policy "users_manage_own_playbooks"
  on public.playbooks for all
  using (user_id = auth.uid());

-- Playbook execution log
create table if not exists public.playbook_runs (
  id              uuid primary key default gen_random_uuid(),
  playbook_id     uuid not null references public.playbooks(id) on delete cascade,
  triggered_by    text not null default 'manual'
                  check (triggered_by in ('manual','scan','schedule','webhook')),
  trigger_ref     text,        -- scan_id or schedule_id that fired it
  status          text not null default 'pending'
                  check (status in ('pending','running','success','partial','failed')),
  actions_total   integer not null default 0,
  actions_ok      integer not null default 0,
  log             jsonb not null default '[]',
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz
);

create index if not exists playbook_runs_playbook_id_idx
  on public.playbook_runs (playbook_id, started_at desc);

create index if not exists playbook_runs_user_id_idx
  on public.playbook_runs (user_id, started_at desc);

alter table public.playbook_runs enable row level security;

create policy "users_read_own_runs"
  on public.playbook_runs for select
  using (user_id = auth.uid());

create policy "users_insert_runs"
  on public.playbook_runs for insert
  with check (user_id = auth.uid());

-- Seed: 3 example playbooks (disabled by default — won't fire)
-- Users can clone/enable them
insert into public.playbooks
  (name, description, trigger, conditions, actions, enabled, user_id)
values
  (
    'Auto fix on FAIL',
    'When a scan fails, automatically create a draft GitHub PR with fix proposals.',
    '{"type":"scan.fail"}',
    '[]',
    '[{"type":"github.create_pr","config":{"draft":true,"label":"torqa-auto-fix"}},{"type":"notify.slack","config":{"message":"🔴 Scan FAIL — fix PR opened for {{workflow_name}}"}}]',
    false,
    (select id from auth.users limit 1)
  ),
  (
    'NEEDS REVIEW → Slack',
    'Notify the security Slack channel whenever a scan needs review.',
    '{"type":"scan.review"}',
    '[]',
    '[{"type":"notify.slack","config":{"message":"⚠️ {{workflow_name}} needs governance review (score: {{trust_score}})"}}]',
    false,
    (select id from auth.users limit 1)
  ),
  (
    'Low trust score alert',
    'Send an alert when any workflow trust score drops below 60.',
    '{"type":"trust_score.below","config":{"threshold":60}}',
    '[]',
    '[{"type":"notify.slack","config":{"message":"⚡ Trust score dropped to {{trust_score}} for {{workflow_name}}"}},{"type":"scan.rescan","config":{"delay_minutes":30}}]',
    false,
    (select id from auth.users limit 1)
  )
on conflict do nothing;

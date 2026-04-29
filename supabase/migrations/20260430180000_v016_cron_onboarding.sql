-- v0.1.6: custom cron on scan_schedules + per-user onboarding progress (wizard / checklist hints).
-- Idempotent: safe to re-run after partial apply or `supabase db push` retry (policies/trigger recreated).

-- ---------------------------------------------------------------------------
-- Custom cron cadence (optional; frequency = 'custom' requires cron_expression)
-- ---------------------------------------------------------------------------

alter table public.scan_schedules drop constraint if exists scan_schedules_frequency_check;

alter table public.scan_schedules
  add constraint scan_schedules_frequency_check
  check (frequency in ('daily', 'weekly', 'manual', 'custom'));

alter table public.scan_schedules
  add column if not exists cron_expression text,
  add column if not exists cron_timezone text not null default 'UTC';

comment on column public.scan_schedules.cron_expression is 'When frequency = custom: 5-field cron (minute hour day month weekday).';
comment on column public.scan_schedules.cron_timezone is 'IANA zone for interpreting cron_expression (default UTC).';

-- ---------------------------------------------------------------------------
-- Onboarding progress (wizard + optional manual step acknowledgements)
-- ---------------------------------------------------------------------------

create table if not exists public.user_onboarding_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  wizard_completed_at timestamptz,
  dismissed_checklist_at timestamptz,
  steps_ack jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.user_onboarding_progress is 'First-run wizard and optional checklist acknowledgements; RLS per user.';

alter table public.user_onboarding_progress enable row level security;

drop policy if exists user_onboarding_progress_select on public.user_onboarding_progress;
drop policy if exists user_onboarding_progress_insert on public.user_onboarding_progress;
drop policy if exists user_onboarding_progress_update on public.user_onboarding_progress;
drop policy if exists user_onboarding_progress_delete on public.user_onboarding_progress;

create policy user_onboarding_progress_select on public.user_onboarding_progress
  for select using (user_id = auth.uid());

create policy user_onboarding_progress_insert on public.user_onboarding_progress
  for insert with check (user_id = auth.uid());

create policy user_onboarding_progress_update on public.user_onboarding_progress
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy user_onboarding_progress_delete on public.user_onboarding_progress
  for delete using (user_id = auth.uid());

grant select, insert, update, delete on public.user_onboarding_progress to authenticated;
grant all on public.user_onboarding_progress to service_role;

drop trigger if exists user_onboarding_progress_updated_at on public.user_onboarding_progress;

create trigger user_onboarding_progress_updated_at
  before update on public.user_onboarding_progress
  for each row execute function public.set_updated_at();

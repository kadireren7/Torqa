-- In-app scan notifications + user delivery preferences (email/Slack placeholders at app layer).

create table public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email_alerts boolean not null default false,
  slack_webhook_url text,
  alert_on_fail boolean not null default true,
  alert_on_high_risk boolean not null default true,
  high_risk_threshold int not null default 50
    check (high_risk_threshold >= 0 and high_risk_threshold <= 100),
  updated_at timestamptz not null default now()
);

comment on table public.notification_preferences is 'Per-user scan alert toggles; email/Slack wired in dashboard (placeholders until provider integration).';
comment on column public.notification_preferences.high_risk_threshold is 'Notify when riskScore <= threshold or when findings include severity high (if alert_on_high_risk).';

create table public.in_app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

comment on table public.in_app_notifications is 'Dashboard bell feed; created when scan rules fire (FAIL / high-risk).';

create index in_app_notifications_user_created_idx
  on public.in_app_notifications (user_id, created_at desc);

create index in_app_notifications_user_unread_idx
  on public.in_app_notifications (user_id, read_at)
  where read_at is null;

alter table public.notification_preferences enable row level security;
alter table public.in_app_notifications enable row level security;

create policy notification_preferences_select_self on public.notification_preferences
  for select using (user_id = auth.uid());

create policy notification_preferences_upsert_self on public.notification_preferences
  for insert with check (user_id = auth.uid());

create policy notification_preferences_update_self on public.notification_preferences
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy in_app_notifications_select_self on public.in_app_notifications
  for select using (user_id = auth.uid());

create policy in_app_notifications_insert_self on public.in_app_notifications
  for insert with check (user_id = auth.uid());

create policy in_app_notifications_update_self on public.in_app_notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select, insert, update on public.in_app_notifications to authenticated;
grant all on public.notification_preferences to service_role;
grant all on public.in_app_notifications to service_role;

create trigger notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

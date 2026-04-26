-- API keys for server-to-server scan access + usage logs.

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  key_prefix text not null check (char_length(key_prefix) between 6 and 24),
  key_hash text not null unique,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.api_keys is 'User-managed API keys for POST /api/public/scan. Raw keys are never stored.';
comment on column public.api_keys.key_hash is 'SHA-256 digest (optionally peppered) of full API key.';

create index api_keys_user_created_idx
  on public.api_keys (user_id, created_at desc);

create index api_keys_user_active_idx
  on public.api_keys (user_id, revoked_at)
  where revoked_at is null;

create table public.api_key_usage_logs (
  id bigint generated always as identity primary key,
  api_key_id uuid references public.api_keys (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  source text,
  status_code int not null,
  success boolean not null,
  error_code text,
  request_ip text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

comment on table public.api_key_usage_logs is 'Append-only audit trail for API key requests.';

create index api_key_usage_logs_user_created_idx
  on public.api_key_usage_logs (user_id, created_at desc);

create index api_key_usage_logs_key_created_idx
  on public.api_key_usage_logs (api_key_id, created_at desc);

alter table public.api_keys enable row level security;
alter table public.api_key_usage_logs enable row level security;

create policy api_keys_select_self on public.api_keys
  for select using (user_id = auth.uid());

create policy api_keys_insert_self on public.api_keys
  for insert with check (user_id = auth.uid());

create policy api_keys_update_self on public.api_keys
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy api_key_usage_logs_select_self on public.api_key_usage_logs
  for select using (user_id = auth.uid());

create policy api_key_usage_logs_insert_self on public.api_key_usage_logs
  for insert with check (user_id = auth.uid());

grant select, insert, update on public.api_keys to authenticated;
grant select on public.api_key_usage_logs to authenticated;
grant all on public.api_keys to service_role;
grant all on public.api_key_usage_logs to service_role;

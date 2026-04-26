-- Shareable scan reports: opaque share_id on scan_history.
-- Public read is only via SECURITY DEFINER RPC (no broad anon access to scan_history).

alter table public.scan_history
  add column if not exists share_id text;

comment on column public.scan_history.share_id is 'Opaque token; anyone with the link can view this scan snapshot via get_scan_by_share_id.';

create unique index scan_history_share_id_uq
  on public.scan_history (share_id)
  where share_id is not null;

-- Owner may set or rotate share_id on their own rows only.
create policy scan_history_update_own on public.scan_history
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

grant update on public.scan_history to authenticated;

-- Public snapshot read: single row by share_id, limited columns (no user_id).
create or replace function public.get_scan_by_share_id(p_share_id text)
returns table (
  result jsonb,
  source text,
  workflow_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select sh.result, sh.source, sh.workflow_name, sh.created_at
  from public.scan_history sh
  where sh.share_id is not null
    and sh.share_id = p_share_id
  limit 1;
$$;

comment on function public.get_scan_by_share_id(text) is 'Returns one saved scan snapshot for a valid share_id; callable with anon key from API.';

revoke all on function public.get_scan_by_share_id(text) from public;
grant execute on function public.get_scan_by_share_id(text) to anon, authenticated;
grant execute on function public.get_scan_by_share_id(text) to service_role;

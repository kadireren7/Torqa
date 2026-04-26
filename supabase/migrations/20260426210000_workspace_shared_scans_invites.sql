-- Team workspace: shared scan_history / workflow_templates scoped by organization_id,
-- plus pending email invites (admin/member roles). Reuses existing organizations + organization_members.

-- ---------------------------------------------------------------------------
-- Scope dashboard tables to optional workspace (NULL = personal library)
-- ---------------------------------------------------------------------------
alter table public.scan_history
  add column if not exists organization_id uuid references public.organizations (id) on delete cascade;

comment on column public.scan_history.organization_id is 'When set, all org members may read this scan (shared history). NULL = personal.';

create index if not exists scan_history_org_created_idx
  on public.scan_history (organization_id, created_at desc)
  where organization_id is not null;

create index if not exists scan_history_personal_idx
  on public.scan_history (user_id, created_at desc)
  where organization_id is null;

alter table public.workflow_templates
  add column if not exists organization_id uuid references public.organizations (id) on delete cascade;

comment on column public.workflow_templates.organization_id is 'When set, templates are visible to all org members. NULL = personal.';

create index if not exists workflow_templates_org_updated_idx
  on public.workflow_templates (organization_id, updated_at desc)
  where organization_id is not null;

-- ---------------------------------------------------------------------------
-- Pending invites (token accept flow; email must match auth on accept)
-- ---------------------------------------------------------------------------
create table public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email citext not null,
  role text not null check (role in ('admin', 'member')),
  token uuid not null default gen_random_uuid() unique,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

comment on table public.organization_invites is 'Pending workspace invites; accept via accept_organization_invite(token).';

create unique index organization_invites_org_email_uq
  on public.organization_invites (organization_id, email);

create index organization_invites_org_idx on public.organization_invites (organization_id);

alter table public.organization_invites enable row level security;

create policy organization_invites_select_admin on public.organization_invites
  for select using (public.can_admin_org(organization_id));

create policy organization_invites_insert_admin on public.organization_invites
  for insert with check (
    public.can_admin_org(organization_id)
    and invited_by = auth.uid()
  );

create policy organization_invites_delete_admin on public.organization_invites
  for delete using (public.can_admin_org(organization_id));

grant select, insert, delete on public.organization_invites to authenticated;
grant all on public.organization_invites to service_role;

-- ---------------------------------------------------------------------------
-- scan_history RLS (replace personal-only policies)
-- ---------------------------------------------------------------------------
drop policy if exists scan_history_select_own on public.scan_history;
drop policy if exists scan_history_insert_own on public.scan_history;
drop policy if exists scan_history_delete_own on public.scan_history;
drop policy if exists scan_history_update_own on public.scan_history;

create policy scan_history_select on public.scan_history
  for select using (
    (organization_id is null and user_id = auth.uid())
    or (organization_id is not null and public.is_org_member(organization_id))
  );

create policy scan_history_insert on public.scan_history
  for insert with check (
    user_id = auth.uid()
    and (
      organization_id is null
      or (organization_id is not null and public.is_org_member(organization_id))
    )
  );

create policy scan_history_delete on public.scan_history
  for delete using (
    user_id = auth.uid()
    or (organization_id is not null and public.can_admin_org(organization_id))
  );

create policy scan_history_update on public.scan_history
  for update using (
    user_id = auth.uid()
    or (organization_id is not null and public.can_admin_org(organization_id))
  )
  with check (
    user_id = auth.uid()
    or (organization_id is not null and public.can_admin_org(organization_id))
  );

-- ---------------------------------------------------------------------------
-- workflow_templates RLS
-- ---------------------------------------------------------------------------
drop policy if exists workflow_templates_select_own on public.workflow_templates;
drop policy if exists workflow_templates_insert_own on public.workflow_templates;
drop policy if exists workflow_templates_update_own on public.workflow_templates;
drop policy if exists workflow_templates_delete_own on public.workflow_templates;

create policy workflow_templates_select on public.workflow_templates
  for select using (
    (organization_id is null and user_id = auth.uid())
    or (organization_id is not null and public.is_org_member(organization_id))
  );

create policy workflow_templates_insert on public.workflow_templates
  for insert with check (
    user_id = auth.uid()
    and (
      organization_id is null
      or (organization_id is not null and public.is_org_member(organization_id))
    )
  );

create policy workflow_templates_update on public.workflow_templates
  for update using (
    user_id = auth.uid()
    or (organization_id is not null and public.can_admin_org(organization_id))
  )
  with check (
    user_id = auth.uid()
    or (organization_id is not null and public.can_admin_org(organization_id))
  );

create policy workflow_templates_delete on public.workflow_templates
  for delete using (
    user_id = auth.uid()
    or (organization_id is not null and public.can_admin_org(organization_id))
  );

-- ---------------------------------------------------------------------------
-- RPC: invite + accept
-- ---------------------------------------------------------------------------
create or replace function public.invite_organization_member(
  p_organization_id uuid,
  p_email citext,
  p_role text
)
returns table (token uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'invite_organization_member requires an authenticated user';
  end if;
  if not public.can_admin_org(p_organization_id) then
    raise exception 'not allowed to invite for this organization';
  end if;
  if p_role is null or p_role not in ('admin', 'member') then
    raise exception 'role must be admin or member';
  end if;

  delete from public.organization_invites i
  where i.organization_id = p_organization_id
    and i.email = trim(both from p_email::text)::citext;

  return query
  insert into public.organization_invites (organization_id, email, role, invited_by, expires_at)
  values (
    p_organization_id,
    trim(both from p_email::text)::citext,
    p_role,
    auth.uid(),
    now() + interval '14 days'
  )
  returning organization_invites.token, organization_invites.expires_at;
end;
$$;

revoke all on function public.invite_organization_member(uuid, citext, text) from public;
grant execute on function public.invite_organization_member(uuid, citext, text) to authenticated;
grant execute on function public.invite_organization_member(uuid, citext, text) to service_role;

create or replace function public.accept_organization_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.organization_invites%rowtype;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'accept_organization_invite requires an authenticated user';
  end if;

  select * into v_inv
  from public.organization_invites
  where token = p_token;

  if not found then
    raise exception 'invalid or expired invite';
  end if;

  if v_inv.expires_at < now() then
    delete from public.organization_invites where id = v_inv.id;
    raise exception 'invite expired';
  end if;

  select email::text into v_email from auth.users where id = auth.uid();
  if lower(v_email) <> lower(v_inv.email::text) then
    raise exception 'signed-in email does not match invite';
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_inv.organization_id, auth.uid(), v_inv.role)
  on conflict (organization_id, user_id) do update set role = excluded.role;

  delete from public.organization_invites where id = v_inv.id;
  return v_inv.organization_id;
end;
$$;

revoke all on function public.accept_organization_invite(uuid) from public;
grant execute on function public.accept_organization_invite(uuid) to authenticated;
grant execute on function public.accept_organization_invite(uuid) to service_role;

-- List members with emails (caller must be org member)
create or replace function public.workspace_members(p_organization_id uuid)
returns table (user_id uuid, email text, role text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, u.email::text, m.role, m.created_at
  from public.organization_members m
  join auth.users u on u.id = m.user_id
  where m.organization_id = p_organization_id
    and public.is_org_member(p_organization_id);
$$;

revoke all on function public.workspace_members(uuid) from public;
grant execute on function public.workspace_members(uuid) to authenticated;
grant execute on function public.workspace_members(uuid) to service_role;

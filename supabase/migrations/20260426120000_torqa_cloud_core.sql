-- Torqa cloud core: orgs, projects, policies, validation runs, reports.
-- Requires Supabase (PostgreSQL). Auth: Supabase Auth (auth.users).

-- Extensions -----------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users; dashboard identity)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Application user row; mirrors Supabase Auth.';

create index profiles_created_at_idx on public.profiles (created_at desc);

-- ---------------------------------------------------------------------------
-- Organizations & membership
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug citext not null unique,
  name text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

comment on table public.organizations is 'Tenant boundary for Torqa cloud (billing, RLS, audit).';

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

comment on table public.organization_members is 'Org RBAC: owner > admin > member > viewer.';

create index organization_members_user_idx on public.organization_members (user_id);

-- ---------------------------------------------------------------------------
-- Projects (specs / repos live under a project)
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  default_policy_id uuid,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
  unique (organization_id, slug)
);

comment on table public.projects is 'Unit of work for validation runs and dashboard scope.';

create index projects_org_idx on public.projects (organization_id);

-- ---------------------------------------------------------------------------
-- Policies (trust profile binding + future rule overlays)
-- ---------------------------------------------------------------------------
create table public.policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  slug text not null,
  name text not null,
  trust_profile text not null check (
    trust_profile in ('default', 'strict', 'review-heavy', 'enterprise')
  ),
  fail_on_warning boolean not null default false,
  rules_overrides jsonb not null default '{}'::jsonb,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.policies is 'Torqa policy binding: built-in trust_profile plus optional JSON overrides for future engines.';

create unique index policies_org_global_slug_uq
  on public.policies (organization_id, slug)
  where project_id is null;

create unique index policies_project_slug_uq
  on public.policies (organization_id, project_id, slug)
  where project_id is not null;

create index policies_org_project_idx on public.policies (organization_id, project_id);

alter table public.projects
  add constraint projects_default_policy_fk
  foreign key (default_policy_id) references public.policies (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Validation runs (immutable outcome of a gate execution)
-- ---------------------------------------------------------------------------
create table public.validation_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  policy_id uuid references public.policies (id) on delete set null,
  trust_profile text not null check (
    trust_profile in ('default', 'strict', 'review-heavy', 'enterprise')
  ),
  fail_on_warning boolean not null default false,
  source text not null default 'unknown' check (
    source in ('dashboard', 'github_action', 'api', 'cli', 'unknown')
  ),
  status text not null default 'queued' check (
    status in ('queued', 'running', 'succeeded', 'failed', 'canceled')
  ),
  summary jsonb,
  result_json jsonb,
  exit_code smallint,
  result_ok boolean,
  idempotency_key text,
  client_correlation_id uuid not null default gen_random_uuid(),
  created_by uuid references public.profiles (id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.validation_runs is 'One Torqa scan/validate execution; result_json aligns with torqa.cli.scan.v1 or torqa.cli.validate.v1 when present.';

create index validation_runs_project_created_idx
  on public.validation_runs (project_id, created_at desc);

create unique index validation_runs_idempotency_uq
  on public.validation_runs (project_id, idempotency_key)
  where idempotency_key is not null;

-- ---------------------------------------------------------------------------
-- Reports (normalized artifacts; optional Storage pointer)
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  validation_run_id uuid not null references public.validation_runs (id) on delete cascade,
  schema_kind text not null check (
    schema_kind in (
      'torqa.cli.scan.v1',
      'torqa.cli.validate.v1',
      'torqa.report.html',
      'torqa.report.md',
      'custom'
    )
  ),
  payload jsonb,
  storage_object_path text,
  content_type text,
  byte_size bigint,
  created_at timestamptz not null default now()
);

comment on table public.reports is 'Per-artifact report row (JSON/HTML/MD or custom); large blobs can use Supabase Storage + storage_object_path.';

create index reports_run_idx on public.reports (validation_run_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger policies_updated_at
  before update on public.policies
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth: provision profile on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helpers (invoker: evaluated with caller rights; uses auth.uid())
-- ---------------------------------------------------------------------------
create or replace function public.organization_role(p_organization_id uuid)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select m.role
  from public.organization_members m
  where m.organization_id = p_organization_id
    and m.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.organization_role(p_organization_id) is not null;
$$;

create or replace function public.project_role(p_project_id uuid)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select m.role
  from public.projects p
  join public.organization_members m
    on m.organization_id = p.organization_id
  where p.id = p_project_id
    and m.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.can_write_project(p_project_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.project_role(p_project_id) in ('owner', 'admin', 'member');
$$;

create or replace function public.can_admin_org(p_organization_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.organization_role(p_organization_id) in ('owner', 'admin');
$$;

-- Bootstrap org + owner membership (callable by authenticated user)
create or replace function public.create_organization(p_name text, p_slug citext)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'create_organization requires an authenticated user';
  end if;
  insert into public.organizations (name, slug, created_by)
  values (p_name, p_slug, auth.uid())
  returning id into v_org;
  insert into public.organization_members (organization_id, user_id, role)
  values (v_org, auth.uid(), 'owner');
  return v_org;
end;
$$;

revoke all on function public.create_organization(text, citext) from public;
grant execute on function public.create_organization(text, citext) to authenticated;
grant execute on function public.create_organization(text, citext) to service_role;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects enable row level security;
alter table public.policies enable row level security;
alter table public.validation_runs enable row level security;
alter table public.reports enable row level security;

-- Profiles: self only
create policy profiles_select_self on public.profiles
  for select using (id = auth.uid());

create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Organizations: members read; creator can read before first membership row (bootstrap)
create policy organizations_select_member on public.organizations
  for select using (
    deleted_at is null
    and (
      public.is_org_member(id)
      or created_by = auth.uid()
    )
  );

create policy organizations_update_admin on public.organizations
  for update using (public.can_admin_org(id)) with check (public.can_admin_org(id));

-- Inserts only via create_organization RPC for normal users; service role bypasses RLS
create policy organizations_insert_creator on public.organizations
  for insert with check (created_by = auth.uid());

-- Organization members: visible to org members; mutations for admins (+ self leave optional later)
create policy organization_members_select on public.organization_members
  for select using (public.is_org_member(organization_id));

create policy organization_members_insert_admin on public.organization_members
  for insert with check (public.can_admin_org(organization_id));

-- First owner row when org has no members yet (pairs with organizations insert from client)
create policy organization_members_insert_bootstrap_owner on public.organization_members
  for insert with check (
    user_id = auth.uid()
    and role = 'owner'
    and exists (
      select 1 from public.organizations o
      where o.id = organization_id
        and o.created_by = auth.uid()
    )
    and not exists (
      select 1 from public.organization_members existing
      where existing.organization_id = organization_id
    )
  );

create policy organization_members_update_admin on public.organization_members
  for update using (public.can_admin_org(organization_id))
  with check (public.can_admin_org(organization_id));

create policy organization_members_delete_admin on public.organization_members
  for delete using (public.can_admin_org(organization_id));

-- Projects: any org member may read (including archived for audit)
create policy projects_select_member on public.projects
  for select using (public.is_org_member(organization_id));

create policy projects_insert_member on public.projects
  for insert with check (
    public.organization_role(organization_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
  );

create policy projects_update_writer on public.projects
  for update using (
    public.project_role(id) in ('owner', 'admin', 'member')
  )
  with check (
    public.project_role(id) in ('owner', 'admin', 'member')
  );

create policy projects_delete_admin on public.projects
  for delete using (public.project_role(id) in ('owner', 'admin'));

-- Policies: archived rows visible to org admins (restore / audit)
create policy policies_select_member on public.policies
  for select using (
    public.is_org_member(organization_id)
    and (project_id is null or public.project_role(project_id) is not null)
    and (
      not is_archived
      or public.can_admin_org(organization_id)
    )
  );

create policy policies_insert_writer on public.policies
  for insert with check (
    public.organization_role(organization_id) in ('owner', 'admin', 'member')
    and (project_id is null or public.can_write_project(project_id))
  );

create policy policies_update_writer on public.policies
  for update using (
    public.organization_role(organization_id) in ('owner', 'admin', 'member')
    and (project_id is null or public.can_write_project(project_id))
  )
  with check (
    public.organization_role(organization_id) in ('owner', 'admin', 'member')
    and (project_id is null or public.can_write_project(project_id))
  );

create policy policies_delete_admin on public.policies
  for delete using (public.can_admin_org(organization_id));

-- Validation runs: read any org role with project access; insert member+; no client updates (workers use service role)
create policy validation_runs_select on public.validation_runs
  for select using (public.project_role(project_id) is not null);

create policy validation_runs_insert on public.validation_runs
  for insert with check (
    public.can_write_project(project_id)
    and (created_by is null or created_by = auth.uid())
  );

-- Reports: same visibility as parent run
create policy reports_select on public.reports
  for select using (
    exists (
      select 1 from public.validation_runs r
      where r.id = validation_run_id
        and public.project_role(r.project_id) is not null
    )
  );

create policy reports_insert on public.reports
  for insert with check (
    exists (
      select 1 from public.validation_runs r
      where r.id = validation_run_id
        and public.can_write_project(r.project_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Grants (PostgREST: authenticated JWT only for tenant tables)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.policies to authenticated;
grant select, insert, update, delete on public.validation_runs to authenticated;
grant select, insert, update, delete on public.reports to authenticated;

grant all on public.profiles to service_role;
grant all on public.organizations to service_role;
grant all on public.organization_members to service_role;
grant all on public.projects to service_role;
grant all on public.policies to service_role;
grant all on public.validation_runs to service_role;
grant all on public.reports to service_role;

grant execute on function public.organization_role(uuid) to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.project_role(uuid) to authenticated;
grant execute on function public.can_write_project(uuid) to authenticated;
grant execute on function public.can_admin_org(uuid) to authenticated;

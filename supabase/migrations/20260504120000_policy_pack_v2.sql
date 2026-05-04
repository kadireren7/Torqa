-- v0.2.1 Block 2: Policy Pack v2.
-- Adds programmable, hierarchical policy packs:
--   * `policy_packs` table — workspace/source-scoped, with inheritance chain.
--   * Each pack carries a structured `rules` jsonb array (validated app-side).
--   * Inherits via parent_pack_id (self-FK) and/or parent_template_slug.
--
-- The legacy `workspace_policies` (threshold-only) stays in place; the v2 packs
-- ride alongside and are explicitly opted-in per scan via `policyPackId`.

create table public.policy_packs (
  id                     uuid        primary key default gen_random_uuid(),
  user_id                uuid        not null references auth.users (id) on delete cascade,
  organization_id        uuid        references public.organizations (id) on delete cascade,
  name                   text        not null check (char_length(name) between 1 and 200),
  slug                   text        not null check (char_length(slug) between 1 and 80),
  description            text,
  level                  text        not null check (level in ('workspace', 'source')),
  source_type            text        check (
    source_type is null
    or source_type in ('n8n', 'generic', 'github', 'ai-agent')
  ),
  parent_pack_id         uuid        references public.policy_packs (id) on delete set null,
  parent_template_slug   text        references public.policy_templates (slug) on delete set null,
  default_verdict        text        not null default 'pass'
                                  check (default_verdict in ('pass', 'review', 'block')),
  rules                  jsonb       not null default '[]'::jsonb,
  enabled                boolean     not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  -- Source-level packs must specify a source_type; workspace-level must not.
  constraint policy_packs_level_source_consistency
    check (
      (level = 'source' and source_type is not null)
      or (level = 'workspace' and source_type is null)
    )
);

comment on table public.policy_packs is
  'Programmable governance packs (v0.2.1). Holds structured rules + inheritance for the v2 evaluator.';
comment on column public.policy_packs.rules is
  'Array of structured rule objects. Validated by the dashboard before insert/update.';
comment on column public.policy_packs.parent_pack_id is
  'Optional in-table inheritance: child overrides parent rules + default_verdict.';
comment on column public.policy_packs.parent_template_slug is
  'Optional cross-table inheritance from a built-in policy_templates row.';

-- Workspace-scoped slug uniqueness (per org) and personal slug uniqueness (per user).
create unique index policy_packs_org_slug_uq
  on public.policy_packs (organization_id, slug)
  where organization_id is not null;
create unique index policy_packs_personal_slug_uq
  on public.policy_packs (user_id, slug)
  where organization_id is null;

create index policy_packs_org_created_idx
  on public.policy_packs (organization_id, created_at desc)
  where organization_id is not null;
create index policy_packs_user_created_idx
  on public.policy_packs (user_id, created_at desc);
create index policy_packs_parent_idx
  on public.policy_packs (parent_pack_id)
  where parent_pack_id is not null;

alter table public.policy_packs enable row level security;

create policy policy_packs_select on public.policy_packs
  for select using (
    (organization_id is null and user_id = auth.uid())
    or (organization_id is not null and public.is_org_member(organization_id))
  );

create policy policy_packs_insert on public.policy_packs
  for insert with check (
    user_id = auth.uid()
    and (
      organization_id is null
      or (organization_id is not null and public.can_admin_org(organization_id))
    )
  );

create policy policy_packs_update on public.policy_packs
  for update using (
    (organization_id is null and user_id = auth.uid())
    or (organization_id is not null and public.can_admin_org(organization_id))
  )
  with check (
    (organization_id is null and user_id = auth.uid())
    or (organization_id is not null and public.can_admin_org(organization_id))
  );

create policy policy_packs_delete on public.policy_packs
  for delete using (
    (organization_id is null and user_id = auth.uid())
    or (organization_id is not null and public.can_admin_org(organization_id))
  );

grant select, insert, update, delete on public.policy_packs to authenticated;
grant all on public.policy_packs to service_role;

create trigger policy_packs_updated_at
  before update on public.policy_packs
  for each row execute function public.set_updated_at();

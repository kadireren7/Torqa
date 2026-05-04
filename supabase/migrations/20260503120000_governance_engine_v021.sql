-- v0.2.1 Block 1: Governance Engine
-- Tables: workspace governance_mode, accepted_risks, applied_fixes,
--         governance_decisions, pending_approvals.
-- Enables Fix Engine + Operation Modes (autonomous/supervised/interactive)
-- + Accepted Risk Registry per CLAUDE.md.

-- ---------------------------------------------------------------
-- 1. Workspace governance_mode (per organization)
-- ---------------------------------------------------------------
alter table public.organizations
  add column if not exists governance_mode text
    not null
    default 'supervised'
    check (governance_mode in ('autonomous', 'supervised', 'interactive'));

comment on column public.organizations.governance_mode is
  'Active governance mode for this workspace. Controls fix-application behavior: autonomous applies safe fixes immediately, supervised queues approvals, interactive collects context before deciding.';

-- ---------------------------------------------------------------
-- 2. Accepted Risks Registry
-- ---------------------------------------------------------------
-- Findings the user has explicitly accepted as known risk.
-- Match key = finding_signature (deterministic hash of rule_id + target + source).
-- Filtered out of gate decision pre-return.
create table public.accepted_risks (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references auth.users (id) on delete cascade,
  organization_id    uuid        references public.organizations (id) on delete cascade,
  finding_signature  text        not null check (char_length(finding_signature) between 1 and 256),
  rule_id            text        not null,
  source             text        not null,
  target             text        not null,
  severity           text        not null check (severity in ('info','review','high','critical')),
  rationale          text        not null check (char_length(rationale) between 1 and 4000),
  accepted_by        uuid        not null references auth.users (id) on delete cascade,
  accepted_at        timestamptz not null default now(),
  expires_at         timestamptz,
  revoked_at         timestamptz,
  revoked_by         uuid        references auth.users (id) on delete set null,
  created_at         timestamptz not null default now()
);

comment on table public.accepted_risks is
  'Findings explicitly marked as accepted risk by an authorized user. Filtered from re-flagging until expiry or revocation.';

create unique index accepted_risks_active_signature_idx
  on public.accepted_risks (organization_id, finding_signature)
  where revoked_at is null and organization_id is not null;

create unique index accepted_risks_active_signature_personal_idx
  on public.accepted_risks (user_id, finding_signature)
  where revoked_at is null and organization_id is null;

create index accepted_risks_user_idx on public.accepted_risks (user_id);
create index accepted_risks_org_idx  on public.accepted_risks (organization_id) where organization_id is not null;
create index accepted_risks_signature_idx on public.accepted_risks (finding_signature) where revoked_at is null;

alter table public.accepted_risks enable row level security;

create policy accepted_risks_select on public.accepted_risks
  for select using (
    user_id = auth.uid()
    or (organization_id is not null and public.is_org_member(organization_id))
  );

create policy accepted_risks_insert on public.accepted_risks
  for insert with check (
    user_id = auth.uid()
    and (organization_id is null or public.is_org_member(organization_id))
  );

create policy accepted_risks_update on public.accepted_risks
  for update using (
    user_id = auth.uid()
    or (organization_id is not null and public.can_admin_org(organization_id))
  );

create policy accepted_risks_delete on public.accepted_risks
  for delete using (
    user_id = auth.uid()
    or (organization_id is not null and public.can_admin_org(organization_id))
  );

grant select, insert, update, delete on public.accepted_risks to authenticated;
grant all on public.accepted_risks to service_role;

-- ---------------------------------------------------------------
-- 3. Applied Fixes Log
-- ---------------------------------------------------------------
-- Every fix that has been applied to a workflow/agent definition,
-- including before/after diffs for audit and reversal.
create table public.applied_fixes (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references auth.users (id) on delete cascade,
  organization_id    uuid        references public.organizations (id) on delete cascade,
  scan_id            uuid,
  finding_signature  text        not null,
  rule_id            text        not null,
  source             text        not null,
  target             text        not null,
  fix_type           text        not null check (fix_type in ('safe_auto','structural','manual_required')),
  mode               text        not null check (mode in ('autonomous','supervised','interactive')),
  before_value       jsonb,
  after_value        jsonb,
  fix_patch          jsonb       not null default '[]'::jsonb,
  applied_by         uuid        not null references auth.users (id) on delete cascade,
  applied_at         timestamptz not null default now(),
  reverted_at        timestamptz,
  reverted_by        uuid        references auth.users (id) on delete set null
);

comment on table public.applied_fixes is
  'Audit log of all governance fixes applied to workflows/agents. Reversible.';

create index applied_fixes_user_idx on public.applied_fixes (user_id);
create index applied_fixes_org_idx  on public.applied_fixes (organization_id) where organization_id is not null;
create index applied_fixes_scan_idx on public.applied_fixes (scan_id) where scan_id is not null;
create index applied_fixes_signature_idx on public.applied_fixes (finding_signature);

alter table public.applied_fixes enable row level security;

create policy applied_fixes_select on public.applied_fixes
  for select using (
    user_id = auth.uid()
    or (organization_id is not null and public.is_org_member(organization_id))
  );

create policy applied_fixes_insert on public.applied_fixes
  for insert with check (
    user_id = auth.uid()
    and (organization_id is null or public.is_org_member(organization_id))
  );

create policy applied_fixes_update on public.applied_fixes
  for update using (
    user_id = auth.uid()
    or (organization_id is not null and public.can_admin_org(organization_id))
  );

grant select, insert, update on public.applied_fixes to authenticated;
grant all on public.applied_fixes to service_role;

-- ---------------------------------------------------------------
-- 4. Governance Decisions
-- ---------------------------------------------------------------
-- Every governance action recorded for audit:
--   apply_fix | accept_risk | revoke_risk | approve_fix | reject_fix
--   | mode_change | interactive_response
create table public.governance_decisions (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references auth.users (id) on delete cascade,
  organization_id    uuid        references public.organizations (id) on delete cascade,
  scan_id            uuid,
  finding_signature  text,
  decision_type      text        not null check (decision_type in (
    'apply_fix','accept_risk','revoke_risk','approve_fix','reject_fix',
    'mode_change','interactive_response'
  )),
  mode               text        check (mode in ('autonomous','supervised','interactive')),
  actor_user_id      uuid        not null references auth.users (id) on delete cascade,
  rationale          text,
  payload            jsonb       not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

comment on table public.governance_decisions is
  'Immutable log of every governance decision (fix, accept-risk, approval, mode-change). Drives audit timeline.';

create index governance_decisions_user_created_idx on public.governance_decisions (user_id, created_at desc);
create index governance_decisions_org_created_idx  on public.governance_decisions (organization_id, created_at desc) where organization_id is not null;
create index governance_decisions_scan_idx         on public.governance_decisions (scan_id) where scan_id is not null;
create index governance_decisions_signature_idx    on public.governance_decisions (finding_signature) where finding_signature is not null;

alter table public.governance_decisions enable row level security;

create policy governance_decisions_select on public.governance_decisions
  for select using (
    user_id = auth.uid()
    or (organization_id is not null and public.is_org_member(organization_id))
  );

create policy governance_decisions_insert on public.governance_decisions
  for insert with check (
    user_id = auth.uid()
    and (organization_id is null or public.is_org_member(organization_id))
  );

grant select, insert on public.governance_decisions to authenticated;
grant all on public.governance_decisions to service_role;

-- ---------------------------------------------------------------
-- 5. Pending Approvals (Supervised Mode Queue)
-- ---------------------------------------------------------------
-- Fix proposals awaiting human approval before application.
create table public.pending_approvals (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references auth.users (id) on delete cascade,
  organization_id    uuid        references public.organizations (id) on delete cascade,
  scan_id            uuid,
  finding_signature  text        not null,
  rule_id            text        not null,
  source             text        not null,
  target             text        not null,
  severity           text        not null check (severity in ('info','review','high','critical')),
  fix_type           text        not null check (fix_type in ('safe_auto','structural','manual_required')),
  fix_patch          jsonb       not null default '[]'::jsonb,
  before_value       jsonb,
  after_value        jsonb,
  explanation        text,
  status             text        not null default 'pending' check (status in ('pending','approved','rejected','expired','cancelled')),
  decided_at         timestamptz,
  decided_by         uuid        references auth.users (id) on delete set null,
  decided_rationale  text,
  created_at         timestamptz not null default now(),
  expires_at         timestamptz not null default (now() + interval '7 days')
);

comment on table public.pending_approvals is
  'Supervised-mode queue: fix proposals awaiting human approval before application.';

create index pending_approvals_user_status_idx on public.pending_approvals (user_id, status, created_at desc);
create index pending_approvals_org_status_idx  on public.pending_approvals (organization_id, status, created_at desc) where organization_id is not null;
create index pending_approvals_scan_idx        on public.pending_approvals (scan_id) where scan_id is not null;

alter table public.pending_approvals enable row level security;

create policy pending_approvals_select on public.pending_approvals
  for select using (
    user_id = auth.uid()
    or (organization_id is not null and public.is_org_member(organization_id))
  );

create policy pending_approvals_insert on public.pending_approvals
  for insert with check (
    user_id = auth.uid()
    and (organization_id is null or public.is_org_member(organization_id))
  );

create policy pending_approvals_update on public.pending_approvals
  for update using (
    user_id = auth.uid()
    or (organization_id is not null and public.can_admin_org(organization_id))
  );

grant select, insert, update on public.pending_approvals to authenticated;
grant all on public.pending_approvals to service_role;

-- v0.4.0 Migration
-- Adds: marketplace_packs, agent_runtime_events, agent_runtime_policies, ci_gate_runs, fix_prs

-- ─── Policy Marketplace ───────────────────────────────────────────────────────

create table if not exists public.marketplace_packs (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  description     text not null,
  author          text not null default 'community',
  category        text not null default 'general'
                  check (category in ('security','compliance','ai-agents','ci-cd','general')),
  rules_count     integer not null default 0,
  downloads       integer not null default 0,
  tags            text[] not null default '{}',
  pack_definition jsonb not null default '{}',
  is_official     boolean not null default false,
  is_public       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.marketplace_packs enable row level security;

create policy "public_read_marketplace"
  on public.marketplace_packs for select
  using (is_public = true);

-- Installed marketplace packs (per org)
create table if not exists public.marketplace_installations (
  id              uuid primary key default gen_random_uuid(),
  pack_id         uuid not null references public.marketplace_packs(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  installed_at    timestamptz not null default now(),
  unique (pack_id, coalesce(organization_id, user_id))
);

alter table public.marketplace_installations enable row level security;

create policy "users_read_own_installations"
  on public.marketplace_installations for select
  using (user_id = auth.uid());

create policy "users_manage_own_installations"
  on public.marketplace_installations for all
  using (user_id = auth.uid());

-- ─── Agent Runtime Events ─────────────────────────────────────────────────────

create table if not exists public.agent_runtime_events (
  id              uuid primary key default gen_random_uuid(),
  agent_id        text not null,
  session_id      text,
  event_type      text not null
                  check (event_type in (
                    'tool_call','tool_result','message','cost_tick',
                    'context_read','file_write','network_request','policy_check'
                  )),
  payload         jsonb not null default '{}',
  decision        text check (decision in ('allow','block','review','log')),
  policy_rule_id  text,
  risk_score      integer,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists agent_runtime_events_agent_id_idx
  on public.agent_runtime_events (agent_id, created_at desc);

alter table public.agent_runtime_events enable row level security;

create policy "users_read_own_agent_events"
  on public.agent_runtime_events for select
  using (user_id = auth.uid());

create policy "users_insert_agent_events"
  on public.agent_runtime_events for insert
  with check (user_id = auth.uid());

-- ─── Agent Runtime Policies ──────────────────────────────────────────────────

create table if not exists public.agent_runtime_policies (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  rules           jsonb not null default '[]',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.agent_runtime_policies enable row level security;

create policy "users_read_own_agent_policies"
  on public.agent_runtime_policies for select
  using (user_id = auth.uid() or organization_id in (
    select organization_id from public.organization_members where user_id = auth.uid()
  ));

create policy "users_manage_own_agent_policies"
  on public.agent_runtime_policies for all
  using (user_id = auth.uid());

-- ─── CI Gate Runs ────────────────────────────────────────────────────────────

create table if not exists public.ci_gate_runs (
  id              uuid primary key default gen_random_uuid(),
  workflow_name   text,
  source          text not null default 'ci',
  policy_slug     text,
  status          text not null check (status in ('pass','review','fail')),
  trust_score     integer not null,
  findings_count  integer not null default 0,
  exit_code       integer not null default 0,
  caller_ref      text,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

alter table public.ci_gate_runs enable row level security;

create policy "users_read_own_ci_runs"
  on public.ci_gate_runs for select
  using (user_id = auth.uid());

create policy "users_insert_ci_runs"
  on public.ci_gate_runs for insert
  with check (user_id = auth.uid());

-- ─── Fix PRs ─────────────────────────────────────────────────────────────────

create table if not exists public.fix_prs (
  id              uuid primary key default gen_random_uuid(),
  scan_id         uuid references public.scan_history(id) on delete set null,
  finding_signature text not null,
  rule_id         text not null,
  github_repo     text not null,
  github_pr_number integer,
  github_pr_url   text,
  status          text not null default 'pending'
                  check (status in ('pending','opened','merged','closed','failed')),
  patch           jsonb not null default '[]',
  error_message   text,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.fix_prs enable row level security;

create policy "users_read_own_fix_prs"
  on public.fix_prs for select
  using (user_id = auth.uid());

create policy "users_manage_own_fix_prs"
  on public.fix_prs for all
  using (user_id = auth.uid());

-- ─── Seed: Marketplace Packs ─────────────────────────────────────────────────

insert into public.marketplace_packs
  (slug, name, description, author, category, rules_count, downloads, tags, is_official, pack_definition)
values
  (
    'torqa-baseline',
    'Torqa Baseline',
    'Default governance pack covering credentials, error handling, and webhook security.',
    'Torqa',
    'security',
    14,
    8421,
    array['credentials','webhooks','error-handling'],
    true,
    '{"version":"2","rules":["v1.n8n.credential_in_env","v1.n8n.no_error_handler","v1.n8n.webhook_no_auth","v1.n8n.unvalidated_http_response"]}'::jsonb
  ),
  (
    'soc2-compliance',
    'SOC 2 Compliance',
    'Policy pack mapping Torqa rules to SOC 2 Type II trust service criteria.',
    'Torqa',
    'compliance',
    22,
    3812,
    array['soc2','compliance','enterprise'],
    true,
    '{"version":"2","framework":"soc2","rules":["v1.secret.plaintext_detected","v1.n8n.credential_in_env","v1.n8n.no_error_handler"]}'::jsonb
  ),
  (
    'iso27001',
    'ISO 27001',
    'Maps governance findings to ISO/IEC 27001:2022 controls for audit readiness.',
    'Torqa',
    'compliance',
    19,
    2104,
    array['iso27001','compliance','audit'],
    true,
    '{"version":"2","framework":"iso27001","rules":["v1.secret.plaintext_detected","v1.n8n.unvalidated_http_response"]}'::jsonb
  ),
  (
    'ai-agent-safety',
    'AI Agent Safety Baseline',
    'Governance rules for autonomous AI agents: cost limits, tool budgets, exfiltration prevention.',
    'Torqa',
    'ai-agents',
    12,
    6733,
    array['ai-agents','safety','autonomous'],
    true,
    '{"version":"2","rules":["v1.agent.exfil_chain","v1.agent.high_temperature","v1.agent.missing_output_filter","v1.agent.unbounded_context"]}'::jsonb
  ),
  (
    'github-actions-strict',
    'GitHub Actions Strict',
    'Enforce secrets management, pinned actions, and permission scoping in GitHub Actions workflows.',
    'community',
    'ci-cd',
    9,
    1547,
    array['github','ci-cd','actions'],
    false,
    '{"version":"2","rules":["v1.github.unpinned_action","v1.github.wildcard_permissions","v1.secret.plaintext_detected"]}'::jsonb
  ),
  (
    'n8n-production-ready',
    'n8n Production Ready',
    'Comprehensive ruleset for n8n workflows going to production: auth, retries, error paths.',
    'community',
    'general',
    16,
    4290,
    array['n8n','production','reliability'],
    false,
    '{"version":"2","rules":["v1.n8n.credential_in_env","v1.n8n.no_error_handler","v1.n8n.webhook_no_auth","v1.n8n.no_retry_on_fail"]}'::jsonb
  );

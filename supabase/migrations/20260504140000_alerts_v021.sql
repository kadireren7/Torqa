-- v0.2.1 Block 6: Real-time governance signals.
-- Extends the existing alert subsystem so it fires on every governance
-- decision (apply_fix / accept_risk / approval / mode_change / interactive
-- response) and adds an HMAC-signed `webhook` destination type for
-- system-to-system integrations (Pagerduty, Datadog, custom CRM, etc.).
--
-- Previous migrations (Block M-series):
--   20260428200000_alert_destinations_and_rules.sql  -- destinations + rules
--   20260501160000_alert_deliveries.sql              -- delivery log

-- ---------------------------------------------------------------
-- 1. New destination type: webhook
-- ---------------------------------------------------------------
alter table public.alert_destinations
  drop constraint if exists alert_destinations_type_check;

alter table public.alert_destinations
  add constraint alert_destinations_type_check
  check (type in ('in_app', 'slack', 'discord', 'email', 'webhook'));

comment on constraint alert_destinations_type_check on public.alert_destinations is
  'webhook config keys: { url: string, secret: string, headers: object, version: "v1" }';

-- ---------------------------------------------------------------
-- 2. Extended trigger set for governance events
-- ---------------------------------------------------------------
alter table public.alert_rules
  drop constraint if exists alert_rules_rule_trigger_check;

alter table public.alert_rules
  add constraint alert_rules_rule_trigger_check
  check (
    rule_trigger in (
      -- existing scan triggers
      'scan_failed',
      'scan_needs_review',
      'high_severity_finding',
      'schedule_failed',
      -- new governance triggers (Block 6)
      'governance_decision',     -- any decision row inserted
      'fix_applied',             -- apply_fix specifically
      'risk_accepted',           -- accept_risk
      'risk_revoked',            -- revoke_risk
      'approval_pending',        -- new pending_approvals row
      'approval_decided',        -- approve_fix or reject_fix
      'mode_changed'             -- workspace governance_mode changed
    )
  );

-- ---------------------------------------------------------------
-- 3. Optional filters per rule (severity, source, decision_type, target_pattern)
-- ---------------------------------------------------------------
alter table public.alert_rules
  add column if not exists filters jsonb not null default '{}'::jsonb;

comment on column public.alert_rules.filters is
  'Optional filter narrows when a rule fires. Recognized keys: severities[] (info|review|high|critical), sources[] (n8n|github|...), decisionTypes[] (apply_fix|...), targetPatterns[] (substring match).';

-- ---------------------------------------------------------------
-- 4. Delivery log enhancements
-- ---------------------------------------------------------------
alter table public.alert_deliveries
  add column if not exists organization_id uuid references public.organizations (id) on delete set null,
  add column if not exists decision_id uuid references public.governance_decisions (id) on delete set null,
  add column if not exists signature_payload text;

create index if not exists alert_deliveries_org_created_idx
  on public.alert_deliveries (organization_id, created_at desc)
  where organization_id is not null;

create index if not exists alert_deliveries_decision_idx
  on public.alert_deliveries (decision_id)
  where decision_id is not null;

comment on column public.alert_deliveries.signature_payload is
  'For webhook deliveries only: hex-encoded HMAC-SHA256 of the JSON body (debug aid).';

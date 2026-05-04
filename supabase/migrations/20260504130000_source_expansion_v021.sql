-- v0.2.1 Block 3: Source Connections Expansion.
-- Extend the `source` allowlist on scan-related tables to include the new
-- adapters introduced in v0.2.1: make (Make.com), zapier (Zapier),
-- lambda (AWS Lambda).
--
-- We keep the legacy values (`n8n`, `github`, `generic`, `webhook`,
-- `pipedream`) plus add `ai-agent` (already used in code but historically
-- missing from this constraint).

alter table public.scan_history drop constraint scan_history_source_check;
alter table public.scan_history
  add constraint scan_history_source_check
  check (
    source in (
      'n8n',
      'github',
      'generic',
      'webhook',
      'pipedream',
      'ai-agent',
      'make',
      'zapier',
      'lambda'
    )
  );

alter table public.workflow_templates drop constraint workflow_templates_source_check;
alter table public.workflow_templates
  add constraint workflow_templates_source_check
  check (
    source in (
      'n8n',
      'github',
      'generic',
      'webhook',
      'pipedream',
      'ai-agent',
      'make',
      'zapier',
      'lambda'
    )
  );

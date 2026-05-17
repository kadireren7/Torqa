# Legacy

Earlier iterations of Torqa explored directions the current product no longer
pursues. They are listed here for historical context only — none of this is
part of the current local-first MCP workflow builder.

## `.tq` workflow spec language

Torqa once shipped a `.tq` workflow spec language with a parser, compiler, and
IR bundle schema (`spec/IR_BUNDLE.schema.json`). The current product no longer
uses `.tq`; workflow plans are produced directly from prompts and exported as
JSON (`torqa.workflow.v1`).

## Governance / compliance SaaS

A larger SaaS positioning existed around workflow governance, scan history,
policy packs, compliance reports (SOC2, ISO 27001), enforcement webhooks,
audit logs, SSO, API keys, and a hosted dashboard. That surface — including
all `app/api/*` routes other than `/api/health`, the Supabase data layer, the
PDF report generator, scan schedules, and the marketplace — has been removed.

## Adapters and connectors

Adapters for n8n, GitHub Actions, Zapier, Make, Pipedream, AI agent webhooks,
and generic providers were part of the governance product. They are not part
of the local-first builder. Live execution and integration adapters are
tracked in [roadmap.md](roadmap.md) under future work.

## What remains today

- Local stdio MCP server (`npm run mcp:server`)
- Five MCP tools: `discover_tools`, `create_workflow_from_prompt`,
  `validate_workflow`, `export_workflow`, `list_workflow_templates`
- Deterministic prompt → plan engine
- Visual web builder at `/builder`
- Setup page at `/mcp-server`
- Example workflows under `examples/mcp-workflows/`
- Smoke test (`npm run mcp:smoke`)

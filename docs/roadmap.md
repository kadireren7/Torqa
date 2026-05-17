# Roadmap

Torqa today is a local-first MCP workflow **planner**. The direction below turns
those plans into executable workflows, then optionally hosts them.

Nothing here is a release promise — it is a directional map.

## Now — planner

Implemented:

- Local stdio MCP server with five workflow tools
- Deterministic prompt → workflow plan engine
- Plan validation
- Web visual builder
- JSON / Claude prompt export (`torqa.workflow.v1`)
- Smoke test command
- Example workflows

## Next — live MCP discovery

- Call `tools/list` against connected MCP servers and use the real inventory in
  `discover_tools`
- Surface live tool metadata (auth, scopes, side-effects) in the visual builder
- Validate workflow plans against the real tool inventory, not just the Torqa
  catalog

## Next — execution adapters

- Built-in adapters for Gmail, Slack, GitHub, Notion, Google Sheets, Stripe,
  Calendar — each callable from a planned step
- Adapter conformance contract: same step shape produces the same external
  effect regardless of adapter source
- "Plan run" mode: execute a plan with mocks, dry-run, then live

## Next — OAuth and credentials

- OAuth flows for the major providers
- Local credential store (encrypted on disk)
- Per-workflow credential scope binding so a single workflow cannot exceed the
  permissions it declared at plan time

## Later — export adapters

- n8n export (plan → n8n workflow JSON)
- Zapier export (plan → Zap template)
- Generic webhook export

## Later — optional hosted

If usage justifies it, an optional hosted version with saved workflow history,
team sharing, and a hosted runtime. The local product stays free and complete.

## Not on the roadmap

- Pricing tiers, credits, or billing
- Multi-tenant SaaS dashboard
- Re-introducing the governance/scanner surface

The product is one thing: a local MCP workflow builder. Anything outside that
either supports it (docs, examples, tests) or extends it (adapters, exports).

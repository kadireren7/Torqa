# Torqa Docs

Torqa is a local-first Visual MCP Workflow Builder for Claude. The dashboard
runs locally, the MCP server runs over stdio, and there is no SaaS backend.

## Start here

- [MCP Server](MCP_SERVER.md) — connect Torqa to Claude Desktop / Claude Code over stdio.
- [Architecture](architecture.md) — what is deterministic, what is planned, where the boundaries are.
- [Examples](examples.md) — five canonical workflow plans in `torqa.workflow.v1`.
- [Roadmap](roadmap.md) — direction and non-goals.
- [Legacy](legacy.md) — earlier Torqa explored other directions; this file records what was dropped.

## Repository layout

- `dashboard/` — Next.js app: landing, `/builder`, `/mcp-server`, stdio MCP server, smoke test.
- `examples/mcp-workflows/` — example workflow JSON files.
- `docs/` — this folder.

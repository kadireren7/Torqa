<div align="center">

<h1>Torqa — Local-first Visual MCP Workflow Builder for Claude</h1>

<p>
Open-source MCP workflow builder. Run it locally, connect it to Claude as an MCP server,
and turn plain-English automation requests into visual workflow plans with tools, steps,
approvals, safety notes, and exportable JSON.
</p>

[![License: AGPL v3](https://img.shields.io/badge/license-AGPL%20v3-6366f1?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript)](dashboard/tsconfig.json)

</div>

---

## What is Torqa?

Torqa is a local-first, open-source MCP (Model Context Protocol) workflow builder for Claude.

You run Torqa on your machine. It exposes a stdio MCP server with five workflow-planning
tools. When you ask Claude to design an automation, Claude calls Torqa, and Torqa returns a
structured workflow plan — tools chosen, steps ordered, approval points marked, safety notes
attached, and a visual graph plus exportable JSON ready to hand to a runtime later.

Torqa **plans**. It does not execute Gmail, Slack, Stripe, or any external API.

## Why?

AI agents can plan automations, but plans should be **structured, inspectable, validated,
and exportable** — not stored as chat history. Torqa gives Claude a local, deterministic
MCP tool for producing those plans, so you can review what Claude is about to do *before*
you wire it up to a runtime.

## What works today

- Local MCP stdio server (`npm run mcp:server`)
- Five MCP workflow tools (`torqa.discover_tools`, `torqa.create_workflow_from_prompt`, `torqa.validate_workflow`, `torqa.export_workflow`, `torqa.list_workflow_templates`)
- Deterministic workflow generation (no LLM calls inside the planner)
- Plan validation (missing tools, missing approvals, risky steps)
- Visual web builder at `/builder`
- JSON / Claude prompt export (`torqa.workflow.v1`)
- Smoke command (`npm run mcp:smoke`)
- Example workflows in [`examples/mcp-workflows/`](examples/mcp-workflows)

## What does not work yet

- No live Gmail/Slack/Stripe execution
- No OAuth or live MCP introspection
- No hosted cloud
- No workflow runtime — Torqa is a planner, not an executor

## Quickstart

```bash
git clone https://github.com/kadireren7/Torqa.git
cd Torqa/dashboard
npm install
npm run mcp:server -- --help
npm run mcp:smoke
npm run dev
```

No environment variables are required for local planning.

### Connect to Claude

Add Torqa to `claude_desktop_config.json` (Settings → Developer → Edit Config in Claude
Desktop):

```json
{
  "mcpServers": {
    "torqa": {
      "command": "npm",
      "args": ["run", "mcp:server"],
      "cwd": "/absolute/path/to/Torqa/dashboard"
    }
  }
}
```

Restart Claude. Then prompt:

> Use Torqa to create a workflow that reads urgent Gmail emails, notifies Slack, and drafts replies.

### Use the web builder

```bash
cd dashboard
npm run dev
```

Open <http://localhost:3000/builder> and try one of the example prompts.

## MCP tools

| Tool | Purpose |
| --- | --- |
| `torqa.discover_tools` | Normalize an MCP config / tool list into a tool inventory. |
| `torqa.create_workflow_from_prompt` | Turn a plain-English request into a structured workflow plan. |
| `torqa.validate_workflow` | Check a plan for missing tools, approvals, and risks. |
| `torqa.export_workflow` | Export a plan as `torqa.workflow.v1` JSON or a Claude prompt. |
| `torqa.list_workflow_templates` | Return starter templates for common automations. |

Full setup: [`docs/MCP_SERVER.md`](docs/MCP_SERVER.md).

## Architecture

```
Claude / MCP client
        │   (MCP stdio JSON-RPC)
        ▼
  Torqa MCP server  (dashboard/src/mcp/server.ts)
        │
        ▼
Workflow Planning Engine  (dashboard/src/lib/workflow-builder/)
        │
        ▼
Visual Graph  +  JSON / Claude prompt export
```

Folder map:

```
dashboard/src/mcp/server.ts                    # MCP stdio server entry
dashboard/src/mcp/smoke.ts                     # smoke test runner
dashboard/src/lib/workflow-builder/            # planning engine
dashboard/src/lib/mcp/workflow-tools/          # MCP tool handlers
dashboard/src/app/builder/                     # web visual builder
docs/MCP_SERVER.md                             # Claude setup guide
docs/ARCHITECTURE.md                           # how the planner works
docs/EXAMPLES.md                               # example walkthroughs
docs/ROADMAP.md                                # what's next
examples/mcp-workflows/                        # static example workflow JSON
```

More detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Examples

Static example workflow plans (`torqa.workflow.v1` shape):

- [`gmail-triage.workflow.json`](examples/mcp-workflows/gmail-triage.workflow.json)
- [`github-issue-to-crm.workflow.json`](examples/mcp-workflows/github-issue-to-crm.workflow.json)
- [`meeting-notes-to-sheets.workflow.json`](examples/mcp-workflows/meeting-notes-to-sheets.workflow.json)
- [`stripe-refund-review.workflow.json`](examples/mcp-workflows/stripe-refund-review.workflow.json)
- [`calendar-follow-up.workflow.json`](examples/mcp-workflows/calendar-follow-up.workflow.json)

Walkthroughs: [`docs/EXAMPLES.md`](docs/EXAMPLES.md).

## Roadmap

- Real MCP tool introspection (live `tools/list`)
- Execution adapters (Gmail, Slack, GitHub, …)
- OAuth connections for live tools
- n8n / Zapier export adapters
- Optional hosted cloud (later)

Full plan: [`docs/ROADMAP.md`](docs/ROADMAP.md).

## License

Torqa is licensed under [GNU Affero General Public License v3](LICENSE).

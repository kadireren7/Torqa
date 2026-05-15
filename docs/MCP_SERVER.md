# Torqa MCP Workflow Server

Torqa exposes a **workflow planning** MCP server. Connect it from Claude Desktop, Claude Code, or any MCP client to turn plain-English automation requests into structured workflow plans with tools, steps, approval gates, and exportable JSON.

**What it does today**

- Discovers/normalizes MCP tool inventories (from config or provided definitions)
- Builds deterministic workflow plans from prompts
- Validates plans before export
- Exports JSON (`torqa.workflow.v1`) or Claude/Cursor prompts

**What it does not do yet**

- Live Gmail, Slack, Stripe, or other external execution
- Real OAuth connections to third-party systems
- Hosted credits or cloud execution

Execution and live connectors are **planned**; plans are marked `plan_only` / simulated.

---

## Run locally

From the `dashboard` package:

```bash
cd dashboard
npm install
npm run mcp:server -- --help
npm run mcp:server
```

The server uses **stdio** transport (stdin/stdout JSON-RPC). It is meant to be spawned by an MCP client, not browsed in a browser.

### Development (tsx)

```json
{
  "mcpServers": {
    "torqa": {
      "command": "npx",
      "args": ["tsx", "dashboard/src/mcp/server.ts"],
      "cwd": "/absolute/path/to/Project-X"
    }
  }
}
```

### Production build (after `npm run build` in dashboard)

If you compile the server to JavaScript:

```json
{
  "mcpServers": {
    "torqa": {
      "command": "node",
      "args": ["dashboard/dist/mcp/server.js"],
      "cwd": "/absolute/path/to/Project-X"
    }
  }
}
```

For day-to-day development, prefer the **tsx** config above.

---

## Claude Desktop config

1. Open **Settings → Developer → Edit Config** (`claude_desktop_config.json`).
2. Add the `torqa` entry under `mcpServers` (see dev example above).
3. Restart Claude Desktop.
4. Confirm **torqa** appears under MCP servers.

---

## Example prompts in Claude

After connecting Torqa:

- “Use Torqa to create a workflow that reads urgent Gmail every morning, notifies Slack, and drafts replies.”
- “List Torqa workflow templates for billing and refunds.”
- “Validate this workflow JSON before I export it.”
- “Export my workflow as a Claude prompt.”

Claude should call:

| Tool | Purpose |
|------|---------|
| `torqa.discover_tools` | Normalize tool inventory from MCP config or tool list |
| `torqa.create_workflow_from_prompt` | Build a plan from plain English |
| `torqa.validate_workflow` | Check steps and unknown tools |
| `torqa.export_workflow` | Export JSON or Claude prompt |
| `torqa.list_workflow_templates` | Example templates |

---

## Web console (same engine)

The Torqa web demo at `/demo/mcp-workflow-builder` uses the **same deterministic planning engine** as this MCP server. Use the web UI for visual editing; use MCP from Claude for conversational planning.

---

## Current limitations

| Capability | Status |
|------------|--------|
| Workflow planning | Implemented |
| Web builder | Implemented |
| MCP server (stdio) | Implemented |
| Live external execution | Planned |
| Real OAuth / live tool calls | Planned |
| Hosted credits | Planned later |

Do not claim live Gmail/Slack/etc. actions unless your deployment implements them.

---

## Planned: execution support

Future versions may add:

- Signed execution runners per workflow step
- Live MCP tool discovery via connected servers
- Approval webhooks and audit trail for executed steps

Until then, treat all outputs as **plans** suitable for review and manual or agent-assisted execution.

<div align="center">

<br />

<h1>Torqa — MCP Workflow Agent for Claude</h1>

<p>
Torqa is an open-source MCP Workflow Agent. Connect it to Claude, describe an automation,
and get a structured MCP workflow plan with tools, steps, approvals, and exportable JSON.
</p>

<br />

[![License: AGPL v3](https://img.shields.io/badge/license-AGPL%20v3-6366f1?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript)](dashboard/tsconfig.json)

</div>

---

## Use from Claude

Run the local MCP server and add Torqa to your Claude Desktop config:

```bash
cd dashboard
npm install
npm run mcp:server
```

`claude_desktop_config.json`:

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

Then ask Claude:

> Create a workflow that reads urgent Gmail emails and drafts replies.

Full setup: [`docs/MCP_SERVER.md`](docs/MCP_SERVER.md).

## Use the web builder

```bash
cd dashboard
npm install
npm run dev
```

Open [http://localhost:3000/demo/mcp-workflow-builder](http://localhost:3000/demo/mcp-workflow-builder).
Describe an automation, get a structured plan, copy the JSON or Claude prompt.

## MCP tools exposed

- `torqa.discover_tools`
- `torqa.create_workflow_from_prompt`
- `torqa.validate_workflow`
- `torqa.export_workflow`
- `torqa.list_workflow_templates`

## What works today

- MCP stdio server
- Deterministic workflow planning engine
- Web workflow builder
- Plan validation
- Export as `torqa.workflow.v1` JSON or Claude/Cursor prompt
- Setup docs

## What is planned

- Live execution against Gmail, Slack, Stripe, etc.
- OAuth and live MCP introspection
- Hosted credits and cloud history
- Workflow execution runtime

Torqa currently **plans** workflows. It does not execute external APIs yet.

## Local development

```bash
cd dashboard
npm install
npm run dev          # web console + builder
npm run mcp:server   # MCP stdio server
npm run lint
npm test
npm run build
```

## License

[AGPL v3](LICENSE).

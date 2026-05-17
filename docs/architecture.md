# Architecture

Torqa is a local-first MCP workflow builder. This doc explains what runs where,
what is deterministic, and where the boundaries are.

## Product boundaries

Torqa is a **planner**, not a runtime.

- It produces workflow *plans* — structured JSON describing tools, ordered steps,
  conditions, approvals, and a visual graph.
- It does **not** execute Gmail, Slack, Stripe, or any other external system.
- It does **not** require a backend, a database, or authentication to plan.

Execution adapters and a runtime are on the roadmap; today, plans are handed to
external systems (or to a human) to run.

## Components

```
Claude / any MCP client
        │   MCP stdio (JSON-RPC 2.0)
        ▼
┌────────────────────────────┐
│  Torqa MCP server          │  dashboard/src/mcp/server.ts
│  - registerTool × 5        │
└────────────────────────────┘
        │   in-process function calls
        ▼
┌────────────────────────────┐
│  MCP tool handlers         │  dashboard/src/lib/mcp/workflow-tools/
│  - discover_tools          │
│  - create_workflow_from_prompt
│  - validate_workflow       │
│  - export_workflow         │
│  - list_workflow_templates │
└────────────────────────────┘
        │
        ▼
┌────────────────────────────┐
│  Workflow planning engine  │  dashboard/src/lib/workflow-builder/
│  - prompt → intent         │
│  - tool selection          │
│  - step ordering           │
│  - approval / risk         │
└────────────────────────────┘
        │
        ▼
┌────────────────────────────┐
│  Outputs                   │
│  - torqa.workflow.v1 JSON  │
│  - Claude / Cursor prompt  │
│  - Visual graph (nodes/edges)
└────────────────────────────┘
```

The web builder at `/builder` calls the same planning engine in the browser. The
MCP server is a thin stdio wrapper around the same functions.

## MCP server

`dashboard/src/mcp/server.ts` uses `@modelcontextprotocol/sdk` to:

1. Construct an `McpServer` named `torqa-workflow`.
2. Register the five tools, each with a Zod input schema.
3. Connect a `StdioServerTransport`.

`--help` prints the tool list without starting the server — useful for verifying
the install before wiring it into Claude.

## Planning engine

The engine is deterministic: same prompt → same plan. No LLM calls happen inside
the planner. Prompts are matched against built-in patterns (Gmail triage, GitHub
billing, Notion → Sheets, Stripe refund, calendar follow-up); unmatched prompts
fall back to a generic plan with a `webhook.call` step and a "connect tools"
note.

This determinism matters because:

- Reviewers can read the plan before granting any real-world capability.
- The same plan can be exported, version-controlled, and diffed.
- Behaviour does not drift between Claude releases.

## Visual graph model

Each step becomes a node. Edges encode "step B runs after step A", with extra
nodes for the trigger and human approval gates. The web builder renders this
as an ordered list with badges; the JSON shape allows any graph renderer to
consume the same data.

## Export formats

| Format | Use |
| --- | --- |
| `torqa.workflow.v1` JSON | Save, version, hand to a runtime later. |
| Claude / Cursor prompt | Paste back into an agent to continue refining the plan. |

The JSON shape: `{ format, id, prompt, intent, steps[], safety, graph? }`. See
[`examples/mcp-workflows/`](../examples/mcp-workflows) for canonical files.

## Why no backend is required

The planner is pure functions over JSON. There is no user state, no remote
storage, no authentication. The web builder ships the engine to the browser;
the MCP server runs the engine in Node. Both produce the same output.

A backend only becomes necessary when you want:

- Saved workflow history across machines (planned, hosted)
- Live MCP introspection from remote servers (planned)
- An execution runtime (planned)

## Current limitations

- **Planning only.** No external action is taken.
- **Pattern-based prompt parsing.** Unmatched prompts get a generic plan.
- **No live MCP tool discovery.** `discover_tools` normalizes provided configs;
  it does not call remote `tools/list`.
- **Single-user.** No multi-tenant or team features.

## Future direction

See [`roadmap.md`](roadmap.md). The biggest planned addition is a runtime —
once plans become executable, the same `torqa.workflow.v1` JSON drives both
Claude's preview and the real adapter calls.

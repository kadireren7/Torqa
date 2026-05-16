# Examples

The [`examples/mcp-workflows/`](../examples/mcp-workflows) folder contains five
canonical workflow plans in `torqa.workflow.v1` format. Each file is a complete
plan you can hand to a future runtime or paste into Claude.

## gmail-triage

> Every morning, find urgent customer emails, notify Slack, and draft replies for review.

- **Trigger:** scheduled (09:00)
- **Tools:** `gmail.search`, `slack.send_message`, `gmail.create_draft`
- **Approval:** required before any draft is sent
- **File:** [`gmail-triage.workflow.json`](../examples/mcp-workflows/gmail-triage.workflow.json)

## github-issue-to-crm

> When a GitHub issue mentions billing, create a CRM task and notify support.

- **Trigger:** GitHub webhook
- **Tools:** `github.search_issues`, `crm.create_task`, `slack.send_message`
- **Approval:** none (internal-only actions)
- **File:** [`github-issue-to-crm.workflow.json`](../examples/mcp-workflows/github-issue-to-crm.workflow.json)

## meeting-notes-to-sheets

> Summarize new Notion meeting notes and add action items to Google Sheets.

- **Trigger:** scheduled (17:00)
- **Tools:** `notion.search_pages`, `sheets.append_row`
- **Approval:** none (read + append)
- **File:** [`meeting-notes-to-sheets.workflow.json`](../examples/mcp-workflows/meeting-notes-to-sheets.workflow.json)

## stripe-refund-review

> If a Stripe refund request arrives, create a review task before any refund action.

- **Trigger:** Stripe webhook
- **Tools:** `crm.create_task`, `stripe.create_refund_review`
- **Approval:** required — refund is irreversible
- **File:** [`stripe-refund-review.workflow.json`](../examples/mcp-workflows/stripe-refund-review.workflow.json)

## calendar-follow-up

> When someone requests a meeting, check availability, propose times in Slack,
> and create calendar events only after approval.

- **Trigger:** incoming meeting request
- **Tools:** `calendar.check_availability`, `slack.send_message`, `calendar.create_event`
- **Approval:** required before the event is created
- **File:** [`calendar-follow-up.workflow.json`](../examples/mcp-workflows/calendar-follow-up.workflow.json)

## Producing your own example

From Claude (with Torqa connected as MCP server):

> Use Torqa to create a workflow that <describe the automation>.
> Then call torqa.export_workflow with format=json and show me the output.

Or use the web builder at <http://localhost:3000/builder>, pick an example
prompt, and copy the JSON.

## Shape

All examples follow `torqa.workflow.v1`:

```jsonc
{
  "format": "torqa.workflow.v1",
  "id": "...",
  "prompt": "...",
  "intent": { "goal": "...", "trigger": "...", "requiredSystems": [...], "approvalSensitiveActions": [...] },
  "steps": [
    { "id": "step-1", "tool": "...", "purpose": "...", "approvalRequired": false, "risk": "low" }
  ],
  "safety": { "approvalPoints": [...], "blockedActions": [...], "missingTools": [...] },
  "graph":  { "nodes": [...], "edges": [...] }
}
```

The shape is validated in `dashboard/src/lib/mcp/workflow-tools/examples.test.ts`.

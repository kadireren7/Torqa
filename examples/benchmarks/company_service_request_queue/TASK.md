# Benchmark: company service request queue (frozen wording)

Build an **internal IT / operations console** where support agents triage **service requests** from multiple customer organizations. The UI must reflect:

- **Queue columns**: request id, priority, current **status**, assignee, owning **team**, SLA deadline with breach risk.
- **Escalation**: tiered escalation when SLA is at risk (manager queue id or escalation tier in the model).
- **Rejections / rework**: reason codes when sending work back to the customer or another team.
- **Retries**: correlation id for cross-system retries and audit.
- **Roles**: actor role and signed-in operator context (**session-backed** review).

Express the product as a TORQA `.tq` surface suitable for projecting an **admin-style** web app (dense tables, filters, drawers) — not a marketing page.

_Version: P128 benchmark seed — keep this file stable for token comparisons._

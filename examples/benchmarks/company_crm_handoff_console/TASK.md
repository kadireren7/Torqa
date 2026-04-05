# Benchmark: CRM handoff and task console (frozen wording)

Build an **internal CRM operations** view for account owners: **pipeline stage**, open **tasks**, **notifications** about approvals (e.g. discount checks), and **handoff** to the next owner. The model should include:

- **Users / ownership**: account id, owner id, contact id.
- **Tasks and notifications**: task id, notification id, next action owner.
- **Approvals matrix**: policy tier for commercial exceptions.
- **Audit-friendly operator sign-in**: session with IP for who touched the record.

Output shape should feel like a **business process system** for revenue teams, not a single-field form.

_Version: P128 benchmark seed — keep this file stable for token comparisons._

# Workspace limits and roles (v0.1.6)

Torqa’s cloud model is **workspace-scoped**: schedules, policies, integrations, and alert destinations can be personal (`organization_id` null) or attached to an organization.

## Roles

- **Owner / admin:** manage workspace settings, invites, workspace-level policies, schedules, and alert destinations.
- **Member:** read workspace data; contribute scans and templates per RLS policies on each table.
- **Viewer-style access:** enforced indirectly via RLS (`is_org_member` without `can_admin_org`); treat “viewer” as member without admin grants.

## Limits (policy, not hard quotas yet)

v0.1.6 does **not** ship server-side billing quotas. Operational limits are environmental:

- **Scan payload size:** capped in `POST /api/scan` and `POST /api/public/scan` (see dashboard request body limits).
- **Cron tick batch:** `POST /api/scan-schedules/cron/tick` processes at most **25** due schedules per invocation — scale horizontally with shorter intervals if needed.
- **API keys:** stored hashed; rate limiting on public scan is placeholder until you wire Redis/KV.

Document your own **org-level** limits (max members, max schedules, max templates) in runbooks until native metering exists.

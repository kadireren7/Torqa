# Torqa 0.1.7 backlog (post–0.1.6 hardening)

Items intentionally **not** closed in 0.1.6; prioritize for the next patch/minor.

## Quality & accessibility

- Add `@axe-core/playwright` (or equivalent) to CI and fail on critical a11y violations for `/`, `/login`, `/overview`, `/scan`.
- Expand E2E to authenticated flows behind Supabase test project (or contract tests for RLS-sensitive routes).

## GitHub automation

- Worker or GitHub Action: on push matching workflow paths, call Torqa scan API and post PR comment with summary + dashboard deep link.
- Optional: GitHub App installation model for multi-tenant webhook routing (vs single `GITHUB_WEBHOOK_SECRET`).

## n8n & integrations

- Persist n8n workflow list into workspace cache table; diff and notify on high-risk changes.
- Tag or annotate risky flows in n8n via documented convention (metadata only; avoid mutating customer n8n without consent).

## Alerts & reporting

- Structured logging when Resend is unset but email rules fire (operational visibility).
- Server-generated PDF for scan/insights (vs browser print / mailto only).

## Packaging

- Publish `torqa/dashboard` image to your registry with semver tags matching app version.
- Helm: Ingress, external secrets operator, probes, resources, and optional Supabase sidecar notes.

## Product

- Hard quotas (schedules/members/API calls) enforced in API + documented in billing path.
- Onboarding checklist steps persisted per-step beyond wizard completion (optional UX).

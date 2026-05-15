# Public Alpha Readiness

This note is the short, honest view of what Torqa v0.3.0 currently ships for outside testers.

## Release stance

Torqa is ready for a **public alpha**, not a broad production launch. The core scan/report/audit/API paths are real, but some surrounding product surfaces are still partial, preview-only, or local/demo-backed.

## Active surfaces

- Deterministic workflow scans through the dashboard and public API.
- Scan history, report viewing, share links, and evidence exports.
- API keys, CI gate responses, and MCP server access.
- Workspace-scoped audit trails, governance decisions, and enforcement webhooks.
- Cloud-backed schedules and recurring scan operations when Supabase + cron are configured.

## Partial surfaces

- Source connectors beyond the easiest local paths depend on provider credentials and server configuration.
- SSO/OIDC configuration and callback testing are present, but rollout still depends on the target identity provider.
- Compliance reporting maps findings to control families, but it should be treated as evidence support rather than certification.
- Fix/remediation flows exist, but full PR automation still depends on supported finding types and GitHub credentials.
- Notifications capture intent and settings, but delivery setup remains narrower than the rest of the governance product.

## Preview surfaces

- Policy Marketplace
- Agent Runtime evaluator

These are functional evaluation surfaces, but they are not core setup paths for the public alpha and should not be marketed as production-complete.

## Demo and local-only behavior

- Landing-page demo report is intentionally labeled as a demo snapshot.
- Overview and insights show demo/sample data when Supabase is not configured.
- Workflow library and notification preferences fall back to browser-local storage in local mode.

## Before tagging or sharing widely

Run the release checks from the dashboard and Python package:

```bash
cd dashboard
npm run lint
npx tsc --noEmit
npm test
npm run build
npm run test:e2e
cd ..
python -m pytest
```

If any of those checks fail, the release should stay in alpha cleanup rather than being promoted as ready.

## Current verification snapshot

Validated locally during the v0.3.0 public-alpha audit:

- `npm run lint`
- `npx tsc --noEmit`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- `npm run test:a11y`
- `python -m pytest`

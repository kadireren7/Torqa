# Torqa Public Alpha

Version: **0.3.0**

Torqa is in **public alpha**. It is ready for early technical users who want to evaluate workflow governance seriously, but it is not positioned as a finished enterprise platform.

## Positioning

Torqa scans automation workflows before they run, detects risky behavior, and enforces policy decisions across tools like `n8n`, `GitHub Actions`, and AI agents.

It does **not** execute workflows. It acts as a review and enforcement layer in front of them.

## Who Should Evaluate It

- teams already shipping automation workflows and wanting a review gate before production
- security and platform engineers who need deterministic findings and machine-readable decisions
- technical users who want an API, CI gate, or dashboard rather than a no-code runtime
- early adopters comfortable with some setup work and partial integrations

## What Works Now

- deterministic workflow scans in the dashboard and public API
- report views with findings, trust score, and policy outcome
- scan history and shareable report flow in cloud mode
- API keys, CI gate, and MCP server access
- audit trail and enforcement webhook surfaces
- local demo mode for first evaluation without full cloud setup

## Partial

- source connectors beyond the simplest local/demo paths
- GitHub, Zapier, Make, Pipedream, and agent-specific integration depth
- SSO / OIDC rollout
- compliance evidence and export workflows
- fix proposal and remediation automation
- notification delivery integrations

## Preview / Early Surfaces

- Policy Marketplace
- Agent Runtime evaluator

These are useful for evaluation, but they should not be presented as production-complete.

## Not Included

- workflow execution or orchestration
- a hosted runtime for your automations
- guaranteed parity across every source connector

## Local Demo Mode

If Supabase is not configured:

- the dashboard still loads
- onboarding still points users to a meaningful first scan
- overview and insights use sample/demo data
- some settings remain browser-local
- source connections and shared history are not fully available

That mode is intentional and should be described as **demo/local**, not as live cloud behavior.

## Best First Paths

### Fastest product walkthrough

1. Open `/overview`
2. Click **Try demo scan**
3. Run the preloaded sample
4. Review the report
5. Connect a real source

### Best real integration path

1. Configure Supabase
2. Open `/sources`
3. Connect `n8n`
4. Sync workflows
5. Run and review a real report

## Deployment Reality

Torqa can be deployed now, but feature depth depends on environment setup:

- **Supabase** is required for the full cloud-backed dashboard experience
- **provider-specific env vars** are required for GitHub, email, cron, and some connector flows
- **cron secrets / worker endpoints** are required for schedules
- **hosted engine config** is required if you want a separate Python engine path

If those are not configured, affected features should be treated as unavailable or partial, not silently assumed to be live.

## Before You Share It Widely

Use the launch checklist:

- [`docs/launch-checklist.md`](launch-checklist.md)

And keep README + landing copy aligned with this status doc so early users know exactly what they are evaluating.

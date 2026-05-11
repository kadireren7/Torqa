# Torqa — Claude Instructions

## Core Goal

Torqa is NOT a workflow tool.

Torqa is a **universal automation governance layer**.

It sits above automation systems and provides:
- inspection
- policy enforcement
- decisioning
- auditability

---

## Long-Term Direction

Torqa aims to become a **standard control layer** for automation systems, similar to:
- Oracle (enterprise control systems)
- ServiceNow (process governance)
- Cloud IAM (access + policy enforcement)

But for: workflows, pipelines, and AI agents.

---

## What Torqa is NOT

- Not just an n8n tool
- Not a dashboard-only product
- Not a workflow builder
- Not a low-code platform
- Not a manual JSON scanning tool

---

## What Torqa IS

- A governance engine
- A decision system
- A policy layer
- An audit surface

---

## Core Architecture

All systems follow this pipeline:

Source → Adapter → WorkflowBundle → PolicyPack → GovernanceReport → UI / API / CI

---

## Primary User Flow

Connect source → Sync workflows → Run automated scans → Review → Enforce → Automate

Manual scan must exist only as an advanced option (Advanced → Manual Upload). It must NOT be the default experience.

---

## Core Principles

- Automation-first
- Source-connected workflows
- Minimalist UX
- Enterprise-ready structure
- Deterministic analysis (no hidden AI magic)
- No workflow execution
- Policy-driven decisions

Every workflow must produce:
- trust_score
- decision (approve / review / block)
- findings
- policy pack used

---

## Current Release State — v0.3.0

This is the first version intended for real users. The codebase has reached a state where:
- Scan engine is stable and deterministic
- Dashboard is deployable with Supabase
- API keys, MCP server, CI gate are production-ready
- Governance playbooks and policy marketplace are functional

### What is SHIPPED and working
- Scan engine (n8n, GitHub Actions, AI agents, generic)
- Policy packs + marketplace (browse, install, publish)
- Governance playbooks (auto-dispatch on scan events)
- CI gate (`/api/public/ci/gate` — exit_code 0/1)
- MCP server (4 tools: scan, findings, policy_list, audit)
- Agent runtime governance (real-time policy evaluation)
- Compliance reports (SOC2 + ISO 27001 mapping)
- Enforcement webhooks (HMAC-SHA256 signed)
- Audit log
- SSO (OIDC)
- API keys (SHA-256 hashed, one-time reveal)
- Fix PR generator (draft GitHub PR from findings)
- Onboarding wizard (auto-shown on first login)

### What is PARTIAL (works but has known limits)
- Zapier/Make/Pipedream source connections — UI exists, OAuth backend partially complete
- Email alerts — Resend integration exists but requires `RESEND_API_KEY`
- Scan schedules — cron tick endpoint exists, requires external cron trigger (Vercel cron or similar)
- Rate limiting on scan endpoint — placeholder implementation, no Redis/KV backend

### What is LEGACY / MOCK (do not surface to users)
- `/policy` page — uses mock data, redirect to `/policies`
- `/projects` and `/projects/[slug]` — mock data, not linked in main nav
- `/validation/[runId]` — mock data, legacy from v0.1

### Required env vars for a working deployment
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

---

## Development Phases

### Phase 1 — DONE
- Adapter system
- Policy packs
- Governance reports

### Phase 2 — DONE
- UI / Dashboard
- Integration Center
- MCP server
- Governance playbooks

### Phase 3 — CURRENT (v0.4–v0.5 target)
- Real live data binding (end mock data era)
- n8n and GitHub OAuth working end-to-end
- Onboarding flow validated with real users
- Billing / pricing page
- Public documentation

### Phase 4 — NEXT (v1.0 target)
- Self-serve signup and smooth onboarding
- Stripe billing
- Team management
- Public docs site

### Phase 5 — LATER
- Multi-source governance
- Connector SDK
- Enterprise marketplace
- SOC2 Type II path

---

## Current Priority

1. Make the product usable for real users (no mock data shown by accident)
2. Clean sidebar — match CLAUDE.md navigation spec exactly
3. Source connections working end-to-end
4. Billing / pricing

---

## Navigation Structure

Main navigation must be exactly:
- Home
- Sources
- Workflows
- Runs
- Policies
- Automations
- Reports
- Settings

Secondary items (accessible but not in main nav):
- Audit (link from Reports or Settings)
- Marketplace (link from Policies)
- Developer (link from Settings)
- Agent Runtime (link from Settings or Automations)
- MCP Server (link from Developer page)

Manual scan must NOT be a main navigation item.
Pages with mock/legacy data must NOT appear in any navigation.

---

## Sources / Integration Strategy

Sources are the core of Torqa.

Connections must look like "Connect GitHub", "Connect n8n" — NOT "Paste API key".

Supported:
- n8n (active — API key or self-hosted URL)
- GitHub (active — OAuth)
- Zapier (partial — OAuth UI exists, backend partial)
- Make (partial — API token UI exists)
- Pipedream (partial — API key UI exists)
- AI agents (active — webhook + definition JSON)
- Generic webhook/API

Each source must define:
- connection method
- credential schema
- workflow fetch
- scan integration

---

## Design Style

UI must feel like a **control panel** or **command center** — serious, minimal, enterprise-grade. NOT a playful dashboard or colorful SaaS toy.

Inspired by: Torq.co, Vercel, Linear

Rules:
- Dark-first
- Cyan accent system (`--accent`: #22D3EE dark / #0891B2 light)
- Subtle motion only — no heavy animation
- Functional over decorative
- Prefer whitespace and clarity
- No visual noise

Token system:
- `--surface-0/1/2/3` for backgrounds
- `--overlay-sm/md/hover` for theme-aware overlays
- `--fg-1/2/3/4` for text hierarchy
- `--line` / `--line-2` for borders

---

## UX Rules

- Every page must have ONE primary action
- Avoid clutter, avoid too many cards
- Mobile-first design
- Tables must degrade into cards on mobile
- Sidebar must not overwhelm users — max 8 main items
- Empty states must be meaningful (not blank pages)
- Do NOT show mock/placeholder data to real users

---

## Technical Rules

- Never expose secrets to client
- API keys must be masked (SHA-256 hashed, prefix-only shown)
- Use server-side handling for connectors
- Use typed interfaces for connectors
- Avoid breaking existing APIs
- Keep backward compatibility
- Prefer extension over rewrite
- Minimal diffs > full rewrites
- Strong typing where possible
- Clear boundaries between layers
- `export const runtime = "nodejs"` on all routes that use pdfkit or Node crypto

---

## What NOT to Do

- Do NOT make manual scan the main feature
- Do NOT add random UI sections
- Do NOT overcomplicate navigation — max 8 main nav items
- Do NOT introduce AI where deterministic logic exists
- Do NOT surface mock or placeholder data to users without a clear "demo" label
- Do NOT create unfinished fake features without marking them as "coming soon"
- Do NOT overengineer or prematurely abstract
- Do NOT rewrite stable code
- Do NOT show "Email (placeholder)" or similar stub labels in production UI

---

## Output Expectations

When making changes:
- Keep UX simple
- Keep code modular
- Explain changes clearly
- Ensure tests pass (`npm run lint` must show 0 errors before any commit)

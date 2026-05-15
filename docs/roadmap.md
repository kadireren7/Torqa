# Roadmap

Torqa is evolving as a **universal automation governance layer**: deterministic scan engine, dashboard, API, CI gate, MCP surface, and team workflows around audit and remediation. **Nothing here is a release promise**; it is a directional map for contributors, evaluators, and early technical users.

## Snapshot for visitors

| You want… | Torqa today |
| --- | --- |
| A **CI gate** before workflows run | `torqa scan` / `torqa validate`, public scan API, and CI-oriented response envelopes |
| A **team dashboard** for automation governance | Next.js app with scans, reports, schedules, audit, API keys, and workspace controls |
| **Deterministic policy evaluation** | Rule-based findings, trust scores, policy packs, and explicit engine/fallback metadata |
| **Developer integration surfaces** | REST API, MCP server, outbound webhooks, and SDK / action examples |
| A **workflow executor / orchestrator** | Still out of scope for this repository (see [non-goals](#explicit-non-goals)) |

**Adoption path:** try the demo path or run a local scan -> wire Torqa into CI or API calls -> connect cloud mode for workspaces, schedules, reports, and audit trails.

---

## Current focus

- **Public alpha honesty:** keep README, roadmap, changelog, and in-product labels aligned with what actually ships.
- **First-user clarity:** make the "connect a source" and "try demo scan" paths obvious for new evaluators.
- **Source coverage hardening:** improve connector depth for supported automation sources without hiding provider-specific limitations.
- **Operational readiness:** make local, self-hosted, and cloud deployment paths clearer across env vars, Docker/Helm, cron, and Supabase-backed features.
- **Governance evidence:** strengthen reports, audit exports, policy decisions, and approval flows so teams can explain why a workflow passed, failed, or required review.
- **CLI + dashboard continuity:** keep the Python package, scan engine, and dashboard API speaking the same contract.

---

## Near-term improvements

- Sharper **real-vs-demo signaling** wherever local/sample data is shown.
- Better **connector diagnostics** so missing OAuth/env/server configuration fails clearly instead of feeling silent.
- More consistent **policy-pack lifecycle** across browse, install, simulate, and publish flows.
- Stronger **team setup UX** for workspaces, SSO/OIDC, API keys, and schedule operations.
- Release verification that keeps **lint, tests, build, and docs** aligned before each public tag.

---

## Milestones (directional)

| Milestone | Meaning |
| --- | --- |
| **0.3.x public alpha** | Honest positioning, stable core workflows, and enough deployment/documentation clarity for outside testers. |
| **0.x hardening** | Continue expanding governance coverage while preserving deterministic behavior and traceable release notes. |
| **1.0.0** | Stable public contract across CLI, API, and dashboard evidence surfaces. |

---

## Long-term possibilities

- Broader **source coverage** for automation platforms, while keeping provider depth explicit.
- Richer **policy authoring and simulation** workflows for teams that manage multiple governance packs.
- Stronger **ecosystem integrations** (SDKs, CI actions, MCP clients, export tooling) around the same governance contract.
- Continued evolution of the **`.tq` / IR** surface where it improves interoperability with the dashboard and API.

These are opportunities, not commitments.

---

## Historical note

Torqa started as a thinner CLI/spec-core effort. That history still matters for the Python package and IR design, but the active product direction now includes the dashboard, API, audit surfaces, and hosted/team workflows around automation governance.

---

## Explicit non-goals

- **Workflow execution/runtime orchestration** (running jobs, retries, queues, worker fleets).
- **Pretending preview or demo surfaces are production-complete** when they are not.
- **Opaque scoring** or silent weakening of validation behavior.
- **Vendor lock-in as the product boundary**; Torqa should remain a governance layer that can sit above multiple automation systems.

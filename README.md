<div align="center">

<br />

<h1>Torqa</h1>

<p><strong>Governance layer for automation workflows.</strong><br />
Scan, score, and enforce policy on every workflow — before it runs in production.</p>

<br />

[![Version](https://img.shields.io/badge/version-0.3.0-0ea5e9?style=flat-square)](CHANGELOG.md)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL%20v3-6366f1?style=flat-square)](LICENSE)
[![CI](https://github.com/kadireren7/Torqa/actions/workflows/ci.yml/badge.svg)](https://github.com/kadireren7/Torqa/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript)](dashboard/tsconfig.json)

<br />

[Overview](#overview) · [How it works](#how-it-works) · [Dashboard](#dashboard) · [Quickstart](#quickstart) · [API](#rest-api) · [CI Gate](#ci-gate) · [MCP Server](#mcp-server) · [Changelog](CHANGELOG.md)

<br />

</div>

---

## Overview

Torqa sits above your automation stack and acts as a governance gate. It does not execute workflows — it inspects workflow definitions, scores them against policy rules, and produces an auditable decision.

```
n8n · GitHub Actions · AI Agents · Zapier · Make
          │
          ▼
        Torqa
          │
    ┌─────┴──────┐
  PASS      NEEDS REVIEW / FAIL
```

Every scan produces:
- **Trust score** — 0–100
- **Decision** — `APPROVE`, `NEEDS REVIEW`, or `BLOCK`
- **Findings** — rule ID, severity, target, suggested fix
- **Policy evaluation** — which rules triggered, which pack was used

---

## How it works

**1. Connect a source**
Connect your n8n instance, GitHub repo, or AI agent definition. Torqa fetches workflow definitions over your existing API or OAuth connection.

**2. Run a scan**
The scan engine applies a deterministic rule set (no LLM calls in the scan path). Each rule checks a specific property — credential exposure, dangerous permissions, missing auth gates, scope violations.

**3. Get a governance report**
Every scan produces a structured report: trust score, findings list, policy decision, and a suggested fix for each finding.

**4. Automate enforcement**
Use the CI gate to block pipelines. Use playbooks to auto-dispatch actions. Use the API or MCP server to integrate with your existing tooling.

---

## Dashboard

The Next.js dashboard (`dashboard/`) is the team interface for Torqa.

| Feature | Status |
|---|---|
| Connect sources (n8n, GitHub, Zapier, Make, Pipedream) | Active |
| Automated scan schedules (cron / hourly / daily) | Active |
| Governance reports with findings and trust score | Active |
| Policy marketplace — browse, install, publish packs | Active |
| Governance playbooks — auto-dispatch on scan events | Active |
| CI gate — `exit_code` 0/1 for GitHub Actions / GitLab | Active |
| MCP server — JSON-RPC 2.0, 4 tools | Active |
| Agent runtime governance — real-time policy evaluation | Active |
| Compliance reports — SOC2 + ISO 27001 control mapping | Active |
| Enforcement webhooks — HMAC-SHA256 signed outbound POST | Active |
| Audit log | Active |
| SSO (OIDC) | Active |
| API keys — machine-to-machine access | Active |
| Fix PR generator — draft GitHub PR from findings | Active |

### Tech stack

```
Next.js (App Router)    Supabase (auth · database · RLS)    Tailwind CSS
TypeScript strict        Vitest                               Playwright (E2E + a11y)
Radix UI / shadcn        framer-motion
```

---

## Quickstart

```bash
git clone https://github.com/kadireren7/Torqa.git
cd Torqa/dashboard
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> Without Supabase the dashboard runs in local/demo mode with mock data.

---

## REST API

All public endpoints require an API key. Generate one in **Settings → API**.

```http
POST /api/public/scan
x-api-key: torqa_live_<key>
Content-Type: application/json

{
  "source": "n8n",
  "content": { ...workflow_json }
}
```

Response:

```json
{
  "ok": true,
  "data": {
    "status": "FAIL",
    "riskScore": 42,
    "findings": [...],
    "engine": "torqa-scan-v1"
  }
}
```

**Supported sources:** `n8n`, `github`, `ai_agent`, `zapier`, `make`, `pipedream`, `webhook`

Full spec: `GET /api/openapi.json`

---

## CI Gate

Block pipelines on governance failures. Returns `exit_code: 0` (pass) or `1` (fail).

```yaml
- name: Torqa governance gate
  run: |
    RESULT=$(curl -sf -X POST https://your-app/api/public/ci/gate \
      -H "Authorization: Bearer ${{ secrets.TORQA_API_KEY }}" \
      -H "Content-Type: application/json" \
      -d '{
        "workflow": '"$(cat .github/workflows/deploy.yml | jq -Rs .)"',
        "source": "github",
        "workflow_name": "deploy",
        "fail_on": "fail"
      }')
    exit $(echo $RESULT | jq -r .exit_code)
```

Or use `torqa.config.json` in your repo root for config-driven scans:

```json
{
  "version": "1",
  "policy": "torqa-baseline",
  "fail_on": "fail"
}
```

---

## MCP Server

Torqa exposes a JSON-RPC 2.0 MCP server at `POST /api/mcp`.

**Tools available:**
- `torqa_scan` — scan a workflow JSON
- `torqa_findings` — query findings from scan history
- `torqa_policy_list` — list available policy packs
- `torqa_audit` — query governance decisions

Auth: `x-api-key` header or `Authorization: Bearer <key>`.

```json
POST /api/mcp
x-api-key: torqa_live_<key>

{ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }
```

---

## Supported Sources

| Source | Connection | What is scanned |
|---|---|---|
| n8n | API key or self-hosted URL | Nodes, credentials, HTTP methods, code execution |
| GitHub Actions | OAuth or token | Workflow YAML — permissions, secrets, unpinned actions |
| AI Agents | Webhook or definition JSON | Prompt injection, dangerous tools, scope, hardcoded secrets |
| Zapier | OAuth | Zap orchestration definitions |
| Make | API token + zone | Scenario definitions |
| Pipedream | API key | Workflow steps |
| Generic | Direct JSON | Any workflow bundle |

---

## What Torqa detects

**n8n**
- Credentials stored in workflow JSON
- Dangerous code nodes (`eval`, `exec`, shell calls)
- Webhook endpoints without auth
- Unsafe HTTP methods on external endpoints

**GitHub Actions**
- `contents: write` on pull request triggers
- Secrets printed to logs
- Unpinned third-party actions
- `pull_request_target` + PR head checkout (privilege escalation)
- Self-hosted runners on public repos

**AI Agents**
- Prompt injection surfaces
- Missing or oversized system prompts
- Dangerous tool permissions (`exec`, `file_write`, `db_write`, `network`)
- Too many tool definitions (scope creep)
- Hardcoded secrets in prompts

---

## Python CLI

```bash
pip install torqa
# or from source:
pip install -e ".[dev]"
```

```bash
torqa scan workflow.json --source n8n
torqa validate workflow.json --source n8n
torqa report . --format html -o report.html
torqa version
```

Exit codes: `0` = PASS, `1` = FAIL/BLOCK, `2` = configuration error.

---

## Deployment

### Vercel (recommended)

Deploy with one click. Set the three Supabase env vars in project settings.

### Docker

```bash
docker build -f dashboard/Dockerfile -t torqa-dashboard .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=... \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  torqa-dashboard
```

### Docker Compose

```bash
docker compose up
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-only) |
| `NEXT_PUBLIC_APP_URL` | Recommended | Public URL of your deployment |
| `TORQA_API_KEY_PEPPER` | Recommended | Secret pepper for API key hashing |
| `RESEND_API_KEY` | For email | Resend.com API key |
| `GITHUB_OAUTH_CLIENT_ID` | For GitHub | GitHub OAuth App client ID |
| `GITHUB_OAUTH_CLIENT_SECRET` | For GitHub | GitHub OAuth App client secret |
| `TORQA_CRON_SECRET` | For schedules | Secret for cron job auth |

---

## Contributing

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [GOOD_FIRST_ISSUES.md](GOOD_FIRST_ISSUES.md)
- [SECURITY.md](SECURITY.md)

---

## License

[GNU Affero General Public License v3](LICENSE) — © 2026 Kadir Eren Altıntaş

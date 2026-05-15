<div align="center">

<br />

<h1>Torqa</h1>

<p><strong>Security copilot for MCP servers and AI agents.</strong><br />
Torqa scans MCP server configs, tool manifests, and agent definitions. Detects risky permissions, exposed secrets, and unsafe capabilities — then guides you through the fix.</p>

<br />

[![Version](https://img.shields.io/badge/version-0.3.0-0ea5e9?style=flat-square)](CHANGELOG.md)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL%20v3-6366f1?style=flat-square)](LICENSE)
[![CI](https://github.com/kadireren7/Torqa/actions/workflows/ci.yml/badge.svg)](https://github.com/kadireren7/Torqa/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript)](dashboard/tsconfig.json)

<br />

[Quickstart](#quickstart) · [What Torqa Scans](#what-torqa-scans) · [Product Flow](#product-flow) · [API / CI Gate](#api--ci-gate) · [Status](#status) · [Changelog](CHANGELOG.md)

<br />

</div>

---

## What Torqa Is

Torqa is a security copilot for MCP servers and AI agents.

It does **not** execute agents or tools. It inspects your MCP server config, tool manifest, or agent definition — before you deploy — and returns deterministic findings:

- **Risk score** from `0` to `100`
- **Decision** such as `PASS`, `NEEDS REVIEW`, or `FAIL`
- **Findings** with rule IDs, severity, affected tools, and remediation guidance
- **Fix guidance** with before/after verification (guided flow is in development)

If you are building or deploying MCP servers or AI agents, Torqa is the layer that tells you what is risky and why, before it reaches production.

## Who It Is For

- Developers building MCP servers who want to catch risky tool configs before deployment
- AI agent teams who need to know which tools are over-permissioned
- Platform engineers who want a CI gate on agent config changes
- Security teams reviewing MCP manifests for exposed secrets and unsafe capabilities
- Developers who want to verify that a fix actually reduced risk without introducing new issues

## Product Flow

```
Connect → Scan → Ask → Fix → Patch → Verify
```

| Step | Status | Description |
| --- | --- | --- |
| **Connect** | Works now | Paste MCP config, upload tool manifest, or link agent definition |
| **Scan** | Works now | Deterministic rule-based inspection — same input, same findings |
| **Ask** | Planned | Click a finding; Torqa asks guided questions about intended behavior |
| **Fix** | Planned | Torqa generates a safe fix plan based on your answers |
| **Patch** | Planned | Get a concrete diff or config patch to apply |
| **Verify** | Works now | Re-scan to confirm risk score improved, no new findings introduced |

## What Torqa Scans

| Input type | Status | Notes |
| --- | --- | --- |
| MCP server config | Active | Primary focus — tool manifests, permission scopes, capability flags |
| AI agent definitions | Active | JSON-defined agents with tools, prompts, and permission declarations |
| GitHub Actions | Partial | Rules and CI/API paths exist; depth depends on credentials |
| n8n workflows | Partial | Good for existing users; MCP/agents are the primary direction |
| Generic JSON | Works now | Useful for local testing and demos |
| Zapier / Make / Pipedream | Partial | Connectors exist; not the primary product direction |

## Status

### Works now

- MCP config and agent definition scanning
- Deterministic scan API and CI gate
- Risk score, findings, and policy decisions
- Scan history, share links, and evidence export
- API keys and MCP server access
- Audit trail and enforcement webhooks
- Re-scan for before/after verification

### In development

- Guided triage (Ask step) — click finding → answer questions → get scoped fix
- Fix plan generation based on intent answers
- Patch/diff output for direct application

### Partial

- Source connectors beyond MCP and agent JSON
- SSO / OIDC setup
- Email notifications

### Not yet

- Payments / billing
- Public docs site
- Full connector parity across all listed platforms

### Known limitations

- Without Supabase, some surfaces use demo mode or browser-local storage
- Scheduled scans need cloud mode plus a cron tick path
- Compliance outputs are evidence helpers, **not** certifications
- Fix automation depends on supported finding types

More detail: [`docs/public-alpha.md`](docs/public-alpha.md)

## Quickstart

### Option A: local evaluation

```bash
git clone https://github.com/kadireren7/Torqa.git
cd Torqa/dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

In local mode:
- dashboard loads and demo scan works
- overview and insights use sample data
- some settings remain local-only until cloud mode is configured

### Option B: cloud-backed dashboard

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Restart the dashboard after adding env vars.

## Demo Path

Fastest first-user flow:

1. Open `/scan?sample=unsafe_mcp&source=mcp`
2. Review the preloaded unsafe MCP server findings
3. Check the risk score breakdown
4. Connect a real MCP server from `/sources`

## API / CI Gate

### Public scan API

All public endpoints require an API key from **Settings → API**.

```http
POST /api/public/scan
x-api-key: torqa_live_<key>
Content-Type: application/json

{
  "source": "mcp",
  "content": { ...mcp_server_config }
}
```

Response shape:

```json
{
  "ok": true,
  "data": {
    "status": "FAIL",
    "riskScore": 28,
    "findings": [],
    "engine": "torqa-scan-v1"
  }
}
```

OpenAPI: `GET /api/openapi.json`

### CI gate

Use the CI gate to fail builds on governance outcomes:

```yaml
- name: Torqa MCP security gate
  run: |
    RESULT=$(curl -sf -X POST https://your-app/api/public/ci/gate \
      -H "Authorization: Bearer ${{ secrets.TORQA_API_KEY }}" \
      -H "Content-Type: application/json" \
      -d '{
        "workflow": '"$(cat mcp-server.json | jq -Rs .)"',
        "source": "mcp",
        "fail_on": "fail"
      }')
    exit $(echo $RESULT | jq -r .exit_code)
```

### MCP server

Torqa exposes a JSON-RPC 2.0 MCP server at `POST /api/mcp`.

Available tools:

- `torqa_scan`
- `torqa_findings`
- `torqa_policy_list`
- `torqa_audit`

Requires API key setup and your deployed base URL.

## Deployment

### Vercel

Default for the Next.js dashboard. Requires Supabase env vars.

Minimum env:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

### Docker

```bash
docker build -f dashboard/Dockerfile -t torqa-dashboard .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=... \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e NEXT_PUBLIC_APP_URL=http://localhost:3000 \
  torqa-dashboard
```

### Docker Compose

```bash
docker compose up
```

### Optional env vars

| Variable | Needed for |
| --- | --- |
| `TORQA_CRON_SECRET` | Scheduled scans |
| `TORQA_API_KEY_PEPPER` | API key hashing (recommended in production) |
| `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` | GitHub connector |
| `RESEND_API_KEY` | Email delivery |
| `TORQA_ENGINE_URL` | Hosted Python engine |

## Python CLI

```bash
pip install -e ".[dev]"
torqa scan mcp-server.json --source mcp
torqa scan workflow.json --source n8n
torqa version
```

## Docs

- [`docs/public-alpha.md`](docs/public-alpha.md)
- [`docs/demo-script.md`](docs/demo-script.md)
- [`docs/roadmap.md`](docs/roadmap.md)
- [`CHANGELOG.md`](CHANGELOG.md)

## License

Torqa is licensed under the [GNU Affero General Public License v3](LICENSE).

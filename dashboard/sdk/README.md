# @torqa/sdk

Programmatic client for the Torqa governance API. Run scans, evaluate policy
packs, query the audit log, and accept risks from CI/CD pipelines or
external services without touching the dashboard UI.

> Status: experimental, internal preview. The wire format is stable inside
> the v1 envelope at `/api/public/...`. Subject to change between minor
> versions until v1.0.

## Install

```bash
npm install @torqa/sdk
```

Requires Node.js 20+ (uses the global `fetch`). Pass a custom `fetch`
implementation if running on an older runtime.

## Quick start

```ts
import { TorqaClient } from "@torqa/sdk";

const client = new TorqaClient({
  baseUrl: "https://dashboard.torqa.dev",
  apiKey: process.env.TORQA_API_KEY!,
});

// 1. Run a scan
const { result } = await client.scan({
  source: "n8n",
  content: workflowJson,
});

// 2. Evaluate findings against a programmable policy pack
const evaluation = await client.evaluatePolicy({
  policyPackId: "00000000-0000-0000-0000-000000000000",
  source: "n8n",
  findings: result.findings,
  riskScore: result.risk_score,
});

if (evaluation.result.verdict === "block") {
  console.error("Torqa blocked this change:", evaluation.result.reasons);
  process.exit(1);
}
```

## API surface

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `scan` | `POST /api/public/scan` | Run a scan against the workflow content |
| `evaluatePolicy` | `POST /api/public/policy/evaluate` | Verdict for a finding-set against a pack |
| `simulatePolicy` | `POST /api/public/policy/simulate` | Dry-run a pack against historical scans |
| `listPolicyPacks` | `GET /api/public/policy-packs` | List packs visible to the API key |
| `listDecisions` | `GET /api/public/audit/decisions` | Paginate through the governance audit log |
| `exportAudit` | `GET /api/public/audit/export` | CSV/JSON download for compliance reviews |
| `acceptRisk` | `POST /api/public/risks/accept` | Programmatically suppress a known finding |

## Errors

All API failures throw a typed `TorqaApiError` with `status`, `code`, and
`requestId`. Cross-reference `requestId` with the dashboard's audit log to
follow a request end-to-end.

```ts
import { TorqaApiError } from "@torqa/sdk";

try {
  await client.acceptRisk({ ... });
} catch (e) {
  if (e instanceof TorqaApiError && e.code === "conflict") {
    // already on the registry; safe to ignore
  } else {
    throw e;
  }
}
```

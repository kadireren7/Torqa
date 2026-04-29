# PDF scan reports (dashboard)

Server-generated PDF exports for saved scans and public share links. Implementation uses **[pdfkit](https://pdfkit.org/)** (pure Node.js, vector PDF) — **no Puppeteer / headless Chrome**.

## Routes

| Method | Path | Auth | Behaviour |
|--------|------|------|-----------|
| `GET` | `/api/scans/[scanId]/pdf` | Session (Supabase cookie) | Returns PDF if the user may read that `scan_history` row (RLS + explicit org membership / owner checks). |
| `GET` | `/api/share/[shareId]/pdf` | None | Returns PDF when `shareId` is valid and `get_scan_by_share_id` returns a row (`SUPABASE_SERVICE_ROLE_KEY` required, same as JSON share API). |

### HTTP status codes

| Status | Meaning |
|--------|---------|
| `200` | `application/pdf` body; `Content-Disposition: attachment; filename="torqa-scan-report-{id}.pdf"` |
| `400` | Invalid `scanId` (not UUID) or invalid share token shape |
| `401` | Not signed in (authenticated route only) |
| `403` | Workspace scan but user is not an org member (defense in depth; RLS usually returns `404` instead) |
| `404` | Scan or share not found / not visible |
| `500` | PDF generation threw |
| `503` | Supabase or share service not configured |

## UI

- **Saved scan** (`/scan/[scanId]`): **Export PDF** triggers a same-origin `fetch` (cookies included), then downloads `torqa-scan-report-{scanId}.pdf`.
- **Public share** (`/share/[shareId]`): same button; no cookies required.

Loading and error states are shown inline on the button row.

## PDF contents

- Torqa title / branding line
- Summary: status, risk score, source, saved-at timestamp, finding totals
- Policy evaluation (when `policyEvaluation` is present on the stored result)
- Findings (up to 60 per PDF; remainder noted)
- Recommendations (shared logic with the HTML report)
- Engine metadata (`engine`, `engine_mode`, `analysis_kind`, `fallback`)

## Vercel & deployment limits

| Topic | Notes |
|--------|--------|
| **Runtime** | Routes use `export const runtime = "nodejs"`. |
| **Puppeteer** | **Not used** — no Chromium binary, no `maxDuration` explosion from browser startup. |
| **pdfkit** | Runs in-process; typical reports are small (tens–hundreds of KB). Very large finding lists are capped in the PDF. |
| **Serverless timeout** | On Vercel Hobby, function timeout defaults to **10s** (Pro up to **60s** / higher on Enterprise). PDF generation should stay well under that; if you add huge attachments later, monitor duration. |
| **Response size** | Vercel response body limits apply (~4.5 MB on Hobby); normal Torqa PDFs are far below. |
| **Memory** | pdfkit buffers the whole PDF in memory before `Response` — acceptable for capped content; avoid embedding large binaries. |

If you later switch to **Puppeteer** or **@sparticuz/chromium**, expect **larger bundles**, **cold starts**, **stricter memory/timeout tuning**, and often **Docker** or **serverful** hosting — document separately before adopting.

## Local verification

```bash
cd dashboard
npm test -- src/lib/pdf src/app/api/scans src/app/api/share
npm run build
```

Manual: sign in, open a saved scan, click **Export PDF**; open a share URL and export from the shared report.

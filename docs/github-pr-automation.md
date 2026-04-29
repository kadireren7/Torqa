# GitHub PR automation (Torqa)

Production-adjacent baseline: on **`pull_request`** (`opened`, `synchronize`, `reopened`), Torqa lists changed files on the PR, scans workflow-shaped paths with the dashboard **preview engine**, and posts (or updates) a single sticky PR comment.

## Architecture

| Piece | Role |
|--------|------|
| `POST /api/webhooks/github` | Verifies **HMAC SHA-256** signature, routes by `X-GitHub-Event` |
| `handlePullRequestWebhook` | Parses PR context, lists files, filters paths, runs scan, upserts comment |
| GitHub REST | List PR files, fetch `contents` at `head.sha`, issue comments API for PRs |
| Auth | **GitHub App** (JWT → installation token) when `installation.id` is present and app env is set; else **PAT** via `GITHUB_BOT_TOKEN` |

No OAuth marketplace app is required for v1: use a **classic PAT** or a **GitHub App** installed on the org/repo.

## Environment variables

| Variable | Required | Purpose |
|----------|-----------|---------|
| `GITHUB_WEBHOOK_SECRET` | **Yes** | Webhook HMAC secret (always enforced) |
| `GITHUB_BOT_TOKEN` | No* | Fine-grained or classic PAT with `contents: read`, `pull_requests: read`, `issues: write` (PR comments use the issues API) |
| `GITHUB_APP_ID` | No* | GitHub App numeric id |
| `GITHUB_PRIVATE_KEY` | No* | PEM for the app (use `\n` in single-line env for newlines) |
| `TORQA_DASHBOARD_BASE_URL` | No | If set (valid URL), comment includes a link to `{base}/scan` |
| `NEXT_PUBLIC_APP_URL` | No | Fallback dashboard base if `TORQA_DASHBOARD_BASE_URL` is unset |

\*Provide **either** `GITHUB_BOT_TOKEN` **or** both `GITHUB_APP_ID` + `GITHUB_PRIVATE_KEY` when the webhook payload includes `installation.id` (GitHub App deliveries). If only PAT is configured, App installation on the payload is ignored.

If **no** GitHub API credentials are configured, the handler returns `200` with a placeholder aggregate and **does not** call GitHub (logged server-side). Listing PR files and fetching `contents` always requires **some** GitHub credential (PAT or installation token); there is no way to download arbitrary PR blobs from the public webhook payload alone.

## Webhook setup (GitHub)

1. Repo **Settings → Webhooks → Add webhook** (or org-level).
2. **Payload URL:** `https://<your-dashboard-host>/api/webhooks/github`
3. **Content type:** `application/json`
4. **Secret:** same value as `GITHUB_WEBHOOK_SECRET` on the server.
5. **Events:** choose **Let me select individual events** and enable:
   - `pull_request` (Torqa reacts to **opened**, **synchronize**, **reopened** only)
6. Optional: keep **Ping** for delivery checks.

**SSL:** GitHub requires HTTPS for production hooks.

## Rate limits and safety

- Scans at most **28** matching paths per PR; each file capped at **400 KB** decoded.
- Sequential GitHub API calls; low `x-ratelimit-remaining` is logged.
- PR comments are **deduplicated** via HTML marker `<!-- torqa-pr-automation:v1 -->`: latest matching comment is **updated** instead of creating a new one.

## Example comment output

```markdown
<!-- torqa-pr-automation:v1 -->
### Torqa — PR workflow scan

**Repository:** `acme/corp`  **PR:** #42

| Metric | Value |
|--------|-------|
| **Status** | **NEEDS REVIEW** |
| **Risk score** | 72 / 100 |
| **Critical + high findings** | 3 |

**Files scanned:** 2  ·  **Skipped / errors:** 0

#### Top findings

1. **HIGH** — `workflows/notify.json: v1.n8n.http_side_effect`
   - ...
...
**Dashboard:** [Open scan workspace](https://app.example.com/scan)
```

## Local testing

Run unit tests from `dashboard/`:

```bash
cd dashboard
npm test -- src/lib/github-pr
```

## Manual setup checklist

- [ ] Deploy dashboard with env vars set.
- [ ] Create PAT or GitHub App with correct permissions; install app on target repos if using App mode.
- [ ] Register webhook with secret; send a test **ping** and a test PR.
- [ ] Confirm bot user is allowed to comment (private fork rules may block tokens).

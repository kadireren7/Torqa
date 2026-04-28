# Torqa launch checklist

Release managers and QA: use this for **first-user launch** readiness. Complement with [dashboard/README.md](../dashboard/README.md) and [supabase/README.md](../supabase/README.md).

## 1. Route sanity (main app)

Confirm each path loads without 500 and renders a sensible empty or data state (with Supabase configured and a test user signed in where noted).

| Route | Purpose |
| --- | --- |
| `/` | Marketing / landing |
| `/overview` | Home metrics, onboarding |
| `/scan` | Run scan |
| `/workflow-library` | Templates |
| `/integrations` | Integration configs |
| `/schedules` | Schedules + Run now |
| `/alerts` | Team alert destinations + rules |
| `/policies` | Policy templates + workspace policies |
| `/insights` | Aggregated scan metrics |
| `/workspace` | Org, invites, active workspace |
| `/notifications` | In-app feed |
| `/settings/api` | API keys |
| `/settings/notifications` | Personal scan alert toggles (linked from Notifications / Alerts; also in sidebar) |
| `/login` | Auth |
| `/scan/history` | Saved scans table |
| `/share/[shareId]` | Public shared report (no auth) |

**Also:** `/team` redirects to `/workspace`. `/policy` is legacy mock UI. `/validation` is mock history — optional for launch comms.

## 2. Navigation consistency

- Primary nav is defined in `dashboard/src/lib/nav.ts` (`mainNav`) and mirrored in **App sidebar** + **mobile sheet**.
- Breadcrumb “Dashboard” always links to `/overview`.
- Deep links from onboarding empty states should resolve (integrations, scan, library, schedules, alerts, policies).

## 3. Supabase & migrations

1. Create project; enable **Auth** (email at minimum).
2. From repo root: `supabase link` + `supabase db push` (or run SQL in order — see [supabase/README.md](../supabase/README.md)).
3. Set dashboard env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and **`SUPABASE_SERVICE_ROLE_KEY`** on the server if you need **share links** and RPCs that use the service role.
4. Configure **Auth redirect URLs** for your production origin (`/auth/callback`).

## 4. Environment (production)

See repository [`.env.example`](../.env.example) and **Environment variables** in [dashboard/README.md](../dashboard/README.md).

Minimum for “real” cloud dashboard:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (share links, some server paths)
- `NEXT_PUBLIC_APP_URL` (absolute links where used)

Optional:

- `TORQA_SCAN_PROVIDER` / `TORQA_ENGINE_URL` (hosted Python engine)
- `TORQA_ALLOW_PREVIEW_FALLBACK` (`true`/`false`; disable silent downgrade in production)
- `TORQA_CRON_SECRET` (required if you call cron tick for automatic schedule execution)
- `TORQA_API_KEY_PEPPER` (hash pepper for user API keys — set in production)

## 5. Smoke tests (first user)

Run in order on a **staging** project before outreach.

- [ ] **Signup / sign-in** — `/login`, confirm email if required, session persists.
- [ ] **Scan** — `/scan`, paste or upload JSON (n8n or generic), run scan, see PASS / NEEDS REVIEW / FAIL.
- [ ] **Save history** — after scan, row appears in `/scan/history` (requires Supabase + `POST /api/scans` path working).
- [ ] **Share report** — from `/scan/[id]`, create share link; open `/share/[shareId]` in a private window (requires migrations + service role).
- [ ] **Workflow template** — `/workflow-library`: upload, save template; open `/scan?library=<id>` prefill.
- [ ] **Schedule** — `/schedules`: create schedule, **Run now**, row in history / schedule runs.
- [ ] **Alert** — `/alerts`: add destination (e.g. in-app or Slack webhook in staging), add rule, trigger via failing scan if applicable.
- [ ] **Policy** — `/policies`: save workspace policy from template; run scan with policy; `policyEvaluation` on result.
- [ ] **API key** — `/settings/api`: create key, call `POST /api/public/scan` with header (see dashboard README).

## 6. Production limitations (communicate honestly)

- **Scan engine in dashboard:** Default **`server-preview`** is Node heuristics, not the Python CLI binary. For parity with CLI, configure **`hosted-python`** + `TORQA_ENGINE_URL`.
- **Scheduled cron:** `POST /api/scan-schedules/cron/tick` executes due enabled schedules, but this remains a simple MVP (single endpoint worker style, not distributed orchestration).
- **Email / some webhooks:** placeholders or “safe ping” behavior may apply; verify in staging before promising email delivery.
- **n8n integration:** config-first; no live pull from n8n until ingestion is built.
- **Without Supabase:** app runs in a degraded/demo-friendly mode (no persisted history, no team features).

## 7. CI gates before tag

From `dashboard/`:

```bash
npm run lint
npm run build
npm test
```

From repo root (optional for Python package):

```bash
pip install -e ".[dev]"
python -m pytest
```

## 8. Known gaps / blockers template

Track org-specific items here before outreach:

| Item | Owner | Status |
| --- | --- | --- |
| Public production URL + DNS | | |
| Supabase prod project + secrets in host | | |
| Auth email templates / SMTP | | |
| Hosted scan engine URL (if required) | | |
| Cron worker for schedules (if required) | | |

---

**Sign-off:** When routes, smoke tests, and production secrets are green, mark the release **ready for first users** in your changelog or release ticket.

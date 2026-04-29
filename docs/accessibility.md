# Torqa dashboard — accessibility

## Target

- **WCAG 2.1 Level AA** (automated checks via [axe-core](https://github.com/dequelabs/axe-core) with tags `wcag2a` and `wcag2aa`).
- Automated tests assert **no axe violations** with impact **critical** or **serious**, require HTTP success (status below 500), and a visible **`main`** landmark on each covered route.

## CI

Workflow: `.github/workflows/dashboard-accessibility.yml` — `npm run lint`, `npm run build`, `npm test`, then `npm run test:a11y` with `PLAYWRIGHT_A11Y_BUILT=1` (single production build). No Supabase public env in that job, so routes stay in demo mode.

## Test scope

Playwright spec: `dashboard/e2e/a11y-axe.spec.ts`.

Routes scanned:

| Route | Notes |
|--------|--------|
| `/` | Marketing / public |
| `/login` | Auth UI |
| `/overview` | App shell |
| `/scan` | Scan |
| `/scan/history` | History |
| `/workflow-library` | Library |
| `/policies` | Policies |
| `/insights` | Insights |
| `/workspace` | Workspace |
| `/alerts` | Alerts |
| `/integrations` | Integrations |
| `/schedules` | Schedules |
| `/settings/api` | API settings |

When the suite is green, **all of the routes above** pass navigation, **`main`** visibility, and axe **serious/critical** checks for tags `wcag2a` + `wcag2aa`.

Config: `dashboard/playwright.a11y.config.ts` — starts **`next start`** with **`reuseExistingServer: false`** so results are not tied to an old dev server or stale bundle. By default `npm run test:a11y` runs **`npm run build`** first; use `PLAYWRIGHT_A11Y_BUILT=1` after a local build to skip the duplicate build.

### Auth / demo mode in CI

`dashboard/src/middleware.ts` skips session enforcement when **Supabase public env is unset**. GitHub Actions therefore runs a11y **without** `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, so protected routes render in **demo / unauthenticated** mode instead of redirecting to `/login`.

## How to run

From the repo root:

```bash
cd dashboard
npm install
npm run lint
npm run build
npm test
npm run test:a11y
```

`npm run test:a11y` runs `next build` then `next start` inside Playwright unless you already built and set **`PLAYWRIGHT_A11Y_BUILT=1`** (as in CI):

```bash
cd dashboard
npm run build
PLAYWRIGHT_A11Y_BUILT=1 npm run test:a11y
```

Install browser binaries once if needed:

```bash
cd dashboard
npx playwright install chromium
```

## Known limitations

- **Automated ≠ full WCAG audit**: keyboard-only flows, screen reader behavior, reflow, and cognitive patterns need manual / expert review.
- **Demo mode in CI** does not exercise authenticated-only UI states; re-run a11y locally with real auth if you need session-specific surfaces covered.
- Axe may omit some **moderate** / **minor** issues; the current gate only fails on **serious** and **critical**.
- Third-party embeds or dynamic remote content are only covered when present on the above routes at scan time.

## Remaining accessibility debt (checklist)

Use this as a manual follow-up backlog:

- [ ] Full keyboard path through modals, sheets, data tables, and scan wizards (focus trap, focus return).
- [ ] Screen reader labels for icon-only controls and chart summaries (Recharts).
- [ ] Motion: verify `prefers-reduced-motion` on any non-CSS animations.
- [ ] Forms: explicit error summaries and `aria-live` for async validation on settings and integrations.
- [ ] Authenticated flows with Supabase enabled (post-login dashboards, role-gated UI).
- [ ] Periodic manual colour review for **PASS / WARN** badges and chart series colours (translucent token combinations).

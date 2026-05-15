# Torqa launch checklist

Release managers and QA: use this for **public alpha** readiness for **v0.3.0**.

This checklist is about an honest early release, not a “pretend GA” launch.

## 1. Public-facing copy

- [ ] `README.md` matches current product reality and links to `docs/public-alpha.md`
- [ ] landing page headline, subheadline, and CTAs match current positioning
- [ ] no feature is described as complete if it is still partial or preview
- [ ] version references shown to users still say `0.3.0`

## 2. First-user path

Validate the public-alpha path from a fresh user perspective:

- [ ] landing explains Torqa in one sentence
- [ ] `/overview` shows a clear start path, not a blank or confusing metrics wall
- [ ] user can choose between **Connect a source** and **Try demo scan**
- [ ] demo path reaches a meaningful scan/report
- [ ] result view points to one obvious next action
- [ ] local/no-Supabase sessions clearly say **Local demo mode**

## 3. Route sanity

Check these routes for sensible first-user behavior:

| Route | Expectation |
| --- | --- |
| `/` | clear positioning and docs/demo/source CTAs |
| `/overview` | onboarding-first dashboard |
| `/sources` | real integration path plus honest local-mode fallback |
| `/scan` | demo-friendly first scan path |
| `/advanced/manual-scan` | clearly labeled advanced path |
| `/reports` | no confusing empty state |
| `/scan/history` | useful when cloud mode is configured |
| `/settings/api` | API keys path exists and is understandable |
| `/mcp` | setup path exists and matches shipped tool names |

## 4. Environment and setup

Minimum cloud-backed dashboard:

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `NEXT_PUBLIC_APP_URL`

Optional but important depending on scope:

- [ ] `TORQA_CRON_SECRET` for schedule execution
- [ ] `TORQA_API_KEY_PEPPER` for production API key hashing
- [ ] `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` for GitHub OAuth
- [ ] `RESEND_API_KEY` for real email delivery
- [ ] `TORQA_ENGINE_URL` if using a hosted engine path

## 5. Honest production notes

Before sharing publicly, confirm these limitations are documented:

- [ ] dashboard can run without Supabase, but that is **demo/local mode**
- [ ] some connector flows depend on external credentials and provider setup
- [ ] schedules require cloud mode and cron wiring
- [ ] compliance views are evidence helpers, not certifications
- [ ] preview surfaces are labeled as preview

## 6. Smoke tests

On a staging or local evaluation environment:

- [ ] run a demo scan from `/overview`
- [ ] connect a real source if environment setup is available
- [ ] run a manual or real scan and review the report
- [ ] verify API key creation and a `POST /api/public/scan` call
- [ ] verify MCP route responds after API key setup
- [ ] verify a share/export path if Supabase is configured

## 7. Release verification

From `dashboard/`:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Recommended:

```bash
npm run test:e2e
npm run test:a11y
```

From repo root if the Python package is part of the release:

```bash
python -m pytest
```

## 8. Deployment packaging

- [ ] `docker compose build` succeeds if Docker packaging is part of the release
- [ ] `helm template torqa ./charts/torqa` renders if Helm packaging is part of the release
- [ ] image/chart references match `0.3.0`

## 9. Final sign-off

- [ ] `CHANGELOG.md` has a reviewed `0.3.0` section
- [ ] `docs/public-alpha.md` reflects what actually ships
- [ ] a first technical user can understand Torqa and reach a report in under 2 minutes

---

If any item above is false, treat the release as still in alpha cleanup rather than launch-ready.

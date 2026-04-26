# Torqa Dashboard (MVP)

Next.js **App Router** + **Tailwind CSS** + **shadcn/ui** + **Recharts** (via shadcn `Chart`). Uses **mock data** under `src/data/` with a **`queries.ts`** facade so you can swap in Supabase or REST without rewriting pages.

## Run locally

```bash
cd dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Routes

| Path | Page |
| --- | --- |
| `/login` | Login (mock auth) |
| `/` | Dashboard overview (stats, risk chart, recent runs) |
| `/projects` | Projects grid |
| `/scan` | **Workflow scan (demo)** — upload/paste JSON, pick generic vs n8n, run **client-side preview** rules (see below) |
| `/validation` | Validation history table |
| `/validation/[runId]` | Run detail + mock JSON |
| `/policy` | Policy settings |
| `/team` | Team members |

## Production build

```bash
npm run build
npm start
```

### `/scan` — preview vs real

- **Today:** `/scan` runs **Dashboard preview analysis** in the browser (`src/lib/scan-preview.ts`). It parses JSON and applies deterministic heuristics (for example n8n-shaped exports: HTTP Request, Code, credentials, error-handling hints, webhook/slack/email side effects). This is **not** the Torqa Python package or CLI.
- **Future:** wire this page to a **Torqa backend** (e.g. server action or API that shells `torqa scan` / shared library) so results match production tooling. Static sample workflows ship under `public/scan-samples/` for Vercel deploys.

## Next steps (integration)

- Replace `src/data/queries.ts` with Supabase client calls (see repo `docs/cloud-backend.md`).
- Add auth (Supabase Auth or NextAuth) and gate `(app)` layout.
- Point “Run” JSON panel at `reports.payload` or Storage signed URLs.

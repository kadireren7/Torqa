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
| `/` | Dashboard overview (stats, risk chart, recent runs) |
| `/projects` | Projects grid |
| `/validation` | Validation history table |
| `/validation/[runId]` | Run detail + mock JSON |
| `/policy` | Policy settings |
| `/team` | Team members |

## Production build

```bash
npm run build
npm start
```

## Next steps (integration)

- Replace `src/data/queries.ts` with Supabase client calls (see repo `docs/cloud-backend.md`).
- Add auth (Supabase Auth or NextAuth) and gate `(app)` layout.
- Point “Run” JSON panel at `reports.payload` or Storage signed URLs.

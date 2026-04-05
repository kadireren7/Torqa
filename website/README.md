# TORQA website (official — P72)

**Official marketing website** — premium positioning copy only (no command cheatsheets on the page). Built output is served at **`GET /`** when you run `torqa-console`. **`/console`** redirects to **`/`** (browser IR lab removed). **`/desktop`** is a short pointer page ([P73](../docs/P73_PRODUCT_SURFACES.md)).

Semantic authority stays in **TORQA core**; this app only explains, links, and reads public APIs (e.g. benchmark report) for display. **Repo-wide try path** (CLI + this site + desktop): [`docs/TRY_TORQA.md`](../docs/TRY_TORQA.md). **Demos & recordings:** [`docs/P138_DEMO_AND_VIDEO_KIT.md`](../docs/P138_DEMO_AND_VIDEO_KIT.md) and [`examples/demo_kit/`](../examples/demo_kit/README.md) (screenshot checklist, comparison widget on `/`).

## Build (writes `dist/site/`)

From this folder:

```bash
npm install
npm run build
```

For the **integrated** console experience, run `torqa-console` (or `python -m website.server`) and open **http://127.0.0.1:8000/** (built site under `/static/site/`). For **local UI work**, prefer **`npm run dev`** on **:3000** above.

## Develop (standalone on **:3000** — P120)

The marketing site runs as its **own Vite dev server**, not inside the desktop app or on the console port by default:

```bash
npm run dev
```

Open **http://127.0.0.1:3000/** (port is fixed; change `vite.config.ts` if it conflicts).

- **TORQA Desktop** is a separate Electron surface — do not confuse it with this site.
- **`torqa-console`** (FastAPI) typically serves **http://127.0.0.1:8000/**. In dev, Vite proxies **`/api`** to that host so live benchmark/demo calls work **only when** the console is running in another terminal.

Uses `/` as asset base (Vite dev). Production build uses `/static/site/` so assets resolve under the FastAPI static mount when served by `torqa-console`.

## Stack

React 18, TypeScript, Vite 5. **Not** an editor — marketing narrative + optional live benchmark API only.

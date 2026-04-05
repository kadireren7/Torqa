# Try TORQA (canonical paths)

**Purpose:** One page that tells you **where to start**, **which surface to use**, and **which commands are current** — without hunting across the repo.

---

## One product story (short)

TORQA is a **compression-first execution layer**: you describe intent in natural language or a compact **`.tq` surface**, the **core** validates it into canonical **IR**, then **projects** to real artifacts (e.g. Vite/React webapp, SQL, stubs). The spec and diagnostics are the contract; generated files are outputs. Deeper positioning: [`WHAT_TORQA_DOES_BEST.md`](WHAT_TORQA_DOES_BEST.md) · [`EXECUTION_LAYER_PROOF.md`](EXECUTION_LAYER_PROOF.md).

---

## Official surfaces (do not mix these up)

| Surface | What it is | How you run it |
|---------|------------|----------------|
| **CLI** | Source of truth for validate, build, benchmarks, `torqa app` / `generate-tq` | `torqa` after `pip install -e .` · fallback: `python -m torqa` ([`QUICKSTART.md`](QUICKSTART.md)) |
| **Marketing website** | Product story, proof blocks, links; **not** an IDE | Source: [`website/`](../website/) · host: `torqa-console` or `python -m website.server` → **`GET /`** only ([`P72_WEBSITE_OFFICIAL.md`](P72_WEBSITE_OFFICIAL.md)) |
| **TORQA Desktop** | Native **Electron** shell: folder, `.tq` editor, spawn `torqa` | Dev: **`torqa-desktop`** · [`desktop/README.md`](../desktop/README.md). **Windows trials:** NSIS installer from `npm run pack:win` — [`P133_DESKTOP_DISTRIBUTION.md`](P133_DESKTOP_DISTRIBUTION.md) ([`P73_PRODUCT_SURFACES.md`](P73_PRODUCT_SURFACES.md)) |

**Not a product surface:** **`GET /console`** — permanently redirects to **`/`** (former browser lab removed). Use **CLI + Desktop** for tooling ([`UI_SURFACE_RULES.md`](UI_SURFACE_RULES.md)).

**`GET /desktop`** on the web host is a **pointer page** to install/open the native app — not a second IDE.

---

## Canonical first-trial path (flagship)

This is the **same path** described in [`TRIAL_READINESS.md`](TRIAL_READINESS.md) and [`FLAGSHIP_DEMO.md`](FLAGSHIP_DEMO.md).

1. **Install:** `python -m pip install -e .` (repo root).
2. **Index:** `torqa demo` — read the printed steps (source of truth for command order).
3. **Sanity:** `torqa demo verify` (optional but recommended).
4. **Build flagship:** `torqa build examples/benchmark_flagship/app.tq` → output under `generated_out/` by default.
5. **Preview:** `generated_out/generated/webapp/` → `npm install` && `npm run dev` ([`DEMO_LOCALHOST.md`](DEMO_LOCALHOST.md)).
6. **Proof (optional):** compression baseline / gate — see [`FLAGSHIP_DEMO.md`](FLAGSHIP_DEMO.md).

**Minimal CLI-only first success** (no flagship): [`QUICKSTART.md`](QUICKSTART.md) — `torqa build examples/workspace_minimal/app.tq`.

---

## Prompt → spec → build (desktop / automation)

Full **NL → validated `.tq` → materialize** pipeline:

- **CLI:** `torqa --json app --workspace <dir> --prompt-stdin` (stdin = prompt).
- **Desktop:** folder + prompt strip + **Build** (same underlying CLI).

Details: [`EXECUTION_LAYER_PROOF.md`](EXECUTION_LAYER_PROOF.md) · [`desktop/README.md`](../desktop/README.md).

---

## Related docs

| Doc | Role |
|-----|------|
| [`QUICKSTART.md`](QUICKSTART.md) | Install + first `torqa build` |
| [`FLAGSHIP_DEMO.md`](FLAGSHIP_DEMO.md) | Full flagship walkthrough |
| [`TRIAL_READINESS.md`](TRIAL_READINESS.md) | What is ready vs limited on first trial |
| [`KNOWN_LIMITS.md`](KNOWN_LIMITS.md) | Honest scope boundaries |
| [`FIRST_PROJECT.md`](FIRST_PROJECT.md) | After first build: own a `.tq` |
| [`FIRST_REAL_DEMO.md`](FIRST_REAL_DEMO.md) | Alternate: demo-site `.tq` → website |
| [`DOC_MAP.md`](DOC_MAP.md) | Full documentation index |
| [`P138_DEMO_AND_VIDEO_KIT.md`](P138_DEMO_AND_VIDEO_KIT.md) | Demos, video script, slide-ready proof snapshots — [`examples/demo_kit/`](../examples/demo_kit/README.md) |

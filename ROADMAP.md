# Roadmap (honest)

1. **Website milestone** — Baseline done: `tests/test_website_generation_gate.py` + CI `scripts/ci_build_generated_webapp.py` (`npm install` + `npm run build` on materialized `generated/webapp`).
2. ~~**Parity**~~ — `tests/test_engine_parity_ci.py` runs in the **rust** CI job after `cargo test` (golden `valid_minimal_flow`); local run skips if the bridge is unavailable.
3. ~~**Patch UX**~~ — Web console: **Patch preview** tab + **Preview patch** button (`POST /api/preview-patch`); CLI had `preview-patch` already.
4. ~~**Execution traces (baseline)**~~ — `execution_trace` on `/api/run` and `project-x guided`: enriched step summaries (`summary`, `effect_name`); Python fallback uses `ir_execution_plan_to_json`. Web **Trace** tab.
5. **IR migration** — Real `migrate_ir_bundle` when `1.4+` appears.

**Recently shipped:** `project-x guided` (diagnostics → full pipeline JSON), `docker-compose` + `Dockerfile` for the web console, shared `build_console_run_payload` (`src/orchestrator/pipeline_run.py`), golden `valid_start_session_flow.json`, `src/execution/trace_pack.py`, website gate + trace UI tests.

See `docs/IMPLEMENTATION_STATUS.md` and `STATUS.md`.

---

## Desktop “Cursor-style” IDE (folder + prompt + project) — *not shipped today*

**What exists now**

- **Web console** (`project-x-console` / Docker): browser UI, Monaco JSON editor, examples, Run, AI suggest (server needs `OPENAI_API_KEY`), no native “pick a folder on disk” workflow.
- **CLI**: `project-x demo`, `project`, `guided`, `ai-suggest` — all path-based; no bundled graphical installer or VS Code–class shell.

**Gap vs a downloadable Cursor-like product**

| Capability | Today | Typical target |
|------------|--------|----------------|
| Installable desktop app (.exe / .dmg) | No | Electron / Tauri + auto-update |
| Workspace = arbitrary local folder | Partial (CLI paths only) | File tree, `File > Open Folder` |
| Prompt → IR → files in that folder | Partial (`demo`/`project` to `--out`) | One-click “Generate into workspace” + diff preview |
| LSP / diagnostics in editor | No | Extension or embedded Monaco + language server for IR/Kural |
| Offline-first AI | IR pipeline yes; `ai-suggest` needs API key | Optional local model / Ollama path |

**Suggested phases (if you prioritize this)**

1. **MVP shell** — Tauri or Electron: embed `project-x-console` or static build + spawn local FastAPI; “Open folder” → set `PROJECT_ROOT`, list `.json` bundles, run `project-x project` into `generated/` under that root.
2. **Prompt UX** — Single panel: natural language → `ai-suggest` → show diff → apply to `ir_goal.json`; reuse patch preview APIs.
3. **Polish** — Auto-open generated Vite app, session/undo, settings for model endpoint (not only OpenAI).

**Bottom line:** *Şu an* bilgisayara “Cursor gibi” tek paket indirip klasör seçerek tam o deneyimi **yapmıyor**; teknik olarak **yapılabilir** çünkü motor ve HTTP/CLI yüzeyleri hazır — eksik olan ürün kabuğu (masaüstü + dosya workspace modeli + akış birleştirme).

---

## How “independent language” is the core IR? — maturity ladder

**Already independent of any vendor model**

- **Truth = canonical JSON IR** + `validate_ir` / handoff / semantics / diagnostics codes.
- **Execution + projections** run without OpenAI; LLM is optional *proposal* path only.

**Still dependent on ecosystem / representation**

| Dimension | Maturity | What “full independence” would add |
|-----------|----------|-------------------------------------|
| **Notation** | High for *data* (JSON IR), low for *human* syntax | Optional text/Kural surface with formal grammar → same IR |
| **Verifier authority** | Python + Rust path; CI parity | Rust-only or formally specified semantics doc = single law |
| **Builtin / stdlib** | Small registry (`ir_semantics`) | Versioned stdlib, domains (payments, auth, …) with golden tests each |
| **Tooling** | CLI + web + Docker | Installable IDE, LSP, formatter, package registry (optional) |
| **Self-hosting** | Scaffold (`self_hosting` modules) | Pipeline described in IR and emitted by same codegen (long arc) |

**Rough progression**

1. **v1.3** — Verifier-first IR, multi-surface codegen, AI formalization behind the same wall. *(done)*  
2. **v1.4+** — Real migrations (1.3→1.4), larger stdlib (`strings_equal`, …), Rust parity path in CI; canonical `ir_version` is **1.4**. *(in repo)*  
3. **“Language” in the usual sense** — Reference `.pxir` surface (`src/surface/parse_pxir.py`), CLI `project-x surface`, VS Code grammar under `editors/vscode-project-x/`. *(subset + editor grammar; LSP/formatter still future)*  
4. **Ecosystem** — Third-party projection hook (`PROJECT_X_PROJECTION_MODULE`), optional `library_refs` on bundles + envelope validation. *(hooks + schema; full package registry still future)*

Use this section with `STATUS.md` for honest “where we are” messaging to users and investors.

# TORQA Desktop (official — P69 / P71)

Native **Electron + React** shell for `.tq` projects. **All validation, IR, build, and benchmark logic runs in TORQA core** via the same CLI as the terminal: the app spawns `python -m torqa` with `PYTHONPATH` set to the repo root (equivalent to running `torqa` when the package is installed and on `PATH`). This folder is **UI + IPC only**.

## Prerequisites

1. **TORQA repo** with `pip install -e .` (repository root).
2. **Node.js 20+** and npm.
3. This folder lives next to `src/`, `pyproject.toml`, etc. If you move only this tree, set **`TORQA_REPO_ROOT`** to the repo root.
4. **Python** on `PATH` (`python` / `python3`) or **`TORQA_PYTHON`**.

## Install & run

**Önemli:** Arayüzü **tarayıcıda** açmayın (`http://localhost:…`). Orada `torqaShell` yoktur; klasör/dosya açma çalışmaz. Her zaman **Electron penceresini** kullanın (adres çubuğu olmayan uygulama penceresi).

**Electron penceresinde bile “torqaShell yok” görürseniz:** `desktop/package.json` içinde `"type":"module"` varken eski derleme `preload.mjs` + CJS karışımı preload’ı kırıyordu; düzeltme `preload.cjs` kullanıyor. Mutlaka `npm run build` yeniden çalıştırın; `dist-electron/preload.cjs` oluşmalı (eski `preload.mjs` silinebilir).

```bash
cd desktop
npm install
npm run dev          # Vite + Electron — açılan MASAÜSTÜ penceresini kullanın
```

**From the repo root (after `npm install` in `desktop/` once):**

```bash
torqa-desktop
```

The launcher (`src/torqa_desktop_launcher.py`) will run `npm run build` in `desktop/` if `dist-electron/` is missing.

Production-style (bundled UI — **no** website dev server; Electron loads `dist/index.html`):

```bash
cd desktop
npm run build
npm start
```

## Windows installer (P119 / P133 — trial distribution)

**Metadata:** version, **TORQA Desktop** product name, description, and **icon** (`build/icon.png`) are set in `package.json` under `build` for electron-builder.

From `desktop/` after `npm install`:

```bash
npm run pack:win
```

**Output:** `desktop/release/TORQA Desktop-Setup-<version>.exe` (NSIS, x64). Version comes from `desktop/package.json` **`version`**.

**Unpacked build** (quick QA, no installer):

```bash
npm run pack:win:dir
```

→ `desktop/release/win-unpacked/TORQA Desktop.exe`

The app is a **standalone shell**: the UI is baked into the installer. **TORQA Python core is not bundled** — you still need a normal [repo install](../../README.md) (`pip install -e .` at the monorepo root) and either:

- Run the installed app **from a checkout** (auto-detected `pyproject.toml`), or  
- Set **`TORQA_REPO_ROOT`** to that checkout, plus **`TORQA_PYTHON`** / `python` on `PATH` as today.

**Trial checklist and maintainer notes:** [`docs/P133_DESKTOP_DISTRIBUTION.md`](../docs/P133_DESKTOP_DISTRIBUTION.md).

So: installer = distributable desktop product; core remains the shared `torqa` CLI workflow (folder → model → prompt → build → preview).

## Trial feedback & local telemetry (P135)

The **Feedback** tab in the right sidebar records **nothing over the network**. Session events append to `<userData>/trial-data/session-events.ndjson`; optional saved feedback JSON files go under `trial-data/feedback/`. See [`docs/P135_TRIAL_FEEDBACK.md`](../docs/P135_TRIAL_FEEDBACK.md).

## Launch comparison summary (P136)

With the **repository root** open, the **Models** tab loads `reports/comparison_report.json` (regenerate from repo root with `torqa-comparison-report` after benchmark changes). Narrative: [`docs/COMPARISON_REPORT.md`](../docs/COMPARISON_REPORT.md). The GPT/Claude/Gemini table below remains **reference-only** from `reports/token_proof.json`.

## Demo & video kit (P138)

Recording script (this app’s flow), proof narrative, and screenshot checklist: [`docs/P138_DEMO_AND_VIDEO_KIT.md`](../docs/P138_DEMO_AND_VIDEO_KIT.md) · [`examples/demo_kit/VIDEO_SCRIPT.md`](../examples/demo_kit/VIDEO_SCRIPT.md).

## Tests (P74)

```bash
cd desktop
npm run test
```

Python CLI shapes the UI relies on are also checked in-repo: `pytest tests/test_desktop_torqa_contract.py`.

## Prompt → `.tq` (P76 / P129 / P130)

With a workspace open, the **prompt strip** calls `torqa --json generate-tq --workspace <ws> --prompt-stdin` (stdin = your text). Core runs `src.ai.tq_adapter.suggest_tq_from_prompt`: the selected provider returns JSON with a `tq` field → **parse + diagnostics + quality gate** loop (same rules as `torqa surface`). Weak specs are refined or rejected before acceptance. Output is saved as `generated_<timestamp>.tq`.

**API keys (pick one or more):** `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY` or `GEMINI_API_KEY`. Default vendor: `TORQA_LLM_PROVIDER` or **openai**. The desktop **Models** strip sets provider, optional model ids, **generation mode** (`balanced` / `cheapest` / `fastest` / `highest_quality` / `most_reliable`), and optional same-provider **fallback model** — mirrored on the CLI as `--llm-provider`, `--model`, `--llm-gen-mode`, `--fallback-model`.

JSON responses include **usage / cost (OpenAI)**, **quality score**, **`llm_comparison_metrics`**, and **`reliability`** (first-pass vs repaired success for that run). The **Build from prompt** flow (`torqa --json app`) exposes the same telemetry under `stages.generate`.

CLI only:

```bash
echo "minimal login flow" | torqa --json generate-tq --workspace /path/to/ws --prompt-stdin
```

## First-trial onboarding (P131)

On first launch the **home** screen shows one short line of what TORQA does, then **Choose folder** → prompt → **Build**. Dismissible hints nudge you after folder pick, after a successful build, and for preview / compare — no tutorial wall or blocking modal. Progress is stored locally (`localStorage` key `torqa.p131.v1`).

## First-run samples

With a folder open: **Quick demo (sample + validate)**, **Load minimal sample**, or **Load flagship sample** — copies repo examples into `<workspace>/torqa_samples/` and opens the `.tq` file (core-only checks).

## Security

Open **trusted** folders only. The main process restricts file IO to the selected workspace (path checks).

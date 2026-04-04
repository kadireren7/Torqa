# TORQA Desktop (official — P69 / P71)

Native **Electron + React** shell for `.tq` projects. **All validation, IR, build, and benchmark logic runs in TORQA core** via `python -m torqa` subprocesses from the main process. This folder is **UI + IPC only**.

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

Production-style:

```bash
cd desktop
npm run build
npm start
```

## Tests (P74)

```bash
cd desktop
npm run test
```

Python CLI shapes the UI relies on are also checked in-repo: `pytest tests/test_desktop_torqa_contract.py`.

## Prompt → `.tq` (P76)

With a workspace open, the **prompt strip** calls `torqa --json generate-tq --workspace <ws> --prompt-stdin` (stdin = your text). Core runs `src.ai.tq_adapter.suggest_tq_from_prompt`: OpenAI → JSON `{"tq": "..."}` → **parse + full diagnostics** loop (same rules as `torqa surface`). Output is saved as `generated_<timestamp>.tq`. Requires **`OPENAI_API_KEY`** (repo `.env` is loaded by the Python process).

CLI only:

```bash
echo "minimal login flow" | torqa --json generate-tq --workspace /path/to/ws --prompt-stdin
```

## First-run samples

With a folder open: **Quick demo (sample + validate)**, **Load minimal sample**, or **Load flagship sample** — copies repo examples into `<workspace>/torqa_samples/` and opens the `.tq` file (core-only checks).

## Security

Open **trusted** folders only. The main process restricts file IO to the selected workspace (path checks).

# TORQA Desktop — trial distribution (P133)

**Goal:** Ship a **real Windows installer** for external trials while keeping the **Python core** on the user’s machine (not bundled inside Electron).

---

## What the installer contains

- **TORQA Desktop** — Electron shell with bundled UI (`dist/` + `dist-electron/`).
- **Does not bundle** the TORQA Python engine. Users still need:
  - **Python 3.10+** on `PATH` (or `TORQA_PYTHON`)
  - **`pip install -e .`** from the **same TORQA repository** (or a copy with `pyproject.toml` + `src/`), or set **`TORQA_REPO_ROOT`** to that tree.

This matches [`desktop/README.md`](../desktop/README.md) and [`TRY_TORQA.md`](TRY_TORQA.md).

---

## Build the Windows installer (maintainers)

From **`desktop/`** (Node **20+**):

```bash
npm install
npm run pack:win
```

**Output:** `desktop/release/TORQA Desktop-Setup-<version>.exe` (NSIS, x64).

**Unpacked smoke build** (no installer; faster for QA):

```bash
npm run pack:win:dir
```

Output under `desktop/release/win-unpacked/` — run `TORQA Desktop.exe` from there.

**Repeatable flow:** always `npm run build` first (Typecheck + Vite + Electron main preload are part of `pack:win`).

---

## Release metadata (shipped in the app)

| Field | Source |
|-------|--------|
| **App name** | `productName`: **TORQA Desktop** (`desktop/package.json` → `build`) |
| **Version** | `desktop/package.json` **`version`** (currently aligned with desktop releases; independent of `pyproject.toml` `torqa` package version) |
| **App id / Windows** | `build.appId`: `dev.torqa.desktop` · `app.setAppUserModelId` in Electron main (taskbar grouping) |
| **Icon** | `build/icon.png` (512×512 PNG; used by electron-builder for Windows) |
| **Description** | `package.json` **`description`** (installer / metadata) |

---

## Minimal install steps (for trial users)

1. **Clone or unpack** the TORQA repository (must include `pyproject.toml` and `src/`).
2. **Python:** install Python 3.10+; then from repo root:  
   `python -m pip install -e .`
3. **Windows app:** run **`TORQA Desktop-Setup-….exe`**, finish the installer.
4. **Launch** “TORQA Desktop” from the Start menu or desktop shortcut.
5. **API keys** (for prompt / build): set in-app or via `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_API_KEY` as documented in [`desktop/README.md`](../desktop/README.md).

If the app does not find the core, set environment variable **`TORQA_REPO_ROOT`** to the repository root and ensure **`python`** runs that install.

---

## Packaged app QA checklist (external trial)

Run through once per release candidate on a clean Windows profile (or VM):

| Step | Pass criteria |
|------|----------------|
| **Open folder** | Choose folder / open project; path shows in title area; tree loads. |
| **Prompt** | Enter text in prompt strip; no crash. |
| **Build** | **Build** runs `torqa app` / pipeline; success or clear failure panel. |
| **Preview** | After success, **Start preview** / split preview works when Node + npm exist (see [`DEMO_LOCALHOST.md`](DEMO_LOCALHOST.md)). |
| **Comparison** | Token / comparison UI and **Details** / compare expand as in dev build. |

Log issues with **version**, **Windows build**, and whether **`torqa --version`** works in the same environment.

---

## Related

- [`desktop/README.md`](../desktop/README.md) — dev, `torqa-desktop`, packaging
- [`TRY_TORQA.md`](TRY_TORQA.md) — official surfaces
- [`KNOWN_LIMITS.md`](KNOWN_LIMITS.md) — scope (core not in installer)

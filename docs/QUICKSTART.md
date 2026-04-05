# Quick Start (canonical)

**Goal:** install once, run one command with the **TORQA** CLI, see generated output. **Time:** about 5 minutes if Python is already set up.

## 0. Prerequisites

- **Python 3.10+** on `PATH`
- A shell **at the repository root** (the folder that contains `pyproject.toml`)

**Windows:** use PowerShell or cmd; paths below use `/` for readability — your shell accepts `\` too.

## 1. Install

From the repository root (folder that contains `pyproject.toml`):

```bash
python -m pip install -e .
```

(`pip install -e .` is equivalent if `pip` is the pip for the Python you want.)

This registers the **`torqa`** CLI via `[project.scripts]` in `pyproject.toml` — the same entrypoint as `python -m torqa`. Prefer a **venv** so scripts and dependencies stay isolated:

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
python -m pip install -e .
```

### Verify the command (recommended)

```bash
torqa --version
```

You should see `torqa` plus a version string. Then run a real subcommand (see §2).

**Non-editable install** (`python -m pip install .` from a sdist/wheel) also exposes `torqa` the same way; use that when you are not hacking on the repo.

## 2. First success (one command)

**Single flow:** `torqa build <your.tq>` — one command from surface spec to generated artifacts (default output dir below).

```bash
torqa build examples/workspace_minimal/app.tq
```

Output goes under `generated_out/` (under `--root`, default the current directory). You should see a **SUCCESS** line and paths to generated artifacts.

## 3. Quick smoke (optional)

```bash
torqa validate examples/core/valid_minimal_flow.json
```

Exit code `0` and `"ok": true` in JSON means the IR bundle shape checks passed.

## 4. What to try next

| Step | Where |
|------|--------|
| **Full map (surfaces + canonical trial)** | [TRY_TORQA.md](TRY_TORQA.md) — start here after Quick Start if you want one coherent path |
| **Public flagship trial (command index)** | Run `torqa demo` (repo root) then follow the printout — [FLAGSHIP_DEMO.md](FLAGSHIP_DEMO.md) · [`examples/benchmark_flagship/`](../examples/benchmark_flagship/) |
| **Flagship `.tq` → website** | [FIRST_REAL_DEMO.md](FIRST_REAL_DEMO.md) · [`examples/torqa_demo_site/app.tq`](../examples/torqa_demo_site/app.tq) |
| First **.tq** edits | Start from [`examples/torqa/templates/`](../examples/torqa/templates/) (`minimal.tq`, `session_only.tq`, `guarded_session.tq`, `login_flow.tq`, …); see [templates README](../examples/torqa/templates/README.md) |
| Guided **workspace** | [`examples/workspace_minimal/README.md`](../examples/workspace_minimal/README.md) |
| First **IR package** flow | [USING_PACKAGES.md](USING_PACKAGES.md) + [`examples/package_demo/`](../examples/package_demo/) |
| Native **desktop** (`.tq` editor, `torqa` CLI) | `torqa-desktop` after `cd desktop && npm install` — [desktop/README.md](../desktop/README.md) |
| Full doc index | [DOC_MAP.md](DOC_MAP.md) |

## If `torqa` is not found

After a successful install, Pip places a launcher next to that Python:

| OS | Typical location |
|----|------------------|
| **Windows** | `…\Python3xx\Scripts\torqa.exe` (or `…\.venv\Scripts\torqa.exe` in a venv) |
| **macOS / Linux** | `…/bin/torqa` (same `bin` as `python3`) |

If that directory is **not** on `PATH`, the shell will not resolve `torqa` even though the install succeeded.

**Find the launchers folder for *this* Python** (works on Windows, macOS, and Linux):

```bash
python -c "import sysconfig; print(sysconfig.get_path('scripts'))"
```

That directory should contain `torqa` (or `torqa.exe` on Windows). Add it to your user `PATH` if needed, **or** activate the venv you installed into (activation usually prepends that folder to `PATH` automatically).

**Same CLI without fixing PATH** — call the module entry (always uses the current interpreter):

```bash
python -m torqa --version
python -m torqa build examples/workspace_minimal/app.tq
```

Equivalent low-level form (same `main()` as the `torqa` script):

```bash
python -m src.cli.main build examples/workspace_minimal/app.tq
```

Use **`torqa` directly** once `Scripts`/`bin` is on PATH — that is the supported primary experience after install.

## See also

- **Canonical try map (P132):** [TRY_TORQA.md](TRY_TORQA.md)
- **After first build:** [FIRST_PROJECT.md](FIRST_PROJECT.md)
- **Product fit & limits:** [WHAT_TORQA_DOES_BEST.md](WHAT_TORQA_DOES_BEST.md) · [KNOWN_LIMITS.md](KNOWN_LIMITS.md)
- **Maturity / expectations:** [../STATUS.md](../STATUS.md)
- **Releases & versions:** [RELEASE_AND_VERSIONING.md](RELEASE_AND_VERSIONING.md)

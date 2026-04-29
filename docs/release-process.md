# Torqa Python package — release process (PyPI)

This document is the **canonical** checklist for versioning and publishing the **`torqa`** distribution defined in `pyproject.toml`. For historical context on SemVer, see also [releasing.md](./releasing.md).

## Version bump policy

| Rule | Detail |
|------|--------|
| **Single source of truth** | Version lives in `pyproject.toml` → `[project] version`. |
| **Runtime** | `torqa version` reads `importlib.metadata.version("torqa")` — must match the built wheel/sdist. |
| **SemVer** | While major is `0`, treat **MINOR** as feature tracks and **PATCH** as fixes/docs. Breaking CLI or IR contract → document in CHANGELOG; reserve **1.0.0** for a declared stability baseline. |
| **Changelog** | Before tagging: ensure `CHANGELOG.md` has a **`[x.y.z] — YYYY-MM-DD`** section and a fresh empty **`[Unreleased]`** at the top; add compare links at the bottom. |
| **Tags** | Use **`v` + version**, e.g. `v0.1.6`, matching the workflow trigger in `.github/workflows/release.yml`. |

## What ships in the wheel

| Content | Location / mechanism |
|---------|----------------------|
| **`torqa` package** | `src/torqa/` via `[tool.setuptools.packages.find]` |
| **`py.typed`** | Listed in `[tool.setuptools.package-data]` |
| **Semantic warning policy** | `src/torqa/data/semantic_warning_policy_bundle.json` (also duplicated at repo root for editable installs / sdist docs) |
| **Quickstart sample** | `src/torqa/bundled/examples/integrations/customer_support_n8n.json` |
| **Not in the wheel** | `spec/`, full `examples/`, `tests/`, `docs/` — still included in **sdist** via `MANIFEST.in` for downstream packagers and source-only workflows |

Maintainers do **not** need to duplicate every example inside `torqa/`; users who want the full tree should clone the repository or install from a Git URL.

## Local build (maintainer)

Use a **clean** `dist/` so `twine upload` does not pick up stale wheels from earlier versions:

```bash
pip install --upgrade pip
pip install "build>=1.2" "twine>=5"
rm -rf dist build src/*.egg-info   # PowerShell: Remove-Item -Recurse -Force dist, build, src\torqa.egg-info
python -m build
python -m twine check dist/*
```

Optional smoke from wheel:

```bash
pip uninstall -y torqa 2>/dev/null || true
pip install dist/torqa-*.whl
torqa version
torqa quickstart
```

## TestPyPI (dry run — no production publish)

1. **Create** a [TestPyPI](https://test.pypi.org) account and an **API token** scoped to the `torqa` project (or create the project name there first).
2. **Upload** (token as password; `__token__` username):

   ```bash
   python -m twine upload --repository testpypi dist/*
   ```

   Or set in `~/.pypirc`:

   ```ini
   [testpypi]
   repository = https://test.pypi.org/legacy/
   username = __token__
   password = <testpypi-token>
   ```

3. **Install** (TestPyPI does not mirror all deps; pull production index for non-Torqa packages):

   ```bash
   pip install --index-url https://test.pypi.org/simple/ \
     --extra-index-url https://pypi.org/simple/ \
     torqa==0.1.6
   ```

4. **Verify** `torqa version` and `torqa quickstart`.

## Production PyPI (manual remainder)

Until you intentionally publish:

- [ ] Claim **`torqa`** on [pypi.org](https://pypi.org) (name availability).
- [ ] Prefer **Trusted Publishing (OIDC)** from GitHub Actions (see `.github/workflows/release.yml`) — no long-lived PyPI token in secrets.
- [ ] Or configure a **scoped API token** as a secret and use `twine upload dist/*` / `pypa/gh-action-pypi-publish` with `password: ${{ secrets.PYPI_API_TOKEN }}` (not the default OIDC path).

**This repository’s CI does not upload to production PyPI** until you push a matching `v*.*.*` tag and complete PyPI + GitHub configuration.

## GitHub Actions

- **PR / main:** [.github/workflows/packaging.yml](../.github/workflows/packaging.yml) — `ruff`, `pytest`, `python -m build`, `twine check`.
- **Release:** [.github/workflows/release.yml](../.github/workflows/release.yml) — builds on `v*.*.*` tags, uploads **`dist/`** as a workflow artifact, then runs **`pypa/gh-action-pypi-publish`** (OIDC by default).

To publish to **TestPyPI** from CI, add a separate workflow or job with `with: repository-url: https://test.pypi.org/legacy/` and a TestPyPI-trusted publisher or token — not enabled by default here.

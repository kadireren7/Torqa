# Release and versioning (practical)

## What “version” means here

- **PyPI / `pyproject.toml` `version`:** marketing and API packaging semver (e.g. `1.0.0`). Bump when you cut a release users install with `pip`.
- **IR interchange:** separate from package semver — see [IR_VERSIONING.md](IR_VERSIONING.md) and `CANONICAL_IR_VERSION` in code.

## GitHub releases (optional)

1. Tag matches the version you want users to cite: `v1.0.0` aligned with `pyproject.toml`.
2. **CHANGELOG.md** has a section for that version ([Keep a Changelog](https://keepachangelog.com/) style).
3. Release notes can paste the changelog section; no extra ceremony required.

## Stability label (honest)

TORQA is **early usable** and **developer-focused**: the CLI, IR validation, and examples are meant to be tried in a repo or venv — not positioned as a fully packaged end-user product. See [STATUS.md](../STATUS.md) for what is solid vs partial vs experimental.

## Distribution today

- **From source:** `pip install -e .` from a git checkout (primary path in [QUICKSTART.md](QUICKSTART.md)).
- **Docker:** `docker compose up --build` for the local marketing/API host ([README.md](../README.md)) — same surface rules as `torqa-console` ([TRY_TORQA.md](TRY_TORQA.md)).
- **Published wheel:** if/when you publish to PyPI, document the install line in README for that release.

Do not promise stability beyond what CHANGELOG and STATUS describe.

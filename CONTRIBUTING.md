# Contributing to Torqa

Thanks for taking the time to contribute. This project is intentionally small: a **spec core** (IR + validation + trust evaluation), not a runtime or platform. Keeping that boundary clear helps reviews stay fair and fast.

## What we value

- **Honest changes** — Docs and tests that match what the code does today.
- **Determinism** — Policy, risk, and CLI output stay stable unless a version bump or migration says otherwise.
- **Respectful discussion** — Disagreement is fine; keep feedback specific and actionable.

## Before you start

1. Skim **[README](README.md)** (scope and non-goals) and **[docs/roadmap.md](docs/roadmap.md)** (what is in / out of scope).
2. If your idea is large (new IR fields, new trust rules, parser surface changes), **open an issue first** so maintainers can confirm direction before you invest heavily.
3. For small fixes (docs, tests, typos), a PR alone is usually enough.

## Development setup

**Requirements:** Python **3.10+** (see `pyproject.toml`).

```bash
git clone <your-fork-or-repo-url>
cd Project-X   # or your clone directory
pip install -e ".[dev]"
```

Run the full test suite before opening a PR:

```bash
python -m pytest
```

On Windows, if `torqa` is not on `PATH`, use `python -m src.torqa_cli` (see [Quickstart — Windows](docs/quickstart.md#if-torqa-is-not-found-often-on-windows)).

Optional: `jsonschema` is pulled in via `[dev]` for schema-related checks in tests.

## Making a change

- **Match existing style** — Naming, imports, and test patterns in the touched files.
- **Add or update tests** — Behavior changes should have coverage in `tests/`. CLI changes: extend or add `tests/test_cli_*.py` where appropriate.
- **Update docs when users see a difference** — CLI flags, JSON shapes, trust behavior, or examples.
- **Keep diffs focused** — Unrelated refactors make review harder; split cleanup into separate PRs when possible.

## Pull requests

- Use a clear title and description: **what** changed and **why** (link an issue if one exists).
- Confirm **`python -m pytest` passes** locally.
- If you are unsure about API or IR contract changes, say so in the PR — that speeds feedback.

## What usually does *not* belong here

Aligned with [Roadmap — explicit non-goals](docs/roadmap.md): workflow runtimes, hosted SaaS, bundled LLM products, or “silent” weakening of validation. Proposals that blur those lines may be declined even if well intentioned.

## License

By contributing, you agree that your contributions are licensed under the same terms as the project: **[MIT](LICENSE)**.

## Where to look next

- **[GOOD_FIRST_ISSUES.md](GOOD_FIRST_ISSUES.md)** — Suggested entry points (honest about difficulty).
- **[docs/architecture.md](docs/architecture.md)** — Layers and where code lives; includes **contribution notes** at the bottom.
- **[docs/status.md](docs/status.md)** — Repository audit, adoption expectations, and pre-v1 gap notes (not a release promise).
- **Issues:** use the repository’s issue tracker linked from `pyproject.toml` under `[project.urls]`.

# TORQA

**Semantic-first core for describing system behavior** — canonical IR, validation, and projections (web, SQL, stubs) so humans and tools share one structured model. Not “another syntax-first language”; **meaning and checks come first**.

---

## Status (read this first)

| | |
|--|--|
| **Maturity** | **Early usable**, **developer-focused** — solid CLI, IR `1.4`, tests, and examples; not a shrink-wrapped product. |
| **Best for** | Teams and builders who want **validated specs + codegen**, AI-assisted or not. |
| **Product story** | Deeper direction: [`docs/TORQA_VISION_NORTH_STAR.md`](docs/TORQA_VISION_NORTH_STAR.md) · maturity detail: [`STATUS.md`](STATUS.md) |

---

## Try it in three steps

**Full walkthrough (install, Windows, fallbacks):** **[`docs/QUICKSTART.md`](docs/QUICKSTART.md)** ← start here if you are new.

1. **Install** (repo root, Python 3.10+):

   ```bash
   pip install -e .
   ```

2. **First build** (one command):

   ```bash
   torqa build examples/workspace_minimal/app.tq
   ```

3. **Next:** [`docs/FIRST_PROJECT.md`](docs/FIRST_PROJECT.md) — edit a `.tq` template, then optional IR packages ([`docs/USING_PACKAGES.md`](docs/USING_PACKAGES.md)).

If `torqa` is not on `PATH` (common on Windows when `Scripts` is missing from `PATH`): `python -m torqa build examples/workspace_minimal/app.tq` — or `python -m src.cli.main …` (same entrypoint).

---

## Why TORQA is different

- **Explicit semantics** and **diagnostics** (formal phases) instead of “hope the codegen matches intent.”
- **One IR** can drive multiple surfaces (see `torqa build` output under `generated_out/`).
- **AI-friendly:** structured output and validation hooks; see north star doc above.

---

## Showcase examples (pick one track)

| Track | Start here |
|-------|------------|
| **First `.tq`** | [`examples/workspace_minimal/app.tq`](examples/workspace_minimal/app.tq) + [`examples/torqa/templates/`](examples/torqa/templates/) |
| **Illustrative flows** | [`examples/torqa/auth_login.tq`](examples/torqa/auth_login.tq), [`examples/torqa/signin_flow.tq`](examples/torqa/signin_flow.tq) |
| **IR package + compose** | [`docs/USING_PACKAGES.md`](docs/USING_PACKAGES.md) · runnable tree [`examples/package_demo/`](examples/package_demo/) |
| **TORQA → TORQA (self-host)** | [`examples/torqa_self/`](examples/torqa_self/) + [`docs/SELF_HOST_MAP.md`](docs/SELF_HOST_MAP.md) — grouped policy bundles; quick index: `torqa --json language --self-host-catalog` |

---

## Documentation hub

**[`docs/DOC_MAP.md`](docs/DOC_MAP.md)** — all entry points (specs, roadmap, security, packages).

| Doc | Role |
|-----|------|
| [QUICKSTART.md](docs/QUICKSTART.md) | Canonical install + first success |
| [FIRST_PROJECT.md](docs/FIRST_PROJECT.md) | After first build |
| [USING_PACKAGES.md](docs/USING_PACKAGES.md) | IR packages + compose |
| [PACKAGE_DISTRIBUTION.md](docs/PACKAGE_DISTRIBUTION.md) | Publish / fetch / `ref:` |
| [RELEASE_AND_VERSIONING.md](docs/RELEASE_AND_VERSIONING.md) | Tags, changelog, stability wording |
| [CHANGELOG.md](CHANGELOG.md) | Release notes |
| [ROADMAP.md](ROADMAP.md) | Staged direction (EN) |

**Cheatsheet:** [`docs/TQ_AUTHOR_CHEATSHEET.md`](docs/TQ_AUTHOR_CHEATSHEET.md) · **Run generated web UI:** [`docs/DEMO_LOCALHOST.md`](docs/DEMO_LOCALHOST.md).

---

## Developer setup

```bash
pip install -r requirements-dev.txt
pip install -e ".[dev]"
python -m pytest
```

Optional Rust: `cargo test --manifest-path rust-core/Cargo.toml`

**Web console:** `pip install -r requirements.txt` then `torqa-console` or `python -m webui`. Docker: `docker compose up --build` → `http://127.0.0.1:8000`.

**IDE:** open [`Torqa.code-workspace`](Torqa.code-workspace) so the window title shows TORQA.

**Maintainer checks:** [`docs/MAINTAINER_VERIFY.md`](docs/MAINTAINER_VERIFY.md).

---

## Authoritative surfaces

| Surface | Where |
|---------|--------|
| CLI | `torqa` → [`src/cli/main.py`](src/cli/main.py) |
| Python embed | [`src/torqa_public.py`](src/torqa_public.py) · [`docs/PACKAGE_SPLIT.md`](docs/PACKAGE_SPLIT.md) |
| IR schema | [`spec/IR_BUNDLE.schema.json`](spec/IR_BUNDLE.schema.json) |

Legacy: [`compat/`](compat/) — prefer `torqa` or `torqa_public` for new work.

---

## Security

[`docs/PROTOTYPE_SECURITY.md`](docs/PROTOTYPE_SECURITY.md) — treat AI output and generated code as **untrusted** until reviewed; do not expose the console to the public internet without hardening.

---

## Contributing

[`CONTRIBUTING.md`](CONTRIBUTING.md)

---

## License

[MIT License](LICENSE)

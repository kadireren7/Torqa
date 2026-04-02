# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) where applicable.

IR interchange versioning is separate from package semver — see [`docs/IR_VERSIONING.md`](docs/IR_VERSIONING.md) and bump checklist when changing `CANONICAL_IR_VERSION`.

## [Unreleased]

### Documentation

- **CLI ergonomics:** `python -m torqa …` now matches the `torqa` console script via a small `torqa/` package (`__main__` → `src.cli.main`), so Windows installs without `Scripts` on `PATH` still have a documented one-liner (see [docs/QUICKSTART.md](docs/QUICKSTART.md)).
- **P17 (productization):** [docs/SELF_HOST_MAP.md](docs/SELF_HOST_MAP.md) groups all self-host `.tq` areas (guidance, limits, ordering, language reference); [examples/torqa_self/README.md](examples/torqa_self/README.md) reorganized by group; [src/torqa_self/bundle_registry.py](src/torqa_self/bundle_registry.py) documents the same model and exposes `self_host_catalog()` + `SINGLE_FLOW_LINE`. CLI: `torqa --json language --self-host-catalog` for a machine-readable index (no new policy bundles).
- Adoption polish: canonical [docs/QUICKSTART.md](docs/QUICKSTART.md), [docs/FIRST_PROJECT.md](docs/FIRST_PROJECT.md), [docs/RELEASE_AND_VERSIONING.md](docs/RELEASE_AND_VERSIONING.md); README reorganized for first-time users; [STATUS.md](STATUS.md) and [DOC_MAP.md](docs/DOC_MAP.md) entry links.

### Self-host seed (Priority 11)

- [examples/torqa_self/cli_onboarding.tq](examples/torqa_self/cli_onboarding.tq) models default CLI onboarding hint order; [src/torqa_self/onboarding_ir.py](src/torqa_self/onboarding_ir.py) loads committed [examples/torqa_self/cli_onboarding_bundle.json](examples/torqa_self/cli_onboarding_bundle.json) for `onboarding_suggested_next_prefix()` in [src/diagnostics/user_hints.py](src/diagnostics/user_hints.py).
- **P11.1:** [examples/torqa_self/cli_surface_project_fail_suffix.tq](examples/torqa_self/cli_surface_project_fail_suffix.tq) models the three suffix lines for `suggested_next_for_surface_or_project_fail()`; [src/torqa_self/surface_fail_hints_ir.py](src/torqa_self/surface_fail_hints_ir.py) loads [examples/torqa_self/cli_surface_project_fail_suffix_bundle.json](examples/torqa_self/cli_surface_project_fail_suffix_bundle.json).
- **P11.2:** [examples/torqa_self/cli_report_suggested_next_order.tq](examples/torqa_self/cli_report_suggested_next_order.tq) models scan order for `suggested_next_from_report()` line slugs; [src/torqa_self/report_suggested_next_ir.py](src/torqa_self/report_suggested_next_ir.py) loads [examples/torqa_self/cli_report_suggested_next_order_bundle.json](examples/torqa_self/cli_report_suggested_next_order_bundle.json) (issue-code predicates remain in Python).

### Self-host layer (Priority 12)

- Central taxonomy: [examples/torqa_self/language_reference_taxonomy.tq](examples/torqa_self/language_reference_taxonomy.tq) drives six ordered lists in `language_reference_payload()` / `torqa language` via [src/torqa_self/language_reference_taxonomy_ir.py](src/torqa_self/language_reference_taxonomy_ir.py) (string values bridged in Python; builtins/registry unchanged).
- [src/torqa_self/bundle_io.py](src/torqa_self/bundle_io.py) and [src/torqa_self/bundle_registry.py](src/torqa_self/bundle_registry.py) consolidate bundle reads and the canonical list of `.tq` / bundle pairs; [scripts/validate_self_host_bundles.py](scripts/validate_self_host_bundles.py) + CI + `tests/test_torqa_self_bundle_drift.py` guard against drift.
- **P12.1:** [examples/torqa_self/layered_authoring_passes.tq](examples/torqa_self/layered_authoring_passes.tq) drives `layered_authoring_passes` in `language_reference_payload()` via [src/torqa_self/layered_authoring_passes_ir.py](src/torqa_self/layered_authoring_passes_ir.py) (registered for drift with the other self-host pairs).
- **P13:** TORQA-backed prefix for the first three `rules` lines in `language_reference_payload()` ([examples/torqa_self/language_reference_rules_prefix.tq](examples/torqa_self/language_reference_rules_prefix.tq) + [src/torqa_self/language_reference_rules_ir.py](src/torqa_self/language_reference_rules_ir.py)).
- **P13.1:** Prefix bundle grew to five lines (`policy_rule_unique_ids`, `policy_rule_aem_chain` moved from the former Python suffix).
- **P13.2:** All **seven** `rules` lines are TORQA-ordered via the same bundle (`policy_rule_diagnostics_full`, `policy_rule_multi_surface`); `_RULES_SUFFIX` removed — mapping + `_FALLBACK_PREFIX` only.

### Self-host expansion (Priority 14)

- [examples/torqa_self/language_reference_condition_patterns.tq](examples/torqa_self/language_reference_condition_patterns.tq) drives `language_reference_payload.condition_id_patterns` (slug order → dict insertion order; pattern strings mapped in [src/torqa_self/language_reference_condition_patterns_ir.py](src/torqa_self/language_reference_condition_patterns_ir.py)).
- **P14.1:** [examples/torqa_self/language_reference_prose_refs.tq](examples/torqa_self/language_reference_prose_refs.tq) supplies `diagnostics_issue_shape` and `aem_execution` via [src/torqa_self/language_reference_prose_refs_ir.py](src/torqa_self/language_reference_prose_refs_ir.py) (slug identity → payload field; prose in Python).

### Behavior-level self-host (Priority 15)

- [examples/torqa_self/cli_suggested_next_merge_cap.tq](examples/torqa_self/cli_suggested_next_merge_cap.tq) selects the max length for deduped CLI/web `suggested_next` merges via [src/torqa_self/suggested_next_merge_cap_ir.py](src/torqa_self/suggested_next_merge_cap_ir.py) (`sn_merge_cap_*` → int; default bundle `sn_merge_cap_10`). Which hints appear is unchanged; only the list cap is policy-driven.
- **P15.1:** Same bundle adds `sn_display_cap_*` (4 / 6 / 8) for how many `suggested_next` lines print under human `torqa surface` stderr **Next:** after a `.tq` parse error (default `sn_display_cap_6`, matching the former hardcoded slice). JSON `suggested_next` arrays are unchanged.
- **P16 (decision-layer self-host):** [examples/torqa_self/cli_suggested_next_merge_order.tq](examples/torqa_self/cli_suggested_next_merge_order.tq) selects whether the onboarding prefix is merged **before** or **after** context-specific lines (`sn_merge_order_onboarding_first` vs `sn_merge_order_context_first`) via [src/torqa_self/suggested_next_merge_order_ir.py](src/torqa_self/suggested_next_merge_order_ir.py). Python still builds prefix and `rest` and dedupes; only block order is policy.
- **P16.1:** Same bundle adds `sn_secondary_report_order_scan` vs `sn_secondary_report_order_surface_first`: among lines selected by `suggested_next_from_report` only, if both sem and surface hints appear with sem before surface, policy can move the surface line immediately before the sem line. Issue predicates and primary slug scan order are unchanged; fallback is scan-order (legacy).

## [1.0.0] - 2026-04-02

First **production semver** aligned with [`docs/TORQA_VISION_NORTH_STAR.md`](docs/TORQA_VISION_NORTH_STAR.md) §7: green CI (`pytest`, Rust, Vite smoke), single CLI + `src/torqa_public.py` entry surface, `torqa project` / materialize + zip API, `docs/PACKAGE_SPLIT.md` core API, `CHANGELOG` + README discipline, and a minimal `packages/js/torqa-types` stub for future `@torqa/*` publishing.

### Added

- **Packages:** `packages/js/torqa-types/` placeholder `package.json` + README (schema path from monorepo root).

### Changed

- Package version **1.0.0** (IR versioning remains per [`docs/IR_VERSIONING.md`](docs/IR_VERSIONING.md)).

## [0.1.0] - 2026-04-02

### Added

- **F1 / F2 roadmap:** `torqa project` supports `--root`, `--source`, `.tq`/`.pxir` sources; JSON summary includes `written` and `errors`; shared `src/project_materialize.py` and `src/torqa_public.py`.
- **F3:** Web API `POST /api/materialize-project-zip` (zip download, no server path arguments).
- **F4:** Maintainer verify doc, codegen inventory, package split doc, web security doc, path sanitization for artifact names.
- **F5:** `examples/packages/demo_lib/` sample + consuming bundle test; preview-package template doc.
- **Workspace example:** `examples/workspace_minimal/` with two-command README.

### Changed

- Package version set to **0.1.0** (initial “shaped release” marker alongside IR 1.4).


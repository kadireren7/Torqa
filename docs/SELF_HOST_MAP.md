# Self-host policy map (P17)

TORQA describes **parts of its own** CLI hints and `torqa language` payload as `.tq` → committed IR bundles under `examples/torqa_self/`. This doc groups them for **operators, demos, and debugging** — not a second spec.

## Single flow (product)

**One sentence:** run `torqa build <path-to-your.tq>` (or `.json` / `.pxir`) from the project root; output lands under `generated_out/` by default — see [QUICKSTART.md](QUICKSTART.md).

Self-host bundles do **not** change that flow; they tune hint text, caps, and ordering where noted below.

## Machine-readable index

```bash
torqa --json language --self-host-catalog
```

Emits `single_flow`, `group_blurbs`, and `entries[]` (paths, group, role, primary Python modules). Same data is defined in `src/torqa_self/bundle_registry.py`.

---

## 1. Inventory by area

| Area | Role | Consumed in | Users usually see it? |
|------|------|-------------|------------------------|
| **Onboarding** (`cli_onboarding`) | First `suggested_next` lines in many merges | `user_hints`, CLI, Web | Yes (hint lists) |
| **Surface/project fail suffix** (`cli_surface_project_fail_suffix`) | Extra lines after onboarding for surface/project errors | `user_hints` | Yes |
| **Report line order** (`cli_report_suggested_next_order`) | Order for scanning `report_next_*` slugs | `suggested_next_from_report` | Indirectly (JSON `suggested_next`) |
| **Merge cap + display cap** (`cli_suggested_next_merge_cap`) | Max merged list length; human `Next:` line count on `.tq` parse errors | `user_hints`, `cmd_surface` stderr | Yes (truncation) |
| **Merge order + secondary order** (`cli_suggested_next_merge_order`) | Onboarding vs context first; optional sem/surface tie-break | `user_hints` | Indirectly |
| **Language reference taxonomy** | Taxonomy lists in language payload | `language_reference_payload` | If they run `torqa language` |
| **Layered authoring passes** | Authoring pass list | `language_reference_payload` | `torqa language` |
| **Rules prefix** | Seven `rules` lines order | `language_reference_payload` | `torqa language` |
| **Condition patterns** | `condition_id_patterns` key order | `language_reference_payload` | `torqa language` |
| **Prose refs** | Diagnostics / AEM prose slots | `language_reference_payload` | `torqa language` |

---

## 2. Grouping (mental model)

| Group | Members | Idea |
|-------|---------|------|
| **Guidance** | onboarding, surface_fail_suffix, report_order | *What* to suggest and *which order* to scan report lines |
| **Limits** | merge_cap (incl. display cap) | *How many* lines to keep or print |
| **Ordering** | merge_order (incl. secondary report order) | *Which block first* and small tie-breaks among selected lines |
| **Language reference** | taxonomy, layered_passes, rules, condition_patterns, prose_refs | `torqa language` reference document |

---

## 3. Naming (stability)

Historical **P11–P16.1** file names and **slug** identifiers in bundles are **stable** (drift tests, downstream notes). P17 adds **documentation and catalog labels only** — no renames of `.tq` / `.json` / slugs in this priority.

---

## 4. Maintainer

- Registry: `src/torqa_self/bundle_registry.py`
- Drift: `tests/test_torqa_self_bundle_drift.py`, `python scripts/validate_self_host_bundles.py`
- Human table: `examples/torqa_self/README.md`

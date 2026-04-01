# Deprecation map

| Item | Status | Replacement |
|------|--------|-------------|
| Root-level `*.py` shims | **shim** | Import from `src.*` |
| `CoreGoal` execution path in `kural_parser` | **transitional** | IR-native pipeline |
| Python as sole semantic authority | **deprecated** | Rust-preferred per `rust_dominance_status` |

Nothing listed here is removed without a tracked migration; see `v4_cleanup_and_deprecation_plan.md` for history.

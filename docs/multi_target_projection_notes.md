# Multi-target projection notes (V1.4)

## Primary vs secondary targets

- **Primary target**: the main production surface selected by strategy scoring (highest fit/confidence).
- **Secondary targets**: additional justified projections that complement the primary surface.

Secondary targets must be meaningful and non-duplicative (language + purpose pair must differ from primary).

## Purpose surfaces

Supported purpose categories include:

- core_runtime
- service_backend
- tooling_bridge
- editor_integration
- storage_surface
- frontend_surface
- systems_extension
- cli_tool

## Why multi-target is valid

One canonical IR can legitimately project to multiple surfaces:

- runtime engine + tooling bridge
- backend runtime + SQL storage surface
- runtime core + frontend integration layer

Examples:

- Rust + Python (core runtime + tooling bridge)
- Rust + SQL (runtime + storage surface)
- Rust + TypeScript + SQL (runtime + frontend + persistence)
- Go + SQL (service backend + storage)
- C++ + Python (systems extension + integration bridge)

## Architectural intent

Projection is a strategy layer, not a single-language lock.

- IR remains canonical.
- Strategy decides targets dynamically from semantics/runtime/context.
- Generation comes after strategy selection.

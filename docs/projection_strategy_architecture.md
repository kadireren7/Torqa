# Projection strategy architecture (V1.4)

This document defines the projection decision layer introduced in V1.4.

## Core principle

Projection selection is **AI-style strategy-driven**, not fixed by domain mapping.

- The engine scores multiple candidate languages against:
  - canonical IR structure
  - semantic report quality
  - runtime/execution profile (when available)
  - explicit projection context priorities
- It chooses one primary target and optional secondary targets.

## Source of truth

- Canonical IR remains the sole source of truth.
- Projection strategy does not inspect parser AST, Turkish syntax, or CoreGoal internals.
- This keeps the architecture aligned with Rust-first core separation.

## Dynamic, open-ended language choice

V1.4 currently supports:

- rust
- go
- cpp
- python
- typescript
- sql

These are not hardwired to specific domains. They are ranked each run from scored fit dimensions.

## Why Rust still often dominates

The roadmap and scoring context typically favor Rust for core runtime (safety + deterministic systems execution), but this is not enforced as a fixed rule. Alternative or multi-target strategies are valid when scores justify them.

## Planning before generation

This step produces a projection plan only:

- primary target
- secondary targets
- reasons
- confidence
- strategy notes

No full production code generation occurs at this stage.

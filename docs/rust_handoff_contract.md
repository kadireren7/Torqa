# Rust handoff contract (V1.1)

This document defines how the Python prototype relates to the future Rust core engine. It is English-only and advisory for implementers.

## Authoritative interchange

- The **exported JSON bundle** from `export_ir_bundle()` / `export_ir_bundle_json()` is the **authoritative handoff artifact**. The Rust engine should deserialize this structure as its primary input.
- **`bundle_version`** and **`ir.ir_goal.metadata.ir_version`** are tied to **`CANONICAL_IR_VERSION`** in `canonical_ir.py` (see that file; **1.2** adds IR-native semantic layering in Python). They must match the contract the Rust crate implements.

## Normalization and fingerprint

- Before export, the prototype runs **`normalize_ir_goal()`**: semantic-preserving rules (commutative **`and`** / **`or`**, commutative **`==`** / **`!=`** operand ordering by stable JSON key; inputs sorted by name; trivial literal cleanup on identifiers).
- **`compute_ir_fingerprint()`** hashes the **full** `ir_goal_to_json(...)` payload (UTF-8, sorted keys, compact separators) with **SHA-256**, emitted as lowercase hex in **`metadata.ir_fingerprint`** and duplicated under **`determinism.ir_fingerprint`** for cross-checks.
- The fingerprint is defined **after** normalization so repeated exports of the same semantic IR yield **identical** bundle bytes (subject to the same `CANONICAL_IR_VERSION`).

## Stable boundary identifiers

- **`condition_id`**: deterministic strings `c_req_NNNN`, `c_forbid_NNNN`, `c_post_NNNN` assigned in source order during `core_to_ir()`. They are stable for a fixed rule text and must appear in JSON.
- **`transition_id`**: deterministic `t_NNNN` in effect source order. Intended for Rust diagnostics, execution traces, and incremental tooling.
- These IDs are **not** derived from fingerprints; they are stable ordinal labels at the IR boundary.

## Source map metadata

- **`ir.ir_goal.metadata.source_map`** is **`{"available": true, "prototype_only": true}`**: it states that optional source mapping may exist in the prototype **without** embedding Turkish (or any) raw source text in the canonical IR. Rust must **not** depend on this block for semantics.

## What is not the contract

- **Parser AST** (`Expr`, parser tokens) and **`CoreGoal`** are **Python semantic working models**. They are **not** cross-language contracts.
- **CLI-only** debug shapes and **execution** traces are orchestration artifacts unless explicitly duplicated inside the versioned bundle schema.

## Validation layers

- **`validate_ir`**: structural IR integrity.
- **`validate_ir_handoff_compatibility`**: stricter ASCII/key/operator rules for engine readiness.
- **`validate_ir_semantic_determinism`**: duplicate equivalent conditions or transitions under normalized expression equality.
- **`validate_export_bundle`**: post-build checks on the bundle object (version, fingerprint format, ID uniqueness, JSON round-trip).

The Rust core should implement equivalent **IR-level** and **bundle-level** checks where safety-critical.

## Python role

The Python stack remains **parser prototype**, **normalization**, and **orchestration** only. The **canonical core** is intended to move to Rust while continuing to consume this bundle format.

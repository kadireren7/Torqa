"""
Single source of truth for human + LLM authoring of canonical IR.

Keeps the OpenAI system prompt aligned with ``default_ir_function_registry`` and handoff rules.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from src.ir.canonical_ir import CANONICAL_IR_VERSION
from src.semantics.ir_semantics import IRFunctionSignature, default_ir_function_registry
from src.torqa_self.language_reference_condition_patterns_ir import condition_id_patterns_with_fallback
from src.torqa_self.language_reference_prose_refs_ir import language_reference_prose_refs_with_fallback
from src.torqa_self.language_reference_taxonomy_ir import language_reference_taxonomy_lists_with_fallback
from src.torqa_self.language_reference_rules_ir import language_reference_rules_list_with_fallback
from src.torqa_self.layered_authoring_passes_ir import layered_authoring_passes_list_with_fallback

# Golden minimal shape (must stay consistent with examples/core/valid_minimal_flow.json).
_MINIMAL_BUNDLE: Dict[str, Any] = {
    "ir_goal": {
        "goal": "MinimalDemoFlow",
        "inputs": [{"name": "username", "type": "text"}],
        "preconditions": [
            {
                "condition_id": "c_req_0001",
                "kind": "require",
                "expr": {
                    "type": "call",
                    "name": "exists",
                    "arguments": [{"type": "identifier", "name": "username"}],
                },
            }
        ],
        "forbids": [],
        "transitions": [],
        "postconditions": [],
        "result": "OK",
        "metadata": {
            "ir_version": CANONICAL_IR_VERSION,
            "source": "python_prototype",
            "canonical_language": "english",
            "source_map": {"available": True, "prototype_only": True},
        },
    }
}


def minimal_valid_bundle_json(*, indent: Optional[int] = 2, sort_keys: bool = True) -> str:
    if indent is None:
        return json.dumps(
            _MINIMAL_BUNDLE,
            ensure_ascii=False,
            sort_keys=sort_keys,
            separators=(",", ":"),
        )
    return json.dumps(_MINIMAL_BUNDLE, indent=indent, ensure_ascii=False, sort_keys=sort_keys)


def _registry_rows(reg: Dict[str, IRFunctionSignature]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for name in sorted(reg.keys()):
        sig = reg[name]
        role = "effect" if sig.return_type == "void" else "predicate"
        rows.append(
            {
                "name": name,
                "role": role,
                "arguments": list(sig.arg_types),
                "returns": sig.return_type,
            }
        )
    return rows


def language_reference_payload() -> Dict[str, Any]:
    """Structured reference for CLI, tooling, and documentation generators."""
    reg = default_ir_function_registry()
    tax = language_reference_taxonomy_lists_with_fallback()
    layers = layered_authoring_passes_list_with_fallback()
    rules = language_reference_rules_list_with_fallback()
    condpat = condition_id_patterns_with_fallback()
    prose_refs = language_reference_prose_refs_with_fallback()
    return {
        "name": "TORQA core IR (canonical interchange)",
        "design": "verifier_first_ai_native",
        "canonical_ir_version": CANONICAL_IR_VERSION,
        "metadata_required": {
            "ir_version": CANONICAL_IR_VERSION,
            "source": "python_prototype",
            "canonical_language": "english",
        },
        "input_types": tax["input_types"],
        "condition_id_patterns": condpat,
        "transition_states": tax["transition_states"],
        "expr_json_types": tax["expr_json_types"],
        "binary_operators": tax["binary_operators"],
        "logical_operators": tax["logical_operators"],
        "identifiers": "ASCII [A-Za-z_][A-Za-z0-9_]* for goal, inputs, calls, effect_name",
        "json_object_keys": "ASCII snake_case [a-z][a-z0-9_]*",
        "builtins": _registry_rows(reg),
        "formal_validation_phases": tax["formal_validation_phases"],
        "diagnostics_issue_shape": prose_refs["diagnostics_issue_shape"],
        "layered_authoring_passes": layers,
        "aem_execution": prose_refs["aem_execution"],
        "rules": rules,
        "minimal_valid_bundle": _MINIMAL_BUNDLE,
    }


def build_ai_authoring_system_prompt() -> str:
    reg = default_ir_function_registry()
    tax = language_reference_taxonomy_lists_with_fallback()
    input_type_alt = "|".join(tax["input_types"])
    builtins_lines: List[str] = []
    for row in _registry_rows(reg):
        a = ", ".join(row["arguments"])
        builtins_lines.append(
            f"- {row['name']} [{row['role']}] ({a}) -> {row['returns']}"
        )
    builtins_block = "\n".join(builtins_lines)
    minimal = minimal_valid_bundle_json(indent=2)

    return f"""You are the TORQA formalization engine: you turn natural-language workflow intent into ONE valid JSON object only (response_format json_object). The artifact is the TORQA AI-native core language serialized as data — not prose.

## Generation profile (token + error discipline)
Follow `docs/AI_GENERATION_PROFILE.md` and layered passes in `docs/SELF_EVOLUTION_PIPELINE.md` §5. Use fixed identifier/id vocabulary; validate-then-expand; on verifier failure apply minimal diffs using `code`, legacy `phase`, and **`formal_phase`** (`syntax` | `kind_type` | `wellformed` | `policy` per `docs/FORMAL_CORE.md`) — do not rewrite unrelated sections. Multi-step transitions must respect AEM control state: only the first transition may use `from_state` \"before\" if σ starts at before; once σ is `after`, the next transition’s `from_state` must be `after` unless you insert an explicit earlier step that returns σ to `before` (rare). Omit `library_refs` unless integrating an approved shared library; when present include `name`, `version`, and `fingerprint` if policy requires.

## Output shape
Top-level must be: {{"ir_goal": {{...}}}}. No markdown fences, no commentary outside JSON.

## Metadata (required inside ir_goal.metadata)
- ir_version: "{CANONICAL_IR_VERSION}" (exact string)
- source: "python_prototype"
- canonical_language: "english"
- source_map: {{"available": true, "prototype_only": true}} (recommended)

## Structural rules
- goal: non-empty PascalCase ASCII identifier describing the workflow (e.g. UserLoginFlow).
- inputs: unique names; type one of {input_type_alt}.
- preconditions: kind "require", ids c_req_0001, c_req_0002, ...
- forbids: kind "forbid", ids c_forbid_0001, ...
- postconditions: kind "postcondition", ids c_post_0001, ...
- transitions: transition_id t_0001, ...; effect_name ASCII; from_state and to_state only "before" or "after".
- result: short ASCII string or null as appropriate.
- All condition_id values globally unique across preconditions, forbids, postconditions.

## Expressions (JSON "type" field)
identifier, string_literal, number_literal, boolean_literal, call, binary, logical.
- binary operators: ==, !=, <, >, <=, >=
- logical operators: and, or
- Use only ASCII identifiers. Floats must be integers (no fractional handoff floats).

## Builtins (ONLY these names; match arity — unknown names fail semantic verification)
{builtins_block}

Use "exists" with one identifier argument for typical input presence checks. For transitions, effect_name must be one of the void builtins with correct argument count and types (text inputs).

## Multi-surface projections (not website-only)
The same `ir_goal` drives **several emitters**: a previewable React/Vite tree under `generated/webapp/`, relational SQL under `generated/sql/`, and stub runtimes (Rust, Python, Go, TypeScript index, C++) under `generated/<language>/`. Strategy scoring picks a primary language plus secondaries. Effects whose names suggest audit/logging (e.g. `log_successful_login`) strengthen storage/SQL scoring. You only author the IR; projectors produce files.

## Minimal valid example (structure reference; expand meaningfully for the user's prompt)
{minimal}

Prefer small, coherent workflows. If the user is vague, still emit a minimal consistent IR that passes checks rather than inventing undefined predicates."""

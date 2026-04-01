"""
V6 capability ownership and routing policy.

IR is the operational center. Python is parser/bridge/orchestration fallback.
Rust is preferred semantic/execution core.
"""

from __future__ import annotations

from typing import Dict, List


class CapabilityDescriptor:
    def __init__(self, name, layer, status, owner, notes=None):
        self.name = name
        self.layer = layer  # "ir" | "semantics" | "execution" | "projection" | "orchestration" | "bridge"
        self.status = status  # "active" | "deprecated" | "planned" | "rust_preferred" | "python_fallback"
        self.owner = owner  # "python" | "rust" | "shared"
        self.notes = notes or []


def build_capability_registry() -> List[CapabilityDescriptor]:
    return [
        CapabilityDescriptor(
            "canonical_ir_contract",
            "ir",
            "active",
            "shared",
            ["Canonical source of truth.", "Deterministic normalization + fingerprinting."],
        ),
        CapabilityDescriptor(
            "ir_validation",
            "ir",
            "rust_preferred",
            "rust",
            ["Rust-primary validation engine.", "Python kept for fallback/parity checks only."],
        ),
        CapabilityDescriptor(
            "ir_semantic_verifier",
            "semantics",
            "rust_preferred",
            "rust",
            ["Rust is preferred semantic engine.", "Python semantics is fallback/parity layer."],
        ),
        CapabilityDescriptor(
            "ir_execution_engine",
            "execution",
            "rust_preferred",
            "rust",
            ["Rust is preferred execution engine.", "Python execution retained for fallback/debug parity."],
        ),
        CapabilityDescriptor(
            "coregoal_execution_legacy",
            "execution",
            "deprecated",
            "python",
            ["Deprecated legacy path.", "Use canonical IR execution via Rust core."],
        ),
        CapabilityDescriptor(
            "projection_strategy",
            "projection",
            "rust_preferred",
            "shared",
            ["Dynamic scoring required.", "No fixed domain-language mapping."],
        ),
        CapabilityDescriptor(
            "projection_graph_orchestration",
            "orchestration",
            "active",
            "python",
            ["IR-centric ecosystem assembly.", "Rust-compatible outputs."],
        ),
        CapabilityDescriptor(
            "rust_bridge",
            "bridge",
            "active",
            "python",
            ["Action-based deterministic JSON bridge.", "Supports validate/semantic/execute/full pipeline."],
        ),
        CapabilityDescriptor(
            "self_evolution_hooks",
            "orchestration",
            "active",
            "shared",
            ["Feedback-driven mutation loop active.", "IR mutation engine integrated."],
        ),
        CapabilityDescriptor(
            "self_hosting_internal_ir",
            "orchestration",
            "active",
            "shared",
            ["System models core internals in canonical IR goals.", "Internal IR consistency checks active."],
        ),
    ]


def resolve_preferred_engine(capability_name: str) -> str:
    cap = (capability_name or "").lower()
    if cap in {
        "ir_validation",
        "ir_semantic_verifier",
        "ir_execution_engine",
        "semantic_core",
        "execution",
        "semantics",
    }:
        return "rust"
    if cap in {"projection_strategy", "projection"}:
        return "rust_preferred_python_fallback"
    if cap in {"parser_normalization", "parser_bridge", "orchestration"}:
        return "python"
    return "shared"


def build_system_manifest() -> Dict:
    caps = build_capability_registry()
    active_layers = sorted({c.layer for c in caps if c.status in {"active", "rust_preferred"}})
    deprecated_layers = sorted({c.layer for c in caps if c.status == "deprecated"})
    return {
        "system_stage": "v6_rust_dominance",
        "source_of_truth": "canonical_ir",
        "primary_execution_direction": "rust",
        "python_role": [
            "parser_normalization_entry",
            "bridge_orchestration_fallback",
            "editor_application_shell_support",
            "tooling_fallback",
        ],
        "engine_modes": [
            "python_only",
            "rust_preferred",
            "rust_only",
        ],
        "default_engine_mode": "rust_preferred",
        "architecture_rule": [
            "Python is no longer the conceptual core.",
            "Rust is the preferred core engine.",
            "Canonical IR remains single source of truth.",
        ],
        "active_layers": active_layers,
        "deprecated_layers": deprecated_layers,
        "capabilities": [
            {
                "name": c.name,
                "layer": c.layer,
                "status": c.status,
                "owner": c.owner,
                "notes": list(c.notes),
            }
            for c in caps
        ],
    }

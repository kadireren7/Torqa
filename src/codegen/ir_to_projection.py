"""
Derive human-readable projection text from canonical IR (not a second source of truth).

P124: Primary emitters live under ``src.projection.{typescript,python,rust,sql}/``;
this module re-exports them and keeps additional language stubs (Go, Kotlin, C++) here.
"""

from __future__ import annotations

import json

from src.ir.canonical_ir import IRGoal
from src.projection.python.emit import ir_goal_python_projection
from src.projection.rust.emit import ir_goal_rust_projection
from src.projection.sql.emit import ir_expr_compact, ir_goal_sql_projection
from src.projection.typescript.emit import ir_goal_server_typescript_stub, ir_goal_typescript_index_projection


def ir_goal_kotlin_projection(goal: IRGoal) -> str:
    g = json.dumps(goal.goal)
    lines = [
        "// Auto-generated from AI core IR.",
        "// Do not treat as primary source.",
        "",
        "package generated",
        "",
        "fun main() {",
        f'    println("goal: " + {g})',
        "}",
        "",
    ]
    return "\n".join(lines) + "\n"


def ir_goal_go_projection(goal: IRGoal) -> str:
    lines = [
        "// Auto-generated from AI core IR.",
        "// Do not treat as primary source.",
        "",
        "package main",
        "",
        "import \"fmt\"",
        "",
        "func main() {",
        f"\tfmt.Println(\"goal:\", {json.dumps(goal.goal)})",
        "}",
        "",
    ]
    return "\n".join(lines) + "\n"


def _cpp_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def ir_goal_cpp_projection(goal: IRGoal) -> str:
    g = _cpp_escape(goal.goal)
    lines = [
        "// Auto-generated from AI core IR.",
        "// Do not treat as primary source.",
        "",
        "#include <iostream>",
        "",
        "int main() {",
        f'    std::cout << "goal: {g}" << std::endl;',
        "    return 0;",
        "}",
        "",
    ]
    return "\n".join(lines) + "\n"


__all__ = [
    "ir_expr_compact",
    "ir_goal_cpp_projection",
    "ir_goal_go_projection",
    "ir_goal_kotlin_projection",
    "ir_goal_python_projection",
    "ir_goal_rust_projection",
    "ir_goal_server_typescript_stub",
    "ir_goal_sql_projection",
    "ir_goal_typescript_index_projection",
]

"""Built-in static analysis rules (order is stable for deterministic reports)."""

from __future__ import annotations

from typing import Callable, List, Tuple

from src.analysis.context import AnalysisContext
from src.analysis.rules.approval_steps import rule_approval_steps
from src.analysis.rules.circular_dependency import rule_circular_dependency
from src.analysis.rules.cost_risk import rule_cost_risk
from src.analysis.rules.duplicated_actions import rule_duplicated_actions
from src.analysis.rules.execution_order import rule_execution_order
from src.analysis.rules.external_access import rule_external_access
from src.analysis.rules.impossible_conditions import rule_impossible_conditions
from src.analysis.rules.observability import rule_observability
from src.analysis.rules.retry_strategy import rule_retry_strategy
from src.analysis.rules.undefined_references import rule_undefined_references
from src.analysis.types import RuleFinding

RuleFn = Callable[[AnalysisContext], List[RuleFinding]]

ALL_RULES: Tuple[RuleFn, ...] = (
    rule_impossible_conditions,
    rule_execution_order,
    rule_circular_dependency,
    rule_duplicated_actions,
    rule_undefined_references,
    rule_external_access,
    rule_approval_steps,
    rule_retry_strategy,
    rule_cost_risk,
    rule_observability,
)

__all__ = ["ALL_RULES", "RuleFn"]

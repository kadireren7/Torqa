"""Torqa advanced static analysis (modular rules on canonical IR)."""

from src.analysis.engine import advanced_analysis_report, run_advanced_analysis
from src.analysis.types import RuleFinding

__all__ = [
    "RuleFinding",
    "run_advanced_analysis",
    "advanced_analysis_report",
]

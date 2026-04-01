"""Language authoring surface: prompts and reference payloads for the AI-native core IR."""

from src.language.authoring_prompt import (
    build_ai_authoring_system_prompt,
    language_reference_payload,
)

__all__ = ["build_ai_authoring_system_prompt", "language_reference_payload"]

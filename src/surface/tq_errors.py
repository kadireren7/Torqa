"""Shared surface parse errors (avoids import cycles between .tq parsers)."""


class TQParseError(ValueError):
    """Surface parse failure with a stable diagnostic code (``PX_TQ_*``)."""

    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(message)

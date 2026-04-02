#!/usr/bin/env python3
"""
Verify self-host ``.tq`` sources match committed ``*_bundle.json`` files (drift guard).

Exit 0 if all pairs match; exit 1 with a message otherwise.
Same invariant as ``tests/test_torqa_self_bundle_drift.py`` — run before commit when editing
``examples/torqa_self/*.tq``.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

_REPO = Path(__file__).resolve().parents[1]
if str(_REPO) not in sys.path:
    sys.path.insert(0, str(_REPO))

from src.surface.parse_tq import parse_tq_source  # noqa: E402
from src.torqa_self.bundle_registry import self_host_bundle_pairs  # noqa: E402


def main() -> int:
    bad: list[str] = []
    for tq_path, bundle_path in self_host_bundle_pairs():
        if not tq_path.is_file():
            bad.append(f"missing .tq: {tq_path}")
            continue
        if not bundle_path.is_file():
            bad.append(f"missing bundle: {bundle_path}")
            continue
        raw = tq_path.read_text(encoding="utf-8")
        live = parse_tq_source(raw, tq_path=tq_path.resolve())
        committed = json.loads(bundle_path.read_text(encoding="utf-8"))
        if live.get("ir_goal") != committed.get("ir_goal"):
            bad.append(f"drift: {tq_path.name} vs {bundle_path.name} (re-run: torqa surface …)")

    if bad:
        print("Self-host bundle drift:\n" + "\n".join(f"  - {m}" for m in bad), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

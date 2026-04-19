"""
``torqa report`` — standalone HTML or Markdown reports from trust evaluation.
"""

from __future__ import annotations

import html
import sys
from dataclasses import dataclass

from src.surface.parse_tq import TQParseError
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Tuple

from src.torqa_cli.check_cmd import (
    DECISION_BLOCKED,
    DECISION_REVIEW,
    DECISION_SAFE,
    TrustEvalResult,
    evaluate_trust_from_bundle,
)
from src.torqa_cli.io import bundle_jobs, load_input


def _discover_spec_files(root: Path) -> List[Path]:
    out: List[Path] = []
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        suf = p.suffix.lower()
        if suf in (".tq", ".json"):
            out.append(p.resolve())
    return sorted(out)


def _display_path(scan_root: Path, file_path: Path) -> str:
    try:
        return str(file_path.resolve().relative_to(scan_root.resolve()))
    except ValueError:
        return str(file_path)


@dataclass
class _ReportRow:
    rel_path: str
    decision: str
    risk: str
    trust_profile: str
    reason: str
    checked_at: str
    has_warnings: bool = False


def _rows_for_path(path: Path, profile: str) -> Tuple[Path, List[_ReportRow]]:
    """Returns (scan_root_for_relative_paths, rows)."""
    if path.is_file():
        if path.suffix.lower() not in (".tq", ".json"):
            raise ValueError(f"expected .tq or .json file, got {path.suffix!r}")
        files = [path.resolve()]
        scan_root = path.parent.resolve()
    else:
        scan_root = path.resolve()
        files = _discover_spec_files(path)

    rows: List[_ReportRow] = []
    for fp in files:
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        rel_base = _display_path(scan_root, fp)
        bundle, err, input_type = load_input(fp)
        if err is not None:
            rs = f"{err.code}: {err}" if isinstance(err, TQParseError) else str(err)
            rows.append(
                _ReportRow(
                    rel_path=rel_base,
                    decision=DECISION_BLOCKED,
                    risk="n/a",
                    trust_profile=profile,
                    reason=rs,
                    checked_at=ts,
                    has_warnings=False,
                )
            )
            continue
        assert bundle is not None
        for suffix, one_bundle in bundle_jobs(fp, bundle, input_type):
            ev: TrustEvalResult = evaluate_trust_from_bundle(one_bundle, profile=profile)
            rel = f"{rel_base}{suffix}" if suffix else rel_base
            rows.append(
                _ReportRow(
                    rel_path=rel,
                    decision=ev.decision,
                    risk=ev.risk,
                    trust_profile=ev.trust_profile,
                    reason=ev.reason_summary,
                    checked_at=ts,
                    has_warnings=ev.has_warnings,
                )
            )
    return scan_root, rows


def _build_html(
    *,
    scope_label: str,
    profile: str,
    generated_at: str,
    rows: List[_ReportRow],
) -> str:
    safe = sum(1 for r in rows if r.decision == DECISION_SAFE)
    needs = sum(1 for r in rows if r.decision == DECISION_REVIEW)
    blocked = sum(1 for r in rows if r.decision == DECISION_BLOCKED)
    n = len(rows)

    esc = html.escape
    table_rows = []
    for r in rows:
        table_rows.append(
            "<tr>"
            f"<td>{esc(r.rel_path)}</td>"
            f"<td><code>{esc(r.decision)}</code></td>"
            f"<td>{esc(r.risk)}</td>"
            f"<td>{esc(r.trust_profile)}</td>"
            f"<td>{esc(r.reason)}</td>"
            f"<td><time datetime=\"{esc(r.checked_at)}\">{esc(r.checked_at)}</time></td>"
            "</tr>"
        )
    tbody = "\n".join(table_rows) if table_rows else "<tr><td colspan=\"6\">No matching files found.</td></tr>"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Torqa trust report</title>
<style>
  :root {{ font-family: Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.45; color: #1a1a1a; }}
  body {{ max-width: 1200px; margin: 1.5rem auto; padding: 0 1rem; }}
  h1 {{ font-size: 1.35rem; margin-bottom: 0.5rem; }}
  .meta {{ color: #444; font-size: 0.9rem; margin: 0.25rem 0 1rem; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 0.88rem; }}
  th, td {{ border: 1px solid #ccc; padding: 0.45rem 0.5rem; text-align: left; vertical-align: top; }}
  th {{ background: #f4f4f4; font-weight: 600; }}
  tr:nth-child(even) {{ background: #fafafa; }}
  code {{ font-size: 0.86em; background: #f0f0f0; padding: 0.1em 0.35em; border-radius: 3px; }}
  .summary {{ margin-top: 1.25rem; padding: 0.75rem 1rem; background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px; }}
  footer {{ margin-top: 2rem; font-size: 0.8rem; color: #666; }}
</style>
</head>
<body>
  <h1>Torqa trust report</h1>
  <p class="meta"><strong>Report generated:</strong> {esc(generated_at)}</p>
  <p class="meta"><strong>Scope:</strong> {esc(scope_label)}</p>
  <p class="meta"><strong>Trust profile:</strong> {esc(profile)}</p>
  <table>
    <thead>
      <tr>
        <th>File</th>
        <th>Decision</th>
        <th>Risk</th>
        <th>Profile result</th>
        <th>Reasons</th>
        <th>Checked at</th>
      </tr>
    </thead>
    <tbody>
{tbody}
    </tbody>
  </table>
  <div class="summary">
    <strong>Summary</strong> — Total files: {n} · Safe: {safe} · Needs review: {needs} · Blocked: {blocked}
  </div>
  <footer>Generated by Torqa (deterministic validation only; no execution or external analytics).</footer>
</body>
</html>
"""


def _md_escape(text: str) -> str:
    """Escape minimal markdown special chars in inline text."""
    return (
        text.replace("\\", "\\\\")
        .replace("|", "\\|")
        .replace("\n", " ")
        .strip()
    )


def _recommendation_lines(rows: List[_ReportRow]) -> List[str]:
    blocked = [r for r in rows if r.decision == DECISION_BLOCKED]
    review = [r for r in rows if r.decision == DECISION_REVIEW]
    lines: List[str] = []

    if blocked:
        lines.append(
            "- **Blocked specs** must pass parse/load, structural IR, semantic/registry, and trust policy "
            "before merge; use the reasons column to see which stage failed."
        )
        blob = " ".join(r.reason.lower() for r in blocked)
        if "owner" in blob or "severity" in blob or "surface_meta" in blob:
            lines.append(
                "- Ensure **`meta:`** (or JSON `metadata.surface_meta`) includes **owner** and **severity** "
                "as required by the active profile; see `docs/trust-policies.md`."
            )
        if "px_tq" in blob or "tq:" in blob or "parse" in blob:
            lines.append(
                "- Fix **`.tq` surface** issues (header order, flow steps, includes); see `docs/quickstart.md`."
            )
        if "policy" in blob or "strict" in blob:
            lines.append(
                "- If using **`--profile strict`**, relax disallowed metadata (e.g. severity) or choose a "
                "different profile for CI if appropriate."
            )
    else:
        lines.append("- **No BLOCKED files** under this profile for the scanned scope.")

    if review:
        lines.append(
            "- Files marked **NEEDS_REVIEW** still pass policy: complete any required human review before "
            "production handoff."
        )

    lines.append(
        "- Reproduce locally: `torqa check <file>` or `torqa scan <dir> --profile <name>` for the same labels."
    )
    lines.append(
        "- This report is deterministic (no execution, no external analytics); attach it to a PR or CI log as an artifact."
    )
    return lines


def _build_markdown(
    *,
    scope_label: str,
    profile: str,
    generated_at: str,
    rows: List[_ReportRow],
) -> str:
    safe = sum(1 for r in rows if r.decision == DECISION_SAFE)
    needs = sum(1 for r in rows if r.decision == DECISION_REVIEW)
    blocked_n = sum(1 for r in rows if r.decision == DECISION_BLOCKED)
    n = len(rows)
    blocked_rows = [r for r in rows if r.decision == DECISION_BLOCKED]

    parts: List[str] = []
    scope_posix = Path(scope_label).as_posix()
    parts.append("# Torqa trust report\n")
    parts.append(f"- **Generated:** {generated_at}\n")
    parts.append(f"- **Scope:** `{_md_escape(scope_posix)}`\n")
    parts.append(f"- **Trust profile:** `{_md_escape(profile)}`\n")

    parts.append("\n## Summary\n\n")
    parts.append(f"- **Total files:** {n}\n")
    parts.append(f"- **Safe:** {safe}\n")
    parts.append(f"- **Needs review:** {needs}\n")
    parts.append(f"- **Blocked:** {blocked_n}\n")

    parts.append("\n## Blocked files\n\n")
    if not blocked_rows:
        parts.append("*None.*\n")
    else:
        for r in blocked_rows:
            parts.append(f"- `{_md_escape(r.rel_path)}` — {_md_escape(r.reason)}\n")

    parts.append("\n## Recommendations\n\n")
    for line in _recommendation_lines(rows):
        parts.append(line + "\n")

    parts.append("\n### Full results\n\n")
    parts.append("| File | Decision | Risk | Profile | Reasons | Checked at |\n")
    parts.append("| --- | --- | --- | --- | --- | --- |\n")
    if not rows:
        parts.append("| *(no .tq or .json files found)* | | | | | |\n")
    else:
        for r in rows:
            parts.append(
                "| "
                + " | ".join(
                    [
                        _md_escape(r.rel_path),
                        _md_escape(r.decision),
                        _md_escape(r.risk),
                        _md_escape(r.trust_profile),
                        _md_escape(r.reason),
                        _md_escape(r.checked_at),
                    ]
                )
                + " |\n"
            )

    parts.append("\n---\n*Generated by Torqa — specification validation only; workflows are not executed here.*\n")
    return "".join(parts)


def cmd_report(args: object) -> int:
    path: Path = args.path
    fmt = getattr(args, "report_format", None) or "html"
    output: Path | None = getattr(args, "output", None)
    profile = getattr(args, "profile", None) or "default"
    fail_on_warning = bool(getattr(args, "fail_on_warning", False))

    if not path.exists():
        print(f"torqa report: not found: {path}", file=sys.stderr)
        return 1

    if fmt not in ("html", "md"):
        print(f"torqa report: unsupported --format {fmt!r}", file=sys.stderr)
        return 1

    try:
        _, rows = _rows_for_path(path, profile=profile)
    except ValueError as ex:
        print(f"torqa report: {ex}", file=sys.stderr)
        return 1

    gen = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    scope = str(path.resolve())

    if fmt == "html":
        doc = _build_html(scope_label=scope, profile=profile, generated_at=gen, rows=rows)
        default_name = "torqa-report.html"
    else:
        doc = _build_markdown(scope_label=scope, profile=profile, generated_at=gen, rows=rows)
        default_name = "torqa-report.md"

    out_path = output
    if out_path is None:
        out_path = Path(default_name)

    try:
        out_path.write_text(doc, encoding="utf-8", newline="\n")
    except OSError as ex:
        print(f"torqa report: could not write {out_path}: {ex}", file=sys.stderr)
        return 1

    print(f"Wrote {out_path.resolve()}")
    if any(r.decision == DECISION_BLOCKED for r in rows):
        return 1
    if fail_on_warning and any(r.has_warnings for r in rows):
        print(
            "torqa report: semantic or policy warnings present (fail-on-warning); exiting with status 1.",
            file=sys.stderr,
        )
        return 1
    return 0

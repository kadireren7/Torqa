#!/usr/bin/env python3
"""
End-to-end demo: natural-language prompt -> ``torqa --json app`` -> optional Vite preview
with a **token comparison overlay** page (fixed top bar + iframe to localhost).

Usage (repo root, editable install or PYTHONPATH set):

  python scripts/prompt_build_preview.py --workspace ./my_ws --prompt-file prompt.txt

  echo "A landing page with hero and CTA" | python scripts/prompt_build_preview.py --workspace ./my_ws

Outputs ``<out>/token_preview_overlay.html``; open in a browser while ``npm run dev`` serves the app.

Preview (``npm install`` + ``npm run dev``) runs by default; pass ``--no-preview`` to only build + write the overlay HTML.
"""

from __future__ import annotations

import argparse
import html as html_module
import json
import os
import shutil
import subprocess
import sys
import webbrowser
from pathlib import Path
from typing import Any, Dict, Optional


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _torqa_env(repo: Path) -> Dict[str, str]:
    env = os.environ.copy()
    pp = str(repo)
    if env.get("PYTHONPATH"):
        env["PYTHONPATH"] = pp + os.pathsep + env["PYTHONPATH"]
    else:
        env["PYTHONPATH"] = pp
    env.setdefault("PYTHONUTF8", "1")
    env.setdefault("PYTHONIOENCODING", "utf-8")
    return env


def _extract_token_overlay_data(
    payload: Dict[str, Any],
    *,
    prompt_text: str,
    tq_snippet: str,
) -> Dict[str, Any]:
    stages = payload.get("stages") or {}
    th = stages.get("token_hint") or {}
    gen = stages.get("generate") or {}
    am = gen.get("api_metrics")
    pt = th.get("prompt_token_estimate")
    tt = th.get("tq_token_estimate")
    red = th.get("reduction_percent")
    out: Dict[str, Any] = {
        "nl_prompt_preview": prompt_text[:8000],
        "tq_source_preview": tq_snippet[:6000],
        "prompt_token_estimate": pt,
        "tq_token_estimate": tt,
        "reduction_percent": red,
        "api_metrics": am if isinstance(am, dict) else None,
    }
    return out


def build_overlay_html(
    *,
    preview_url: str,
    overlay_data: Dict[str, Any],
    title: str = "TORQA - token comparison overlay",
) -> str:
    payload_json = json.dumps(overlay_data, ensure_ascii=False).replace("</script>", "<\\/script>")
    esc_title = json.dumps(title)
    esc_url = json.dumps(preview_url)
    title_safe = html_module.escape(title)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title_safe}</title>
  <style>
    :root {{
      --bg: #0d1117;
      --bar: #161b22;
      --border: #30363d;
      --text: #e6edf3;
      --muted: #8b949e;
      --accent: #58a6ff;
      --ok: #3fb950;
      --warn: #d29922;
    }}
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; background: var(--bg); color: var(--text); font: 13px/1.45 system-ui, Segoe UI, sans-serif; }}
    .bar {{
      position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
      background: var(--bar); border-bottom: 1px solid var(--border);
      padding: 10px 14px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px 18px;
      box-shadow: 0 2px 8px rgba(0,0,0,.35);
    }}
    .bar h1 {{ margin: 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); width: 100%; }}
    .pill {{
      background: #21262d; border: 1px solid var(--border); border-radius: 8px; padding: 6px 12px;
      font-variant-numeric: tabular-nums;
    }}
    .pill strong {{ color: var(--accent); font-weight: 600; }}
    .pill.ok strong {{ color: var(--ok); }}
    .pill small {{ display: block; font-size: 10px; color: var(--muted); margin-top: 2px; }}
    .iframe-wrap {{ margin-top: 118px; height: calc(100vh - 118px); }}
    @media (max-width: 720px) {{
      .iframe-wrap {{ margin-top: 200px; height: calc(100vh - 200px); }}
    }}
    iframe {{ width: 100%; height: 100%; border: 0; background: #fff; }}
    .drawer-toggle {{
      margin-left: auto; cursor: pointer; font-size: 11px; color: var(--accent); user-select: none;
    }}
    .drawer {{ display: none; width: 100%; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); }}
    .drawer.open {{ display: block; }}
    .pre-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; max-height: 220px; }}
    @media (max-width: 900px) {{ .pre-grid {{ grid-template-columns: 1fr; }} }}
    pre {{
      margin: 0; padding: 8px; font-size: 10px; overflow: auto; background: #010409; border: 1px solid var(--border);
      border-radius: 6px; white-space: pre-wrap; word-break: break-word; color: var(--muted);
    }}
    .err {{ color: #f85149; padding: 12px; }}
  </style>
</head>
<body>
  <div class="bar" id="torqa-overlay-bar">
    <h1>Token comparison overlay</h1>
    <div id="pills"></div>
    <span class="drawer-toggle" id="tog">▼ NL / .tq text</span>
    <div class="drawer" id="drawer">
      <div class="pre-grid">
        <div><div style="font-size:10px;color:var(--muted);margin-bottom:4px;">NL prompt (input)</div><pre id="nl"></pre></div>
        <div><div style="font-size:10px;color:var(--muted);margin-bottom:4px;">TORQA .tq (excerpt)</div><pre id="tq"></pre></div>
      </div>
    </div>
  </div>
  <div class="iframe-wrap">
    <iframe id="app" title="preview" src={esc_url}></iframe>
  </div>
  <script type="application/json" id="torqa-overlay-data">{payload_json}</script>
  <script>
    (function () {{
      const title = {esc_title};
      document.title = title;
      const raw = document.getElementById("torqa-overlay-data").textContent;
      let d;
      try {{ d = JSON.parse(raw); }} catch (e) {{
        document.body.innerHTML = '<p class="err">Invalid overlay JSON</p>';
        return;
      }}
      const pills = document.getElementById("pills");
      const pt = d.prompt_token_estimate, tt = d.tq_token_estimate, red = d.reduction_percent;
      function pill(label, val, sub, cls) {{
        const el = document.createElement("div");
        el.className = "pill" + (cls ? " " + cls : "");
        el.innerHTML = "<strong>" + label + "</strong> " + val + (sub ? "<small>" + sub + "</small>" : "");
        return el;
      }}
      if (typeof pt === "number" && typeof tt === "number") {{
        pills.appendChild(pill("NL (est.)", pt, "tokens", ""));
        pills.appendChild(pill(".tq (est.)", tt, "tokens", "ok"));
        if (typeof red === "number")
          pills.appendChild(pill("Reduction", red.toFixed(1) + "%", "vs NL est.", "ok"));
      }} else {{
        pills.appendChild(pill("Tokens", "-", "no token_hint in JSON", ""));
      }}
      const am = d.api_metrics;
      if (am && typeof am.http_calls === "number") {{
        const lat = am.latency_ms_total != null ? Math.round(am.latency_ms_total) + " ms" : "-";
        const cost = am.estimated_cost_usd != null ? "~$" + Number(am.estimated_cost_usd).toFixed(4) : "-";
        pills.appendChild(pill("OpenAI calls", String(am.http_calls), "retries " + String(am.retry_count ?? "-"), ""));
        pills.appendChild(pill("API latency", lat, "total", ""));
        pills.appendChild(pill("Est. cost", cost, String(am.model || ""), ""));
      }}
      document.getElementById("nl").textContent = d.nl_prompt_preview || "";
      document.getElementById("tq").textContent = d.tq_source_preview || "";
      const dr = document.getElementById("drawer");
      document.getElementById("tog").onclick = function () {{
        dr.classList.toggle("open");
        this.textContent = dr.classList.contains("open") ? "▲ hide text" : "▼ NL / .tq text";
      }};
    }})();
  </script>
</body>
</html>
"""


def _run_torqa_app(
    *,
    repo: Path,
    workspace: Path,
    prompt: str,
    out: str,
    gen_category: Optional[str],
    engine_mode: str,
) -> Dict[str, Any]:
    cmd = [
        sys.executable,
        "-m",
        "torqa",
        "--json",
        "app",
        "--workspace",
        str(workspace.resolve()),
        "--out",
        out,
        "--prompt-stdin",
        "--engine-mode",
        engine_mode,
    ]
    if gen_category:
        cmd.extend(["--gen-category", gen_category])
    proc = subprocess.run(
        cmd,
        input=prompt.encode("utf-8"),
        capture_output=True,
        cwd=str(repo),
        env=_torqa_env(repo),
    )
    raw_out = proc.stdout.decode("utf-8", errors="replace").strip()
    raw_err = proc.stderr.decode("utf-8", errors="replace").strip()
    text = raw_out if raw_out else raw_err
    if not text:
        raise RuntimeError("torqa produced no stdout/stderr JSON")
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as ex:
        raise RuntimeError(f"torqa output is not JSON: {ex}\n---\n{text[:2000]}") from ex
    if proc.returncode != 0 or not payload.get("ok"):
        raise RuntimeError(json.dumps(payload, indent=2, ensure_ascii=False))
    return payload


def _webapp_dir(payload: Dict[str, Any], workspace: Path, out: str) -> Path:
    lw = payload.get("local_webapp")
    if isinstance(lw, dict):
        w = lw.get("webapp_dir_absolute")
        if isinstance(w, str) and w.strip():
            return Path(w).resolve()
    return (workspace / out / "generated" / "webapp").resolve()


def main(argv: list[str] | None = None) -> int:
    if sys.platform == "win32":
        for _stream in (sys.stdout, sys.stderr):
            if hasattr(_stream, "reconfigure"):
                try:
                    _stream.reconfigure(encoding="utf-8")
                except (OSError, ValueError, AttributeError):
                    pass

    p = argparse.ArgumentParser(description="Prompt -> torqa app -> token overlay HTML + optional Vite preview.")
    p.add_argument("--workspace", type=Path, required=True, help="Project folder (same as torqa --workspace)")
    p.add_argument("--prompt", type=str, default="", help="Inline prompt (or use --prompt-file / stdin)")
    p.add_argument("--prompt-file", type=Path, default=None, help="Read UTF-8 prompt from file")
    p.add_argument("--out", type=str, default="torqa_generated_out", help="Materialize output dir under workspace")
    p.add_argument(
        "--gen-category",
        type=str,
        default=None,
        choices=["landing", "crud", "automation", "crm", "onboarding", "approvals", "dashboard"],
    )
    p.add_argument("--engine-mode", type=str, default="python_only")
    p.add_argument("--preview-port", type=int, default=5173)
    p.add_argument("--no-preview", action="store_true", help="Skip npm install / dev server")
    p.add_argument("--open-overlay", action="store_true", help="Open overlay HTML in default browser")
    args = p.parse_args(argv)

    repo = _repo_root()
    ws = args.workspace.resolve()
    if not ws.is_dir():
        print(f"workspace is not a directory: {ws}", file=sys.stderr)
        return 1

    if args.prompt_file is not None:
        prompt = args.prompt_file.read_text(encoding="utf-8").strip()
    elif args.prompt.strip():
        prompt = args.prompt.strip()
    else:
        prompt = sys.stdin.read().strip()
    if not prompt:
        print("empty prompt: use --prompt, --prompt-file, or pipe stdin", file=sys.stderr)
        return 1

    try:
        payload = _run_torqa_app(
            repo=repo,
            workspace=ws,
            prompt=prompt,
            out=args.out,
            gen_category=args.gen_category,
            engine_mode=args.engine_mode,
        )
    except RuntimeError as ex:
        print(str(ex), file=sys.stderr)
        return 1

    stages = payload.get("stages") or {}
    wt = stages.get("write_tq") or {}
    rel = wt.get("relative_path") if isinstance(wt, dict) else None
    tq_snippet = ""
    if isinstance(rel, str) and rel.strip():
        tq_path = (ws / rel).resolve()
        if tq_path.is_file():
            tq_snippet = tq_path.read_text(encoding="utf-8")

    overlay_data = _extract_token_overlay_data(payload, prompt_text=prompt, tq_snippet=tq_snippet)
    preview_url = f"http://127.0.0.1:{args.preview_port}/"
    html = build_overlay_html(preview_url=preview_url, overlay_data=overlay_data)

    dest_root = (ws / args.out).resolve()
    dest_root.mkdir(parents=True, exist_ok=True)
    overlay_path = dest_root / "token_preview_overlay.html"
    overlay_path.write_text(html, encoding="utf-8")

    print(f"Wrote overlay: {overlay_path}")
    print(f"Preview URL (iframe target): {preview_url}")

    webapp = _webapp_dir(payload, ws, args.out)
    if not webapp.is_dir():
        print(f"Warning: webapp dir missing: {webapp}", file=sys.stderr)
        print("Open the overlay after starting Vite manually under generated/webapp.", file=sys.stderr)
    elif not args.no_preview:
        npm = shutil.which("npm")
        if not npm:
            print("npm not found on PATH; run manually in webapp dir: npm install && npm run dev", file=sys.stderr)
        else:
            print(f"npm install in {webapp} ...")
            r = subprocess.run([npm, "install"], cwd=str(webapp), shell=False)
            if r.returncode != 0:
                print("npm install failed", file=sys.stderr)
                return 1
            log_path = webapp / ".torqa-vite-preview.log"
            log_f = open(log_path, "w", encoding="utf-8")
            cmd = [
                npm,
                "run",
                "dev",
                "--",
                "--host",
                "127.0.0.1",
                "--port",
                str(args.preview_port),
                "--strictPort",
            ]
            subprocess.Popen(
                cmd,
                cwd=str(webapp),
                stdout=log_f,
                stderr=subprocess.STDOUT,
                stdin=subprocess.DEVNULL,
                close_fds=True,
            )
            print(f"Vite starting (log: {log_path})")
            print(f"Open in browser: file:///{str(overlay_path).replace(chr(92), '/')}")

    if args.open_overlay:
        webbrowser.open(overlay_path.as_uri())

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

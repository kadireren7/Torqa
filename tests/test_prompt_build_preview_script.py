"""Smoke tests for scripts/prompt_build_preview.py overlay HTML."""

from __future__ import annotations

from scripts.prompt_build_preview import build_overlay_html, _extract_token_overlay_data


def test_build_overlay_html_contains_structure():
    html = build_overlay_html(
        preview_url="http://127.0.0.1:5173/",
        overlay_data={
            "nl_prompt_preview": "hello",
            "tq_source_preview": "module x",
            "prompt_token_estimate": 100,
            "tq_token_estimate": 30,
            "reduction_percent": 70.0,
            "api_metrics": None,
        },
    )
    assert "torqa-overlay-bar" in html
    assert "token_preview_overlay" not in html  # filename not in body
    assert "127.0.0.1:5173" in html
    assert "pills" in html


def test_extract_token_overlay_data():
    payload = {
        "stages": {
            "token_hint": {
                "prompt_token_estimate": 10,
                "tq_token_estimate": 5,
                "reduction_percent": 50.0,
            },
            "generate": {"api_metrics": {"http_calls": 1, "retry_count": 0, "latency_ms_total": 100, "model": "x"}},
        }
    }
    d = _extract_token_overlay_data(payload, prompt_text="p", tq_snippet="t")
    assert d["prompt_token_estimate"] == 10
    assert d["api_metrics"]["http_calls"] == 1

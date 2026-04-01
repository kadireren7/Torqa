import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

pytest.importorskip("fastapi")

from webui.app import app


@pytest.fixture
def client():
    return TestClient(app)


def test_diagnostics_endpoint(client):
    repo = Path(__file__).resolve().parents[1]
    bundle = json.loads((repo / "examples" / "core" / "valid_minimal_flow.json").read_text(encoding="utf-8"))
    r = client.post("/api/diagnostics", json={"ir_bundle": bundle})
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_patch_add_input(client):
    repo = Path(__file__).resolve().parents[1]
    bundle = json.loads((repo / "examples" / "core" / "valid_minimal_flow.json").read_text(encoding="utf-8"))
    mutations = [
        {
            "mutation_type": "add_input",
            "target": None,
            "payload": {"name": "email", "type_name": "text"},
        }
    ]
    r = client.post("/api/ir/patch", json={"ir_bundle": bundle, "mutations": mutations})
    assert r.status_code == 200
    body = r.json()
    names = {i["name"] for i in body["ir_bundle"]["ir_goal"]["inputs"]}
    assert "email" in names


def test_ai_suggest_structured_response(client):
    """With OPENAI_API_KEY set, a valid bundle may succeed; without key, structured failure."""
    r = client.post("/api/ai/suggest", json={"prompt": "tiny demo flow"})
    assert r.status_code == 200
    data = r.json()
    if data.get("ok"):
        assert data.get("ir_bundle") is not None
        assert "ir_goal" in data["ir_bundle"]
    else:
        assert data.get("code") in ("PX_AI_NO_KEY", "PX_AI_MAX_RETRIES", "PX_AI_HTTP")

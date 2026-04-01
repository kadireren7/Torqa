import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

pytest.importorskip("fastapi")

from webui.app import app


@pytest.fixture
def client():
    return TestClient(app)


def test_index_html(client):
    r = client.get("/")
    assert r.status_code == 200
    assert b"Project-X Console" in r.content


def test_examples_list(client):
    r = client.get("/api/examples")
    assert r.status_code == 200
    data = r.json()
    names = {e["name"] for e in data["examples"]}
    assert "valid_minimal_flow.json" in names


def test_run_pipeline_minimal(client):
    repo = Path(__file__).resolve().parents[1]
    path = repo / "examples" / "core" / "valid_minimal_flow.json"
    bundle = json.loads(path.read_text(encoding="utf-8"))
    r = client.post(
        "/api/run",
        json={"ir_bundle": bundle, "demo_inputs": {"username": "alice"}},
    )
    assert r.status_code == 200
    body = r.json()
    assert body.get("ir_valid") is True
    assert "artifacts" in body["orchestrator"]

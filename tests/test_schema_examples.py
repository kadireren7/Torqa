import json
from pathlib import Path

import jsonschema
import pytest

REPO = Path(__file__).resolve().parents[1]
SCHEMA_PATH = REPO / "spec" / "IR_BUNDLE.schema.json"
EXAMPLES = REPO / "examples" / "core"


@pytest.fixture(scope="module")
def schema():
    with open(SCHEMA_PATH, encoding="utf-8") as f:
        return json.load(f)


@pytest.mark.parametrize(
    "filename",
    [
        "valid_minimal_flow.json",
        "valid_login_flow.json",
        "invalid_empty_goal.json",
    ],
)
def test_example_validates_against_json_schema(schema, filename):
    with open(EXAMPLES / filename, encoding="utf-8") as f:
        data = json.load(f)
    jsonschema.validate(instance=data, schema=schema)

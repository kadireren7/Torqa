"""Minimal package vendor + IR compose (Priority 8)."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from src.diagnostics.report import build_full_diagnostic_report
from src.ir.canonical_ir import ir_goal_from_json
from src.packages.errors import PackageError, PX_PKG_FINGERPRINT_MISMATCH, PX_PKG_MERGE_CONDITION_ID_COLLISION
from src.packages.fingerprint import compute_package_fingerprint
from src.packages.manifest import load_package_manifest
from src.packages.merge_ir import compose_bundle, merge_ir_goal_fragments
from src.packages.vendor import vendor_packages
from src.surface.parse_tq import parse_tq_source

REPO = Path(__file__).resolve().parents[1]
PKG = REPO / "examples" / "packages" / "minimal_auth"
DEMO = REPO / "examples" / "package_demo"
MULTI_APP = REPO / "examples" / "multi_package_app"
REPO_IR_PKGS = [
    REPO / "packages" / "torqa-pkg-auth",
    REPO / "packages" / "torqa-pkg-validation",
    REPO / "packages" / "torqa-pkg-shared",
]


def test_package_fingerprint_stable():
    a = compute_package_fingerprint(PKG)
    b = compute_package_fingerprint(PKG)
    assert a == b
    assert a.startswith("sha256:")


def test_package_demo_lock_fingerprint_matches_minimal_auth():
    """``examples/package_demo`` pin must match ``examples/packages/minimal_auth`` content."""
    lock = json.loads((DEMO / "torqa.lock.json").read_text(encoding="utf-8"))
    entry = lock["packages"][0]
    src = (DEMO / entry["source_path"]).resolve()
    assert compute_package_fingerprint(src) == entry["fingerprint"]


def test_package_manifest_loads_exports():
    """Package 'import': manifest parses and export paths resolve."""
    m = load_package_manifest(PKG)
    assert m["name"] == "torqa/minimal-auth"
    assert m["version"] == "1.0.0"
    assert "email_fragment" in m["exports"]
    exp = PKG / m["exports"]["email_fragment"]
    assert exp.is_file()
    frag = json.loads(exp.read_text(encoding="utf-8"))
    assert "inputs" in frag


def test_vendor_copies_and_verifies_fingerprint(tmp_path):
    pkg_copy = tmp_path / "minimal_auth"
    shutil.copytree(PKG, pkg_copy)
    demo = tmp_path / "demo"
    demo.mkdir()
    fp = compute_package_fingerprint(pkg_copy)
    lock = {
        "packages": [
            {
                "name": "torqa/minimal-auth",
                "version": "1.0.0",
                "source": "path",
                "source_path": "../minimal_auth",
                "fingerprint": fp,
            }
        ]
    }
    (demo / "torqa.lock.json").write_text(json.dumps(lock, indent=2), encoding="utf-8")
    rep = vendor_packages(demo / "torqa.lock.json")
    assert rep["ok"] is True
    assert rep["written"]
    dest = demo / rep["written"][0]
    assert (dest / "torqa.package.json").is_file()


def test_vendor_fingerprint_mismatch_fails(tmp_path):
    demo = tmp_path / "demo"
    demo.mkdir()
    lock = {
        "packages": [
            {
                "name": "x",
                "version": "1.0.0",
                "source": "path",
                "source_path": "src",
                "fingerprint": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
            }
        ]
    }
    (demo / "torqa.lock.json").write_text(json.dumps(lock), encoding="utf-8")
    (demo / "src").mkdir()
    shutil.copy(PKG / "torqa.package.json", demo / "src" / "torqa.package.json")
    shutil.copytree(PKG / "exports", demo / "src" / "exports")
    with pytest.raises(PackageError) as ei:
        vendor_packages(demo / "torqa.lock.json")
    assert ei.value.code == PX_PKG_FINGERPRINT_MISMATCH


def test_merge_ir_detects_duplicate_condition_id():
    primary = json.loads((REPO / "examples" / "core" / "valid_minimal_flow.json").read_text(encoding="utf-8"))[
        "ir_goal"
    ]
    frag = {
        "preconditions": [
            {
                "condition_id": "c_req_0001",
                "kind": "require",
                "expr": {"type": "call", "name": "exists", "arguments": []},
            }
        ]
    }
    with pytest.raises(PackageError) as ei:
        merge_ir_goal_fragments(primary, [frag])
    assert ei.value.code == PX_PKG_MERGE_CONDITION_ID_COLLISION


def test_compose_end_to_end_validates(tmp_path):
    spec = tmp_path / "compose.json"
    demo = tmp_path / "w"
    demo.mkdir()
    shutil.copy(DEMO / "torqa.lock.json", demo / "torqa.lock.json")
    spec.write_text(
        json.dumps(
            {
                "primary": str((REPO / "examples" / "core" / "valid_minimal_flow.json").resolve()),
                "fragments": [str((PKG / "exports" / "email_input.json").resolve())],
                "library_refs_from_lock": True,
                "lock": str((demo / "torqa.lock.json").resolve()),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    from src.packages.compose_spec import load_bundle_json, load_compose_spec, load_fragment_json
    from src.packages.vendor import load_lock

    data = load_compose_spec(spec)
    root = spec.parent
    primary = load_bundle_json(Path(data["primary"]))
    frags = [load_fragment_json(Path(p)) for p in data["fragments"]]
    lock_data = load_lock(Path(data["lock"]))
    lib_refs = [
        {"name": p["name"], "version": p["version"], "fingerprint": p.get("fingerprint") or ""}
        for p in lock_data.get("packages") or []
        if isinstance(p, dict)
    ]
    out = compose_bundle(primary, frags, library_refs=lib_refs)
    out_path = tmp_path / "out.json"
    out_path.write_text(json.dumps(out, sort_keys=True, indent=2), encoding="utf-8")
    g = ir_goal_from_json(out)
    rep = build_full_diagnostic_report(g)
    assert rep["ok"] is True, rep
    assert any(i["name"] == "email" for i in out["ir_goal"]["inputs"])
    assert out.get("library_refs")


def test_vendor_multi_package_lock_copies_both(tmp_path):
    """Two packages in one lock: both vendored and fingerprint-checked."""
    a = tmp_path / "pkg_a"
    b = tmp_path / "pkg_b"
    shutil.copytree(PKG, a)
    shutil.copytree(PKG, b)
    # Distinct second package identity on disk (same content OK; different names in lock)
    man_b = json.loads((b / "torqa.package.json").read_text(encoding="utf-8"))
    man_b["name"] = "torqa/other-auth"
    man_b["version"] = "0.1.0"
    (b / "torqa.package.json").write_text(json.dumps(man_b, indent=2, sort_keys=True), encoding="utf-8")
    fp_a = compute_package_fingerprint(a)
    fp_b = compute_package_fingerprint(b)

    demo = tmp_path / "demo"
    demo.mkdir()
    lock = {
        "packages": [
            {
                "name": "torqa/minimal-auth",
                "version": "1.0.0",
                "source": "path",
                "source_path": "../pkg_a",
                "fingerprint": fp_a,
            },
            {
                "name": "torqa/other-auth",
                "version": "0.1.0",
                "source": "path",
                "source_path": "../pkg_b",
                "fingerprint": fp_b,
            },
        ]
    }
    (demo / "torqa.lock.json").write_text(json.dumps(lock, indent=2), encoding="utf-8")
    rep = vendor_packages(demo / "torqa.lock.json")
    assert len(rep["written"]) == 2
    assert len(rep["packages"]) == 2
    for entry in rep["packages"]:
        assert Path(entry["path"]).is_dir()
        assert (Path(entry["path"]) / "torqa.package.json").is_file()


def test_multi_fragment_merge_from_two_logical_packages_validates(tmp_path):
    """IR merge: primary + two fragments (simulating two packages) remains valid."""
    primary = json.loads((REPO / "examples" / "core" / "valid_minimal_flow.json").read_text(encoding="utf-8"))
    frag_phone = {
        "inputs": [{"name": "phone", "type": "text"}],
        "preconditions": [
            {
                "condition_id": "c_req_0003",
                "kind": "require",
                "expr": {
                    "type": "call",
                    "name": "exists",
                    "arguments": [{"type": "identifier", "name": "phone"}],
                },
            }
        ],
    }
    frag_nick = {
        "inputs": [{"name": "nick", "type": "text"}],
        "preconditions": [
            {
                "condition_id": "c_req_0004",
                "kind": "require",
                "expr": {
                    "type": "call",
                    "name": "exists",
                    "arguments": [{"type": "identifier", "name": "nick"}],
                },
            }
        ],
    }
    refs = [
        {"name": "pkg-a", "version": "1.0.0", "fingerprint": "sha256:aa"},
        {"name": "pkg-b", "version": "1.0.0", "fingerprint": "sha256:bb"},
    ]
    out = compose_bundle(primary, [frag_phone, frag_nick], library_refs=refs)
    g = ir_goal_from_json(out)
    rep = build_full_diagnostic_report(g)
    assert rep["ok"] is True, rep
    names = {i["name"] for i in out["ir_goal"]["inputs"]}
    assert names == {"nick", "phone", "username"}
    assert len(out["ir_goal"]["preconditions"]) == 3
    assert len(out["library_refs"]) == 2


def test_compose_bundle_deterministic_identical_json_twice():
    """Same primary + fragments + refs → identical canonical JSON (stable merge)."""
    primary = json.loads((REPO / "examples" / "core" / "valid_minimal_flow.json").read_text(encoding="utf-8"))
    frag = json.loads((PKG / "exports" / "email_input.json").read_text(encoding="utf-8"))
    refs = [{"name": "torqa/minimal-auth", "version": "1.0.0", "fingerprint": "sha256:x"}]
    s1 = json.dumps(compose_bundle(primary, [frag], library_refs=refs), sort_keys=True, separators=(",", ":"))
    s2 = json.dumps(compose_bundle(primary, [frag], library_refs=refs), sort_keys=True, separators=(",", ":"))
    assert s1 == s2


def _compose_cli_serialized(out: dict) -> str:
    """Match ``torqa compose`` on-disk JSON (stable ordering for regression)."""
    return json.dumps(out, indent=2, sort_keys=True, default=str) + "\n"


@pytest.mark.parametrize("pkg_root", REPO_IR_PKGS, ids=[p.name for p in REPO_IR_PKGS])
def test_repo_ir_example_packages_manifest_fingerprint_stable(pkg_root: Path):
    """Shipped ``packages/torqa-pkg-*`` trees load and fingerprint deterministically."""
    assert pkg_root.is_dir()
    m = load_package_manifest(pkg_root)
    assert m.get("name") and m.get("exports")
    a = compute_package_fingerprint(pkg_root)
    b = compute_package_fingerprint(pkg_root)
    assert a == b and a.startswith("sha256:")


def test_multi_package_app_lock_fingerprints_match_package_trees():
    """UX/doc drift guard: lock pins must match current on-disk package content."""
    lock_path = MULTI_APP / "torqa.lock.json"
    data = json.loads(lock_path.read_text(encoding="utf-8"))
    base = lock_path.parent
    for entry in data.get("packages") or []:
        rel = entry.get("source_path")
        assert isinstance(rel, str)
        src = (base / rel).resolve()
        assert src.is_dir(), src
        actual = compute_package_fingerprint(src)
        assert actual == entry.get("fingerprint"), (entry.get("name"), actual, entry.get("fingerprint"))


def test_multi_package_app_compose_end_to_end_validates():
    """Real ``examples/multi_package_app/compose.json`` merges and passes IR diagnostics."""
    from src.packages.compose_spec import load_bundle_json, load_compose_spec, load_fragment_json
    from src.packages.vendor import load_lock

    spec_path = MULTI_APP / "compose.json"
    spec = load_compose_spec(spec_path)
    root = spec_path.parent

    def _p(rel: str) -> Path:
        q = Path(rel)
        return q.resolve() if q.is_absolute() else (root / q).resolve()

    primary = load_bundle_json(_p(spec["primary"]))
    frags = [load_fragment_json(_p(x)) for x in (spec.get("fragments") or [])]
    lock_data = load_lock(_p(spec["lock"]))
    lib_refs = [
        {"name": p["name"], "version": p["version"], "fingerprint": p.get("fingerprint") or ""}
        for p in lock_data.get("packages") or []
        if isinstance(p, dict)
    ]
    out = compose_bundle(primary, frags, library_refs=lib_refs)
    g = ir_goal_from_json(out)
    rep = build_full_diagnostic_report(g)
    assert rep["ok"] is True, rep
    assert len(out["ir_goal"]["inputs"]) == 6
    assert len(out.get("library_refs") or []) == 3


def test_vendor_three_ir_example_packages_from_lock(tmp_path):
    """Vendor copies all three ``torqa-pkg-*`` trees; ``deps_root`` stays under lock parent (vendor contract)."""
    demo = tmp_path / "app"
    demo.mkdir()
    for folder in ("torqa-pkg-auth", "torqa-pkg-validation", "torqa-pkg-shared"):
        shutil.copytree(REPO / "packages" / folder, tmp_path / folder)
    rows = [
        ("torqa/pkg-auth", "torqa-pkg-auth", "0.1.0"),
        ("torqa/pkg-validation", "torqa-pkg-validation", "0.1.0"),
        ("torqa/pkg-shared", "torqa-pkg-shared", "0.1.0"),
    ]
    lock_pkgs = []
    for name, folder, ver in rows:
        root = tmp_path / folder
        fp = compute_package_fingerprint(root)
        lock_pkgs.append(
            {
                "name": name,
                "version": ver,
                "source": "path",
                "source_path": f"../{folder}",
                "fingerprint": fp,
            }
        )
    (demo / "torqa.lock.json").write_text(json.dumps({"packages": lock_pkgs}, indent=2), encoding="utf-8")
    rep = vendor_packages(demo / "torqa.lock.json")
    assert rep["ok"] is True
    assert len(rep["written"]) == 3


def test_compose_cli_serialization_deterministic_twice():
    """Same merge run twice → identical bytes as written by ``cmd_compose``."""
    primary = json.loads((REPO / "examples" / "core" / "valid_minimal_flow.json").read_text(encoding="utf-8"))
    frag = json.loads((PKG / "exports" / "email_input.json").read_text(encoding="utf-8"))
    refs = [{"name": "torqa/minimal-auth", "version": "1.0.0", "fingerprint": "sha256:x"}]
    out = compose_bundle(primary, [frag], library_refs=refs)
    a = _compose_cli_serialized(out)
    b = _compose_cli_serialized(compose_bundle(primary, [frag], library_refs=refs))
    assert a == b


def test_tq_include_bundle_as_primary_then_compose_ir_fragment_validates():
    """``.tq`` include expansion then IR package-style merge: one pipeline, no id clash."""
    tq_path = REPO / "examples" / "torqa" / "example_include_user_login.tq"
    primary_bundle = parse_tq_source(tq_path.read_text(encoding="utf-8"), tq_path=tq_path)
    assert primary_bundle["ir_goal"]["metadata"]["source_map"].get("tq_includes") == ["modules/login_inputs.tq"]
    # After include, preconditions use c_req_0001..0005; add fragment with a higher id.
    frag = {
        "inputs": [{"name": "session_token", "type": "text"}],
        "preconditions": [
            {
                "condition_id": "c_req_0006",
                "kind": "require",
                "expr": {
                    "type": "call",
                    "name": "exists",
                    "arguments": [{"type": "identifier", "name": "session_token"}],
                },
            }
        ],
    }
    refs = [{"name": "torqa/extra", "version": "0.0.1", "fingerprint": "sha256:ab"}]
    out = compose_bundle(primary_bundle, [frag], library_refs=refs)
    g = ir_goal_from_json(out)
    rep = build_full_diagnostic_report(g)
    assert rep["ok"] is True, rep
    names = {i["name"] for i in out["ir_goal"]["inputs"]}
    assert "session_token" in names
    assert "username" in names


def test_tq_include_then_compose_deterministic_compact_json():
    """Include+compose path remains deterministic (compact canonical JSON)."""
    tq_path = REPO / "examples" / "torqa" / "example_include_user_login.tq"
    primary = parse_tq_source(tq_path.read_text(encoding="utf-8"), tq_path=tq_path)
    frag = {
        "inputs": [{"name": "session_token", "type": "text"}],
        "preconditions": [
            {
                "condition_id": "c_req_0006",
                "kind": "require",
                "expr": {
                    "type": "call",
                    "name": "exists",
                    "arguments": [{"type": "identifier", "name": "session_token"}],
                },
            }
        ],
    }
    refs = [{"name": "p", "version": "1.0.0", "fingerprint": "sha256:z"}]
    s1 = json.dumps(compose_bundle(primary, [frag], library_refs=refs), sort_keys=True, separators=(",", ":"))
    s2 = json.dumps(compose_bundle(primary, [frag], library_refs=refs), sort_keys=True, separators=(",", ":"))
    assert s1 == s2

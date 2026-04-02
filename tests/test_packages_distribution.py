"""Minimal publish/fetch registry and lock ``ref:`` (Priority 9)."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from src.diagnostics.report import build_full_diagnostic_report
from src.ir.canonical_ir import ir_goal_from_json
from src.packages.compose_spec import load_compose_spec
from src.packages.errors import PackageError, PX_PKG_REF_INVALID
from src.packages.fingerprint import compute_package_fingerprint
from src.packages.merge_ir import compose_bundle
from src.packages.publish_fetch import fetch_package, list_registry_packages, publish_package
from src.packages.ref import parse_package_ref
from src.packages.registry_index import REGISTRY_FILENAME
from src.packages.vendor import load_lock, vendor_packages

REPO = Path(__file__).resolve().parents[1]
MINIMAL_AUTH = REPO / "examples" / "packages" / "minimal_auth"


def test_parse_package_ref_forms():
    assert parse_package_ref("path:../pkg") == ("path", "../pkg")
    assert parse_package_ref("file:./a.tgz") == ("file", "./a.tgz")
    assert parse_package_ref("https://x/y.tgz") == ("url", "https://x/y.tgz")
    with pytest.raises(PackageError) as ei:
        parse_package_ref("nope:foo")
    assert ei.value.code == PX_PKG_REF_INVALID


def test_publish_fetch_roundtrip_same_fingerprint(tmp_path):
    pkg = tmp_path / "minimal_auth"
    shutil.copytree(MINIMAL_AUTH, pkg)
    reg = tmp_path / "registry"
    rep = publish_package(pkg, reg)
    assert rep["ok"] is True
    assert (Path(rep["artifact"])).is_file()
    assert (reg / REGISTRY_FILENAME).is_file()

    rows = list_registry_packages(str(reg))
    assert len(rows) == 1
    assert rows[0]["name"] == "torqa/minimal-auth"

    out = tmp_path / "fetched"
    got = fetch_package("torqa/minimal-auth", "1.0.0", str(reg), out)
    assert got["ok"] is True
    dest = Path(got["path"])
    assert (dest / "torqa.package.json").is_file()
    assert compute_package_fingerprint(pkg) == compute_package_fingerprint(dest) == got["fingerprint"]


def test_vendor_lock_ref_path(tmp_path):
    pkg = tmp_path / "minimal_auth"
    shutil.copytree(MINIMAL_AUTH, pkg)
    fp = compute_package_fingerprint(pkg)
    app = tmp_path / "app"
    app.mkdir()
    lock = {
        "packages": [
            {
                "name": "torqa/minimal-auth",
                "version": "1.0.0",
                "fingerprint": fp,
                "ref": "path:../minimal_auth",
            }
        ]
    }
    (app / "torqa.lock.json").write_text(json.dumps(lock, indent=2), encoding="utf-8")
    rep = vendor_packages(app / "torqa.lock.json")
    assert rep["ok"] is True
    assert len(rep["written"]) == 1


def test_vendor_lock_ref_file_tgz(tmp_path):
    pkg = tmp_path / "minimal_auth"
    shutil.copytree(MINIMAL_AUTH, pkg)
    reg = tmp_path / "registry"
    rep_pub = publish_package(pkg, reg)
    fp = rep_pub["fingerprint"]
    tgz = Path(rep_pub["artifact"])
    assert tgz.is_file()

    app = tmp_path / "consumer"
    app.mkdir()
    shutil.copy(tgz, app / "pkg.tgz")
    lock = {
        "packages": [
            {
                "name": "torqa/minimal-auth",
                "version": "1.0.0",
                "fingerprint": fp,
                "ref": "file:pkg.tgz",
            }
        ]
    }
    (app / "torqa.lock.json").write_text(json.dumps(lock), encoding="utf-8")
    rep = vendor_packages(app / "torqa.lock.json")
    assert rep["ok"] is True


def test_publish_deterministic_fingerprint_twice(tmp_path):
    pkg = tmp_path / "p"
    shutil.copytree(MINIMAL_AUTH, pkg)
    reg1 = tmp_path / "r1"
    reg2 = tmp_path / "r2"
    a = publish_package(pkg, reg1)
    b = publish_package(pkg, reg2)
    assert a["fingerprint"] == b["fingerprint"]


def test_compose_after_fetch_minimal_flow(tmp_path):
    """Publish → fetch → compose with primary from repo validates."""
    pkg = tmp_path / "minimal_auth"
    shutil.copytree(MINIMAL_AUTH, pkg)
    reg = tmp_path / "registry"
    publish_package(pkg, reg)
    fetch_package("torqa/minimal-auth", "1.0.0", str(reg), tmp_path / "out")
    dest = tmp_path / "out"
    # sanitized folder name
    sub = next(dest.iterdir())
    frag = sub / "exports" / "email_input.json"

    primary = json.loads((REPO / "examples" / "core" / "valid_minimal_flow.json").read_text(encoding="utf-8"))
    fr = json.loads(frag.read_text(encoding="utf-8"))
    out = compose_bundle(primary, [fr], library_refs=[{"name": "torqa/minimal-auth", "version": "1.0.0", "fingerprint": "x"}])
    g = ir_goal_from_json(out)
    rep = build_full_diagnostic_report(g)
    assert rep["ok"] is True, rep


def test_compose_spec_with_lock_still_loads_refs(tmp_path):
    """Regression: compose library_refs_from_lock unchanged."""
    demo = tmp_path / "demo"
    demo.mkdir()
    shutil.copy(REPO / "examples" / "package_demo" / "torqa.lock.json", demo / "torqa.lock.json")
    spec = demo / "compose.json"
    spec.write_text(
        json.dumps(
            {
                "primary": str((REPO / "examples" / "core" / "valid_minimal_flow.json").resolve()),
                "fragments": [str((MINIMAL_AUTH / "exports" / "email_input.json").resolve())],
                "library_refs_from_lock": True,
                "lock": str((demo / "torqa.lock.json").resolve()),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    data = load_compose_spec(spec)
    lock_data = load_lock(Path(data["lock"]).resolve())
    assert lock_data["packages"]

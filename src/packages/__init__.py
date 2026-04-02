"""Minimal TORQA package / vendor / IR compose (Priority 8)."""

from .compose_spec import load_compose_spec, load_fragment_json
from .errors import PackageError
from .fingerprint import compute_package_fingerprint
from .manifest import load_package_manifest
from .merge_ir import compose_bundle, merge_ir_goal_fragments
from .vendor import load_lock, vendor_packages

__all__ = [
    "PackageError",
    "compute_package_fingerprint",
    "load_package_manifest",
    "load_lock",
    "vendor_packages",
    "merge_ir_goal_fragments",
    "compose_bundle",
    "load_compose_spec",
    "load_fragment_json",
]

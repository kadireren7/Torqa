"""
n8n-specific static checks (findings) — does not replace Torqa IR policy; complements it.

Each finding maps to an n8n node where applicable for scan/validate JSON reporting.
"""

from __future__ import annotations

from typing import Any, Dict, List, Set
import re

from torqa.integrations.n8n.parser import (
    N8nWorkflow,
    build_adjacency,
    entry_node_names,
    order_nodes_linear,
)


def _type_lower(n_type: str) -> str:
    return n_type.lower()


def _is_trigger_type(n_type: str) -> bool:
    t = _type_lower(n_type)
    return any(
        x in t
        for x in (
            "trigger",
            "webhook",
            "schedule",
            "nodes-base.start",
            "formtrigger",
            "emailreadimap",
        )
    )


def _is_http_node(n_type: str) -> bool:
    t = _type_lower(n_type)
    return "httprequest" in t or "http request" in t or "axios" in t


def _is_code_node(n_type: str) -> bool:
    return "code" in _type_lower(n_type) or "function" in _type_lower(n_type)


def _is_external_side_effect(n_type: str) -> bool:
    t = _type_lower(n_type)
    if _is_http_node(n_type):
        return True
    return any(
        x in t
        for x in (
            "slack",
            "discord",
            "telegram",
            "nodemailer",
            "sendgrid",
            "gmail",
            "postgres",
            "mysql",
            "mongodb",
            "googlesheets",
            "airtable",
            "s3",
        )
    )


def _is_manual_gate(n_type: str) -> bool:
    t = _type_lower(n_type)
    return "manualtrigger" in t or "form" in t and "trigger" in t or "wait" in t


_SECRET_KEY_RE = re.compile(r"(api[-_]?key|token|secret|password|authorization|bearer)", re.IGNORECASE)
_MASK_RE = re.compile(r"(\*{3,}|<redacted>|<hidden>|xxxxx|changeme)", re.IGNORECASE)


def _iter_pairs(obj: Any, prefix: str = "", depth: int = 0) -> List[tuple[str, str]]:
    if depth > 8:
        return []
    out: List[tuple[str, str]] = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            p = f"{prefix}.{k}" if prefix else str(k)
            if isinstance(v, (str, int, float, bool)):
                out.append((p, str(v)))
            elif isinstance(v, (dict, list)):
                out.extend(_iter_pairs(v, p, depth + 1))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            p = f"{prefix}[{i}]"
            if isinstance(v, (str, int, float, bool)):
                out.append((p, str(v)))
            elif isinstance(v, (dict, list)):
                out.extend(_iter_pairs(v, p, depth + 1))
    return out


def analyze_n8n_workflow(wf: N8nWorkflow) -> List[Dict[str, Any]]:
    """
    Return a list of finding dicts:

    ``rule_id``, ``severity`` (info|review|high), ``message``, ``fix_suggestion``,
    ``n8n_node_id``, ``n8n_node_name``, ``n8n_node_type``.
    """
    findings: List[Dict[str, Any]] = []
    name_to = {n.name: n for n in wf.nodes}

    ordered, topo_warnings = order_nodes_linear(wf)
    for w in topo_warnings:
        findings.append(
            {
                "rule_id": "n8n.graph.disconnected",
                "severity": "review",
                "message": w,
                "fix_suggestion": "Connect this node to the primary trigger path or disable/remove it.",
                "n8n_node_id": None,
                "n8n_node_name": None,
                "n8n_node_type": None,
            }
        )

    # Cycle hint: if many nodes but BFS order length < nodes count without disconnected warnings
    adj = build_adjacency(wf)
    reachable: Set[str] = set()
    roots = entry_node_names(wf)
    stack = list(roots)
    while stack:
        u = stack.pop()
        if u in reachable or u not in name_to:
            continue
        reachable.add(u)
        for v in adj.get(u, []):
            if v not in reachable:
                stack.append(v)
    if len(reachable) < len(wf.nodes) and not any(f.get("rule_id") == "n8n.graph.disconnected" for f in findings):
        findings.append(
            {
                "rule_id": "n8n.graph.reachability",
                "severity": "review",
                "message": "n8n: not all nodes are reachable from entry roots (possible cycles or orphan subgraphs)",
                "fix_suggestion": "Review node connections for cycles/orphans and ensure every production path starts from an intended trigger.",
                "n8n_node_id": None,
                "n8n_node_name": None,
                "n8n_node_type": None,
            }
        )

    for n in wf.nodes:
        if n.disabled:
            findings.append(
                {
                    "rule_id": "n8n.node.disabled",
                    "severity": "info",
                    "message": "Node is disabled and may indicate drift between intended and active workflow behavior.",
                    "fix_suggestion": "Remove stale disabled nodes or document why they are intentionally disabled.",
                    "n8n_node_id": n.node_id,
                    "n8n_node_name": n.name,
                    "n8n_node_type": n.type,
                }
            )
            continue
        t = n.type
        tl = _type_lower(t)
        base = {
            "n8n_node_id": n.node_id,
            "n8n_node_name": n.name,
            "n8n_node_type": t,
        }
        if n.credentials:
            findings.append(
                {
                    "rule_id": "n8n.credentials.attached",
                    "severity": "review",
                    "message": "Node references credentials — review scope and rotation policy.",
                    "fix_suggestion": "Use least-privilege credentials, rotate secrets, and avoid broad shared credential objects.",
                    **base,
                }
            )
        if isinstance(n.parameters, dict):
            for key_path, val in _iter_pairs(n.parameters):
                leaf = key_path.split(".")[-1]
                if not _SECRET_KEY_RE.search(leaf):
                    continue
                v = val.strip()
                if len(v) < 6 or _MASK_RE.search(v) or "{{" in v or "${" in v:
                    continue
                findings.append(
                    {
                        "rule_id": "n8n.secret.hardcoded",
                        "severity": "high",
                        "message": f'Potential hardcoded credential-like value detected in "{leaf}".',
                        "fix_suggestion": "Move secrets into n8n credentials/env vars and reference them dynamically.",
                        **base,
                    }
                )
                break
        if _is_code_node(t):
            findings.append(
                {
                    "rule_id": "n8n.code_node",
                    "severity": "review",
                    "message": "Code / Function node executes arbitrary logic — review inputs and sandboxing.",
                    "fix_suggestion": "Prefer built-in nodes when possible; if code is required, add code review and explicit input/output validation.",
                    **base,
                }
            )
        if _is_http_node(t):
            risky = False
            if isinstance(n.parameters, dict):
                if not n.parameters.get("continueOnFail") and not n.parameters.get("onError"):
                    risky = True
            if risky:
                findings.append(
                    {
                        "rule_id": "n8n.http.no_explicit_error_handler",
                        "severity": "review",
                        "message": "HTTP Request node has no explicit onError / continueOnFail — failures may stop the workflow abruptly.",
                        "fix_suggestion": "Set onError/continueOnFail intentionally and route failures to a dedicated remediation path.",
                        **base,
                    }
                )
            if n.parameters.get("allowUnauthorizedCerts") or n.parameters.get("ignoreSSLIssues"):
                findings.append(
                    {
                        "rule_id": "n8n.http.ssl_relaxed",
                        "severity": "high",
                        "message": "HTTP node relaxes TLS verification — high risk for production.",
                        "fix_suggestion": "Enable strict TLS verification and remove ignoreSSLIssues/allowUnauthorizedCerts in production.",
                        **base,
                    }
                )
            if isinstance(n.parameters, dict):
                url = str(n.parameters.get("url") or n.parameters.get("uri") or "").strip()
                if url.lower().startswith("http://"):
                    findings.append(
                        {
                            "rule_id": "n8n.http.plaintext_transport",
                            "severity": "high",
                            "message": "HTTP node targets a plaintext http:// endpoint.",
                            "fix_suggestion": "Use HTTPS endpoints only and enforce TLS verification.",
                            **base,
                        }
                    )
        if "webhook" in tl and wf.active is True:
            findings.append(
                {
                    "rule_id": "n8n.webhook.active_workflow",
                    "severity": "review",
                    "message": "Workflow is active and contains a Webhook — confirm production exposure and auth.",
                    "fix_suggestion": "Require auth/signature checks on webhook ingress and verify endpoint exposure for active workflows.",
                    **base,
                }
            )
        if _is_external_side_effect(t) and not _is_trigger_type(t):
            try:
                idx = next(i for i, x in enumerate(ordered) if x.name == n.name)
            except StopIteration:
                idx = 0
            prior = ordered[:idx]
            if not any(_is_manual_gate(p.type) for p in prior):
                findings.append(
                    {
                        "rule_id": "n8n.governance.no_manual_before_side_effect",
                        "severity": "review",
                        "message": "External side-effect node with no Manual / Form gate earlier in the inferred order — consider human approval for production.",
                        "fix_suggestion": "Insert a manual approval or policy gate before external side-effect nodes in production paths.",
                        **base,
                    }
                )

    # Retry / error path: look for HTTP without error output wiring (simplified)
    for n in wf.nodes:
        if n.disabled or not _is_http_node(n.type):
            continue
        block = wf.connections.get(n.name)
        has_error_branch = False
        if isinstance(block, dict):
            err_out = block.get("error")
            if isinstance(err_out, list) and err_out:
                has_error_branch = True
        if not has_error_branch and isinstance(n.parameters, dict):
            if n.parameters.get("onError") in (None, "stop"):
                findings.append(
                    {
                        "rule_id": "n8n.http.no_error_output_branch",
                        "severity": "info",
                        "message": "HTTP node has no dedicated error output branch in connections — consider wiring error handling.",
                        "fix_suggestion": "Wire HTTP error output to retry/alert/rollback logic for better operational resilience.",
                        "n8n_node_id": n.node_id,
                        "n8n_node_name": n.name,
                        "n8n_node_type": n.type,
                    }
                )

    if any(_is_trigger_type(n.type) for n in wf.nodes):
        has_failure_path = any("error" in _type_lower(n.type) or "catch" in _type_lower(n.type) for n in wf.nodes)
        if not has_failure_path:
            findings.append(
                {
                    "rule_id": "n8n.observability.failure_path_missing",
                    "severity": "review",
                    "message": "No explicit error/catch node detected for triggered workflow paths.",
                    "fix_suggestion": "Add a failure path (error trigger/catch + alerting) for operational visibility.",
                    "n8n_node_id": None,
                    "n8n_node_name": "workflow",
                    "n8n_node_type": None,
                }
            )

    return findings

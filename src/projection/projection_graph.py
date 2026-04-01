"""
Projection graph model and builders (V3).

IR-centered and projection-plan-centered coordination graph.
"""

from __future__ import annotations

from typing import Dict, List

from src.ir.canonical_ir import IRGoal
from src.projection.projection_strategy import ProjectionPlan, ProjectionTarget


class ProjectionNode:
    def __init__(self, node_id: str, target: ProjectionTarget, artifacts=None):
        self.node_id = node_id
        self.target = target
        self.artifacts = artifacts or []


class ProjectionEdge:
    def __init__(self, from_node: str, to_node: str, relation_type: str):
        self.from_node = from_node
        self.to_node = to_node
        self.relation_type = relation_type  # "depends_on" | "feeds" | "mirrors"


class ProjectionGraph:
    def __init__(self, nodes: List[ProjectionNode], edges: List[ProjectionEdge]):
        self.nodes = nodes
        self.edges = edges


def _relation_from_purpose(root_purpose: str, child_purpose: str, has_transitions: bool) -> str:
    if child_purpose in {"storage_surface", "frontend_surface"}:
        return "feeds" if has_transitions else "depends_on"
    if child_purpose in {"tooling_bridge", "editor_integration"}:
        return "mirrors"
    if root_purpose != child_purpose:
        return "depends_on"
    return "mirrors"


def build_projection_graph(ir_goal: IRGoal, projection_plan: ProjectionPlan) -> ProjectionGraph:
    nodes: List[ProjectionNode] = []
    edges: List[ProjectionEdge] = []

    root = ProjectionNode("n_primary", projection_plan.primary_target, artifacts=[])
    nodes.append(root)

    has_transitions = len(ir_goal.transitions) > 0
    for i, target in enumerate(projection_plan.secondary_targets, start=1):
        nid = f"n_secondary_{i:04d}"
        node = ProjectionNode(nid, target, artifacts=[])
        nodes.append(node)
        edges.append(
            ProjectionEdge(
                from_node=root.node_id,
                to_node=nid,
                relation_type=_relation_from_purpose(
                    projection_plan.primary_target.purpose,
                    target.purpose,
                    has_transitions,
                ),
            )
        )

    return ProjectionGraph(nodes, edges)


def projection_graph_to_json(graph: ProjectionGraph) -> Dict:
    return {
        "projection_graph": {
            "nodes": [
                {
                    "node_id": n.node_id,
                    "target": {
                        "language": n.target.language,
                        "purpose": n.target.purpose,
                        "confidence": n.target.confidence,
                    },
                    "artifacts": list(n.artifacts),
                }
                for n in graph.nodes
            ],
            "edges": [
                {
                    "from_node": e.from_node,
                    "to_node": e.to_node,
                    "relation_type": e.relation_type,
                }
                for e in graph.edges
            ],
        }
    }

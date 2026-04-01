use serde::{Deserialize, Serialize};

use crate::ir::goal::IrGoal;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProjectionTarget {
    pub language: String,
    pub purpose: String,
    pub confidence: f64,
    pub reasons: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProjectionPlan {
    pub primary_target: ProjectionTarget,
    pub secondary_targets: Vec<ProjectionTarget>,
    pub strategy_notes: Vec<String>,
}

pub fn choose_projection_targets(
    goal: &IrGoal,
    semantic_errors: &[String],
    semantic_warnings: &[String],
) -> ProjectionPlan {
    let mut rust_score = 0.65_f64;
    let mut go_score = 0.45_f64;
    let mut py_score = 0.35_f64;
    if !goal.transitions.is_empty() {
        rust_score += 0.15;
        go_score += 0.12;
    }
    if semantic_errors.is_empty() {
        rust_score += 0.12;
    } else {
        py_score += 0.10;
    }
    if !semantic_warnings.is_empty() {
        py_score += 0.06;
    }

    let primary = ProjectionTarget {
        language: "rust".to_string(),
        purpose: "core_runtime".to_string(),
        confidence: rust_score.min(1.0),
        reasons: vec![
            "Safety/runtime profile aligns with Rust core direction.".to_string(),
            "IR-first roadmap prioritizes Rust as semantic/execution engine.".to_string(),
        ],
    };
    let mut secondary = Vec::new();
    if go_score > 0.50 {
        secondary.push(ProjectionTarget {
            language: "go".to_string(),
            purpose: "service_backend".to_string(),
            confidence: go_score.min(1.0),
            reasons: vec!["Good backend service complement for runtime projection.".to_string()],
        });
    }
    if py_score > 0.35 {
        secondary.push(ProjectionTarget {
            language: "python".to_string(),
            purpose: "tooling_bridge".to_string(),
            confidence: py_score.min(1.0),
            reasons: vec!["Useful for orchestration/editor integration layers.".to_string()],
        });
    }
    ProjectionPlan {
        primary_target: primary,
        secondary_targets: secondary,
        strategy_notes: vec![
            "Dynamic scoring is used; no fixed domain-language mapping.".to_string(),
            "IR remains the source of truth.".to_string(),
        ],
    }
}

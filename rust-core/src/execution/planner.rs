use serde::{Deserialize, Serialize};

use crate::ir::goal::IrGoal;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExecutionStep {
    pub step_id: String,
    pub kind: String,
    pub ref_id: String,
    pub status: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExecutionPlan {
    pub steps: Vec<ExecutionStep>,
}

pub fn build_execution_plan(goal: &IrGoal) -> ExecutionPlan {
    let mut steps = Vec::new();
    let mut i = 1;
    for c in &goal.preconditions {
        steps.push(ExecutionStep {
            step_id: format!("s_{:04}", i),
            kind: "precondition".to_string(),
            ref_id: c.condition_id.clone(),
            status: "pending".to_string(),
        });
        i += 1;
    }
    for c in &goal.forbids {
        steps.push(ExecutionStep {
            step_id: format!("s_{:04}", i),
            kind: "forbid".to_string(),
            ref_id: c.condition_id.clone(),
            status: "pending".to_string(),
        });
        i += 1;
    }
    for t in &goal.transitions {
        steps.push(ExecutionStep {
            step_id: format!("s_{:04}", i),
            kind: "transition".to_string(),
            ref_id: t.transition_id.clone(),
            status: "pending".to_string(),
        });
        i += 1;
    }
    steps.push(ExecutionStep {
        step_id: format!("s_{:04}", i),
        kind: "finish".to_string(),
        ref_id: "finish".to_string(),
        status: "pending".to_string(),
    });
    ExecutionPlan { steps }
}

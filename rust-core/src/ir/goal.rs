use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::expr::IrExpr;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct IrInput {
    pub name: String,
    #[serde(rename = "type")]
    pub type_name: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct IrCondition {
    pub condition_id: String,
    pub kind: String,
    pub expr: IrExpr,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct IrTransition {
    pub transition_id: String,
    pub effect_name: String,
    pub arguments: Vec<IrExpr>,
    pub from_state: String,
    pub to_state: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct IrGoal {
    pub goal: String,
    pub inputs: Vec<IrInput>,
    pub preconditions: Vec<IrCondition>,
    pub forbids: Vec<IrCondition>,
    pub transitions: Vec<IrTransition>,
    pub postconditions: Vec<IrCondition>,
    pub result: Option<String>,
    pub metadata: Value,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct IrGoalEnvelope {
    pub ir_goal: IrGoal,
}

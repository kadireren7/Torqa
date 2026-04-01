use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum IrExpr {
    Identifier {
        name: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        semantic_type: Option<String>,
    },
    StringLiteral { value: String },
    NumberLiteral { value: i64 },
    BooleanLiteral { value: bool },
    Call { name: String, arguments: Vec<IrExpr> },
    Binary {
        left: Box<IrExpr>,
        operator: String,
        right: Box<IrExpr>,
    },
    Logical {
        left: Box<IrExpr>,
        operator: String,
        right: Box<IrExpr>,
    },
}

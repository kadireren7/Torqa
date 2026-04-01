use std::collections::HashMap;

use crate::ir::expr::IrExpr;

pub fn infer_expr_type(expr: &IrExpr, table: &HashMap<String, String>) -> Option<String> {
    match expr {
        IrExpr::Identifier { name, semantic_type } => table
            .get(name)
            .cloned()
            .or_else(|| semantic_type.clone())
            .or(Some("unknown".to_string())),
        IrExpr::StringLiteral { .. } => Some("text".to_string()),
        IrExpr::NumberLiteral { .. } => Some("number".to_string()),
        IrExpr::BooleanLiteral { .. } => Some("boolean".to_string()),
        IrExpr::Call { .. } => Some("unknown".to_string()),
        IrExpr::Binary { .. } | IrExpr::Logical { .. } => Some("boolean".to_string()),
    }
}

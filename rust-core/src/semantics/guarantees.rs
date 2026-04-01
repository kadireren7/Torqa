use std::collections::HashMap;

use crate::ir::expr::IrExpr;
use crate::ir::goal::IrGoal;

#[derive(Clone, Debug)]
pub struct Guarantee {
    pub identifier: String,
    pub state: String,
    pub kind: String,
    pub source_id: String,
}

pub type GuaranteeTable = HashMap<String, HashMap<String, Vec<Guarantee>>>;

pub fn build_guarantee_table(goal: &IrGoal) -> GuaranteeTable {
    let mut table: GuaranteeTable = HashMap::new();
    for c in &goal.preconditions {
        if c.kind != "require" {
            continue;
        }
        collect_from_expr(&c.expr, &c.condition_id, &mut table);
    }
    table.entry("after".to_string()).or_default();
    table
}

fn collect_from_expr(expr: &IrExpr, source_id: &str, table: &mut GuaranteeTable) {
    match expr {
        IrExpr::Call { name, arguments } if name == "exists" && arguments.len() == 1 => {
            if let IrExpr::Identifier { name, .. } = &arguments[0] {
                table
                    .entry("before".to_string())
                    .or_default()
                    .entry(name.clone())
                    .or_default()
                    .push(Guarantee {
                        identifier: name.clone(),
                        state: "before".to_string(),
                        kind: "exists".to_string(),
                        source_id: source_id.to_string(),
                    });
            }
        }
        IrExpr::Binary { left, operator, right } => {
            if let IrExpr::Identifier { name, .. } = &**left {
                if matches!(
                    &**right,
                    IrExpr::StringLiteral { .. }
                        | IrExpr::NumberLiteral { .. }
                        | IrExpr::BooleanLiteral { .. }
                ) {
                    let kind = if operator == "==" { "equals" } else { "exists" };
                    table
                        .entry("before".to_string())
                        .or_default()
                        .entry(name.clone())
                        .or_default()
                        .push(Guarantee {
                            identifier: name.clone(),
                            state: "before".to_string(),
                            kind: kind.to_string(),
                            source_id: source_id.to_string(),
                        });
                }
            }
            collect_from_expr(left, source_id, table);
            collect_from_expr(right, source_id, table);
        }
        IrExpr::Logical { left, right, .. } => {
            collect_from_expr(left, source_id, table);
            collect_from_expr(right, source_id, table);
        }
        _ => {}
    }
}

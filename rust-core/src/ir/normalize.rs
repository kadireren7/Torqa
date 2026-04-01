use sha2::{Digest, Sha256};

use crate::ir::expr::IrExpr;
use crate::ir::goal::IrGoal;

pub fn normalize_ir_goal(goal: &IrGoal) -> IrGoal {
    let mut n = goal.clone();
    for c in &mut n.preconditions {
        c.expr = normalize_expr(&c.expr);
    }
    for c in &mut n.forbids {
        c.expr = normalize_expr(&c.expr);
    }
    for c in &mut n.postconditions {
        c.expr = normalize_expr(&c.expr);
    }
    for t in &mut n.transitions {
        t.arguments = t.arguments.iter().map(normalize_expr).collect();
    }
    n.inputs.sort_by(|a, b| a.name.cmp(&b.name));
    n
}

pub fn compute_ir_fingerprint(goal: &IrGoal) -> Result<String, String> {
    let json = serde_json::to_string(goal).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    hasher.update(json.as_bytes());
    Ok(format!("{:x}", hasher.finalize()))
}

fn normalize_expr(expr: &IrExpr) -> IrExpr {
    match expr {
        IrExpr::Identifier { .. }
        | IrExpr::StringLiteral { .. }
        | IrExpr::NumberLiteral { .. }
        | IrExpr::BooleanLiteral { .. } => expr.clone(),
        IrExpr::Call { name, arguments } => IrExpr::Call {
            name: name.clone(),
            arguments: arguments.iter().map(normalize_expr).collect(),
        },
        IrExpr::Binary {
            left,
            operator,
            right,
        } => {
            let l = normalize_expr(left);
            let r = normalize_expr(right);
            if operator == "==" || operator == "!=" {
                let jl = serde_json::to_string(&l).unwrap_or_default();
                let jr = serde_json::to_string(&r).unwrap_or_default();
                if jr < jl {
                    return IrExpr::Binary {
                        left: Box::new(r),
                        operator: operator.clone(),
                        right: Box::new(l),
                    };
                }
            }
            IrExpr::Binary {
                left: Box::new(l),
                operator: operator.clone(),
                right: Box::new(r),
            }
        }
        IrExpr::Logical {
            left,
            operator,
            right,
        } => {
            let l = normalize_expr(left);
            let r = normalize_expr(right);
            if operator == "and" || operator == "or" {
                let jl = serde_json::to_string(&l).unwrap_or_default();
                let jr = serde_json::to_string(&r).unwrap_or_default();
                if jr < jl {
                    return IrExpr::Logical {
                        left: Box::new(r),
                        operator: operator.clone(),
                        right: Box::new(l),
                    };
                }
            }
            IrExpr::Logical {
                left: Box::new(l),
                operator: operator.clone(),
                right: Box::new(r),
            }
        }
    }
}

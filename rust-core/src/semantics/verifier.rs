use crate::ir::goal::IrGoal;
use crate::semantics::guarantees::build_guarantee_table;
use crate::semantics::symbol_table::build_symbol_table;

pub fn validate_semantics(goal: &IrGoal) -> (Vec<String>, Vec<String>) {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();
    let table = match build_symbol_table(goal) {
        Ok(t) => t,
        Err(e) => return (vec![e], warnings),
    };
    let g = build_guarantee_table(goal);
    let before = g.get("before");
    for c in &goal.forbids {
        let ids = collect_ids_from_json_expr(&c.expr);
        for id in ids {
            if !before
                .and_then(|m| m.get(&id))
                .map(|v| !v.is_empty())
                .unwrap_or(false)
            {
                errors.push(format!(
                    "IR semantics: identifier '{}' in forbid '{}' has no before guarantee.",
                    id, c.condition_id
                ));
            }
        }
    }
    if !goal.transitions.is_empty() && goal.result.clone().unwrap_or_default().trim().is_empty() {
        warnings.push(
            "IR semantics: transitions exist but result text is empty or missing.".to_string(),
        );
    }
    for i in &goal.inputs {
        if !table.contains_key(&i.name) {
            errors.push(format!("IR semantics: undefined input '{}'.", i.name));
        }
    }
    (errors, warnings)
}

fn collect_ids_from_json_expr(expr: &crate::ir::expr::IrExpr) -> Vec<String> {
    use crate::ir::expr::IrExpr::*;
    let mut out = Vec::new();
    match expr {
        Identifier { name, .. } => out.push(name.clone()),
        Call { arguments, .. } => {
            for a in arguments {
                out.extend(collect_ids_from_json_expr(a));
            }
        }
        Binary { left, right, .. } | Logical { left, right, .. } => {
            out.extend(collect_ids_from_json_expr(left));
            out.extend(collect_ids_from_json_expr(right));
        }
        _ => {}
    }
    out
}

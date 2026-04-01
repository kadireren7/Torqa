use serde::{Deserialize, Serialize};

use crate::ir::goal::IrGoal;
use crate::projection::strategy::ProjectionTarget;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GeneratedArtifact {
    pub target_language: String,
    pub path_hint: String,
    pub content: String,
}

fn ir_summary_lines(goal: &IrGoal) -> Vec<String> {
    let mut lines = vec![
        "Auto-generated from AI core IR.".to_string(),
        "Do not treat as primary source.".to_string(),
        format!("Goal: {}", goal.goal),
    ];
    if let Some(r) = &goal.result {
        if !r.trim().is_empty() {
            lines.push(format!("Result label: {r}"));
        }
    }
    lines.push(format!("Inputs: {}", goal.inputs.len()));
    lines.push(format!("Requires: {}", goal.preconditions.len()));
    lines.push(format!("Forbids: {}", goal.forbids.len()));
    lines.push(format!("Effects: {}", goal.transitions.len()));
    lines
}

pub fn generate_stub(goal: &IrGoal, target: &ProjectionTarget) -> GeneratedArtifact {
    let summary_lines = ir_summary_lines(goal);
    let (path_hint, content) = match target.language.as_str() {
        "rust" => {
            let doc = summary_lines
                .iter()
                .map(|l| format!("//! {l}"))
                .collect::<Vec<_>>()
                .join("\n");
            (
                "generated/rust/main.rs".to_string(),
                format!(
                    "{doc}\n\nfn main() {{\n    println!(\"goal={{}}\", {:?});\n}}\n",
                    goal.goal
                ),
            )
        }
        "python" => {
            let com = summary_lines
                .iter()
                .map(|l| format!("# {l}"))
                .collect::<Vec<_>>()
                .join("\n");
            (
                "generated/python/main.py".to_string(),
                format!(
                    "{com}\n\nGOAL_NAME = {:?}\n\ndef main():\n    print(GOAL_NAME)\n\nif __name__ == '__main__':\n    main()\n",
                    goal.goal
                ),
            )
        }
        "sql" => {
            let com = summary_lines
                .iter()
                .map(|l| format!("-- {l}"))
                .collect::<Vec<_>>()
                .join("\n");
            (
                "generated/sql/schema.sql".to_string(),
                format!(
                    "{com}\n\n-- Use Python ir_goal_sql_projection for DDL-style storage projection.\n"
                ),
            )
        }
        _ => (
            format!("generated/{}/README.txt", target.language),
            format!("{}\n", summary_lines.join("\n")),
        ),
    };
    GeneratedArtifact {
        target_language: target.language.clone(),
        path_hint,
        content,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ir::goal::{IrGoal, IrInput};
    use serde_json::json;

    fn minimal_goal() -> IrGoal {
        IrGoal {
            goal: "TestGoal".to_string(),
            inputs: vec![IrInput {
                name: "username".to_string(),
                type_name: "text".to_string(),
            }],
            preconditions: vec![],
            forbids: vec![],
            transitions: vec![],
            postconditions: vec![],
            result: Some("OK".to_string()),
            metadata: json!({"ir_version":"1.3","source":"test","canonical_language":"english"}),
        }
    }

    #[test]
    fn stub_contains_goal_name() {
        let g = minimal_goal();
        let t = ProjectionTarget {
            language: "rust".to_string(),
            purpose: "runtime".to_string(),
            confidence: 1.0,
            reasons: vec![],
        };
        let art = generate_stub(&g, &t);
        assert!(art.content.contains("TestGoal"));
    }
}

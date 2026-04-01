use serde::{Deserialize, Serialize};

use crate::ir::goal::IrGoal;
use crate::projection::strategy::ProjectionTarget;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GeneratedArtifact {
    pub target_language: String,
    pub path_hint: String,
    pub content: String,
}

pub fn generate_stub(goal: &IrGoal, target: &ProjectionTarget) -> GeneratedArtifact {
    let (path_hint, content) = match target.language.as_str() {
        "rust" => (
            "generated/rust/main.rs".to_string(),
            format!(
                "// Stub for {}\nfn main() {{\n    // TODO: generated runtime skeleton\n}}\n",
                goal.goal
            ),
        ),
        "python" => (
            "generated/python/main.py".to_string(),
            format!(
                "# Stub for {}\ndef main():\n    pass\n\nif __name__ == '__main__':\n    main()\n",
                goal.goal
            ),
        ),
        "sql" => (
            "generated/sql/schema.sql".to_string(),
            "-- Stub SQL projection\n-- TODO: generate tables/views\n".to_string(),
        ),
        _ => (
            format!("generated/{}/README.txt", target.language),
            "Stub artifact generated.".to_string(),
        ),
    };
    GeneratedArtifact {
        target_language: target.language.clone(),
        path_hint,
        content,
    }
}

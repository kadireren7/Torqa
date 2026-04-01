use std::collections::HashMap;

use crate::ir::goal::IrGoal;

pub type SymbolTable = HashMap<String, String>;

pub fn build_symbol_table(goal: &IrGoal) -> Result<SymbolTable, String> {
    let mut map = HashMap::new();
    for i in &goal.inputs {
        if map.contains_key(&i.name) {
            return Err(format!("Duplicate input '{}'.", i.name));
        }
        map.insert(i.name.clone(), i.type_name.clone());
    }
    Ok(map)
}

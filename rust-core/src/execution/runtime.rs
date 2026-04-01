use std::collections::HashMap;

use serde_json::Value;

#[derive(Clone, Debug)]
pub struct ExecutionContext {
    pub inputs: HashMap<String, Value>,
    pub world_state: HashMap<String, Value>,
}

impl ExecutionContext {
    pub fn new(inputs: HashMap<String, Value>) -> Self {
        Self {
            inputs,
            world_state: HashMap::new(),
        }
    }
}

pub trait RuntimeFunction: Send + Sync {
    fn call(&self, args: Vec<Value>, ctx: &mut ExecutionContext) -> Value;
}

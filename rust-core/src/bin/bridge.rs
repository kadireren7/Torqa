use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    if let Err(e) = io::stdin().read_to_string(&mut input) {
        eprintln!("{{\"error\":\"stdin_read_failed: {}\"}}", e);
        std::process::exit(1);
    }
    match rust_core::ffi::run_rust_pipeline(&input) {
        Ok(v) => match serde_json::to_string(&v) {
            Ok(s) => println!("{}", s),
            Err(e) => {
                eprintln!("{{\"error\":\"serialize_failed: {}\"}}", e);
                std::process::exit(1);
            }
        },
        Err(e) => {
            eprintln!("{{\"error\":\"{}\"}}", e.replace('"', "\\\""));
            std::process::exit(1);
        }
    }
}

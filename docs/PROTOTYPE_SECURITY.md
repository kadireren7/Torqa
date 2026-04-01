# Prototype security notice

Project-X is an **early architecture prototype**, not a hardened production platform.

- Generated web apps and server stubs are **demonstration projections**. Do not expose them to the public internet without a full security review.
- The web console (`webui/`) runs a local FastAPI server. Bind to `127.0.0.1` for local trials; do not run it as a multi-tenant service without authentication and isolation.
- The Rust bridge executes `cargo run` from the repository. Only run IR bundles you trust; treat the console as a **developer tool**, not an anonymous endpoint.
- Demo inputs and execution paths use registry-backed stubs. Real authentication, storage, and policy enforcement are **out of scope** for this repository revision.

When moving toward production, add threat modeling, sandboxed execution, secret management, and rate limiting appropriate to your deployment.

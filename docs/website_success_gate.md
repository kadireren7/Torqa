# Website Success Gate (V6.3)

`website_success_gate(result) -> bool`

The success gate returns `true` only when all of these are satisfied:

- threshold test passed
- artifact validation passed
- semantic report is clean enough for generation (`semantic_ok == true`)
- no fatal projection consistency errors

If and only if the gate passes:

- `ready_for_checkpoint_commit = true`
- `github_push_recommended` may be set to true after Git readiness checks also pass

## Input contract

The `result` object includes:

- `threshold_test`
- `artifact_validation`
- `semantic_report`
- `consistency_errors`

All fields are English-keyed and JSON-safe.

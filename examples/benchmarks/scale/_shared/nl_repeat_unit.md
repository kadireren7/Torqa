### Structured workflow slice (repeatable)

- **Branch gate:** verify `policy_version`, `tenant_id`, and `credential_scope` before advancing.
- **Data plane:** transform payload through `normalize → validate_schema → sign_hmac → route_partition`.
- **Control plane:** if `risk_score` exceeds `tier_threshold`, enqueue `manual_review` with `sla_minutes`; else `auto_commit`.
- **Observability:** emit `audit_event` with `correlation_id`, `step_depth`, and `branch_id` for trace replay.

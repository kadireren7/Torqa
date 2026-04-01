# Git Checkpoint Readiness (V6.3)

`validate_git_checkpoint_readiness(...) -> list[str]`

Returns blocking errors for checkpoint publication.
An empty list means checkpoint is ready for human-reviewed commit/push.

## Checks

- website success gate passed
- no fatal orchestrator consistency issue
- no unresolved fatal diagnostics
- canonical docs present
- cleanup/deprecation state recorded
- generated artifacts tracking-vs-ignored policy explicitly declared

## Push policy

- The system does not push automatically.
- Push remains human-approved.
- `checkpoint_push_readiness.md` summarizes current recommendation:
  - `github_push_recommended = true` only when the gate and readiness checks pass.

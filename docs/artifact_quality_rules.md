# Artifact Quality Rules (V6.2)

Function: `validate_generated_artifacts(artifacts) -> list[str]`

## Validation Rules

1. Required files must exist for minimal website output:
   - `generated/webapp/package.json`
   - `generated/webapp/tsconfig.json`
   - `generated/webapp/src/main.tsx`
   - `generated/webapp/src/App.tsx`
2. No duplicate/conflicting filenames across artifacts.
3. Minimal website entrypoint must exist (`src/main.tsx`).
4. Critical files must not be empty.
5. Artifact sets must be structurally coherent as one project.

## Error Policy

- Return a list of human-readable errors.
- Empty list means validation passed.
- Validation is consumed by CLI and threshold gating logic.

# Website Generation Threshold (V6.2)

V6.2 introduces the first real projection/codegen threshold for website output.

## Objective

From canonical IR, the system must generate a coherent, runnable minimal website project artifact.

## Gate

`simple website generation = passed` is required before application shell release flow continues.

## Minimum Project Shape

- `generated/webapp/package.json`
- `generated/webapp/tsconfig.json`
- `generated/webapp/src/main.tsx`
- `generated/webapp/src/App.tsx`
- `generated/webapp/src/pages/*`
- `generated/webapp/README.md`

## Decision Inputs

The threshold decision uses:

1. IR availability and projection plan
2. Generation plan contract
3. Generated artifact quality validation
4. Website threshold test (`can_generate_simple_website`)

## Out of Scope

- Full-stack framework scaffolding
- Complete domain coverage
- Production deployment hardening

# P137 — Trial quality and reliability audit (pre–broad trials)

**Goal:** Surface major risks before handing TORQA to more users; fix only **high-severity** blockers that hurt first impressions or trust.

## 1. Output quality by domain (reference vs live)

| Domain | What “quality” means here | Where it is validated |
|--------|---------------------------|------------------------|
| **Website** | Flagship compression + marketing copy honesty | `docs/BENCHMARK_FLAGSHIP.md`, `reports/comparison_report.json`, website Proof page |
| **App** (generated webapp) | Materialize + optional Vite preview | `torqa app`, desktop build flow, `DEMO_LOCALHOST.md` |
| **Workflow** | Token-proof scenarios + validation gate | `docs/TOKEN_PROOF.md`, `torqa-token-proof`, `VALIDATION_GATE.md` |
| **Automation** | Same token-proof suite (pipeline-shaped rows) | `reports/token_proof.json` scenario families in P136 |
| **Company operations** | Out of product scope for automated audit — trials use your policies | `KNOWN_LIMITS.md`, `TRIAL_READINESS.md` |

**Honesty:** Reference benchmarks are **not** live GPT/Claude/Gemini runs. See [`COMPARISON_REPORT.md`](COMPARISON_REPORT.md).

## 2. Reliability (first-pass / repaired / unrecoverable)

| Signal | Where to observe |
|--------|------------------|
| **First-pass success** | Desktop run summary, `ok` in `torqa --json app` / `generate-tq` |
| **Repaired success** | LLM retry counts, `llm_fallback_used` fields in JSON; desktop Activity log |
| **Unrecoverable failure** | Non-zero exit + `pipelineFailure` in UI; diagnostics codes in `src/diagnostics/codes.py` |

Aggregate for trials: P135 local `session-events.ndjson` + optional feedback JSON — see [`P135_TRIAL_FEEDBACK.md`](P135_TRIAL_FEEDBACK.md).

## 3. UX audit (desktop)

| Area | Check |
|------|--------|
| **Onboarding** | P131 hints: folder → build → preview → compare; dismissible, localized |
| **Build flow** | Clear failure vs success; API key / network hints in human summary |
| **Preview** | Embedded preview errors surface Output + fallback commands; Node/npm messaging |
| **Comparison** | Prompt vs spec + Models reference table labeled as offline reference |

## 4. Blockers fixed in this pass (P137)

| Issue | Severity | Fix |
|-------|----------|-----|
| Successful **Build from prompt** switched to Run summary tab but **did not expand** the bottom panel | High — users miss success steps and next actions | `setBottomOpen(true)` on success path in `desktop/src/App.tsx` |
| Failure log said “see **Activity**” while UI focused **Run summary** for fixes | Medium — erodes trust in guidance | Localized `trial.log.pipelineFail` + use in Activity log line |
| **FAILURE_MODES.md** still referenced **Tk** / PyWebview for desktop | High — wrong product story | Section retitled to Electron; browser vs Electron clarified |
| Reliability hint text pointed only to Activity | Low | EN/TR: “Output or Activity” for full trace |

## 5. Not claimed as “fixed” here

- New automated tests for every failure class (existing CLI/desktop contract tests remain source of truth).
- Cross-vendor live comparison harness (still reference-only in Models tab per P136/P107).

## Related

- [`FAILURE_MODES.md`](FAILURE_MODES.md) · [`TRIAL_READINESS.md`](TRIAL_READINESS.md) · [`KNOWN_LIMITS.md`](KNOWN_LIMITS.md)  
- [`P135_TRIAL_FEEDBACK.md`](P135_TRIAL_FEEDBACK.md) · [`COMPARISON_REPORT.md`](COMPARISON_REPORT.md)

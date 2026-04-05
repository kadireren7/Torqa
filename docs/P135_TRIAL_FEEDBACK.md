# P135 — Trial feedback and local telemetry

**Scope:** TORQA Desktop only. This document explains what the app records **on disk**, where files live, and how maintainers can review them during trials.

## What is collected (automatic, local only)

The desktop app appends **one JSON line per event** to a session log. **Nothing is uploaded** by the app; there is no background sync or hidden telemetry channel.

| Event type | Meaning |
|------------|---------|
| `build_attempt` / `build_success` / `build_failure` | Classic validate/build from `.tq` |
| `app_pipeline_attempt` / `app_pipeline_success` / `app_pipeline_failure` | Prompt → app pipeline |
| `generate_tq_attempt` / `generate_tq_success` / `generate_tq_failure` | Generate `.tq` from prompt |
| `validate_auto_repair_attempt` | One-shot auto-fix after validate failure |
| `preview_embedded` | User opened or received an embedded preview |
| `preview_retry` | User retried starting preview |
| `preview_external_browser` | User opened preview URL in system browser |
| `comparison_panel_opened` | User opened prompt-vs-spec comparison or the Models comparison tab (`detail.context` distinguishes) |
| `llm_retry_observed` | Core reported repair/retry counts (`detail.count`) |

Each line includes ISO timestamp, **session id** (one per app launch), schema version, and optional **sanitized** detail (short strings, numbers, booleans only).

## Optional user feedback (explicit opt-in to save)

In the **Feedback** sidebar tab, users can answer:

- **Was this useful?** (yes / not really / skip)
- **What failed?** (optional category)
- **Freeform comment** (optional)

Clicking **Save feedback to file** writes a **single JSON file** under the feedback directory. Users can attach or send that file to their trial contact. **No feedback is sent automatically.**

## Where files are stored

Under the Electron **userData** directory:

- **Root:** `<userData>/trial-data/`
- **Events log:** `session-events.ndjson` (append-only)
- **Feedback exports:** `feedback/feedback-<timestamp>.json`

The exact path depends on the OS (e.g. `%APPDATA%\TORQA Desktop` on Windows, then `trial-data` under that tree). The **Feedback** tab lists the resolved **data folder**, **session log file**, and **feedback export directory** when running in Electron.

## Privacy and principles

- **Transparent:** The UI states that events are local-only; this doc is the reference.
- **Minimal:** Allowlisted event types; detail fields are capped and sanitized in the main process.
- **No surveillance:** No keystroke logging, no workspace contents, no API keys in these files.
- **User control:** Users choose whether to save feedback; they can delete `trial-data` manually.

## How maintainers review data

1. **During a trial session:** Ask participants to note the path shown in the Feedback tab (or browse userData as appropriate for your support process).
2. **Aggregates:** Parse `session-events.ndjson` (JSON Lines) — group by `sessionId` or `type` for funnel-style views (attempts, failures, previews, comparisons).
3. **Qualitative:** Read `feedback/*.json` for structured + freeform comments; join to the same `sessionId` as events when correlating.
4. **Iteration:** Use failure categories and event counts to prioritize fixes; use comments for wording and UX issues.

## Related

- Desktop packaging and trial QA: [`P133_DESKTOP_DISTRIBUTION.md`](P133_DESKTOP_DISTRIBUTION.md)
- Product surfaces: [`P73_PRODUCT_SURFACES.md`](P73_PRODUCT_SURFACES.md)

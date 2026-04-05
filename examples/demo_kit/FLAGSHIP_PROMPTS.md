# Flagship prompts & outputs (demo kit)

**Benchmark ID:** `p31_login_dashboard_shell_v1`  
**Canonical `.tq` surface:** [`examples/benchmark_flagship/app.tq`](../benchmark_flagship/app.tq)  
**NL comparator spec (frozen task for baselines):** [`examples/benchmark_flagship/BENCHMARK_TASK.md`](../benchmark_flagship/BENCHMARK_TASK.md)

---

## 1. Full product intent (for slides or voice-over)

Use the **Product intent** section from `BENCHMARK_TASK.md` verbatim when you need a stable NL comparator. Summary:

- Member **login** with username, password, and **client IP** (audit display in copy).
- Reject when account is **locked**; show that in UI messaging.
- On success: **session** + **successful login audit** (username + IP).
- **Multi-section shell:** overview, sign-in area, post-sign-in / dashboard-style section.
- **Stack:** local-preview SPA (e.g. Vite + React), `npm install` + `npm run dev` documented.

---

## 2. Short “video prompt” (one paragraph)

> Build a small member login experience: username, password, and IP for audit. Block locked accounts. On success, create a session and record a successful login audit. The UI should have overview, sign-in, and a dashboard-style area after sign-in. Use a Vite + React–style SPA with local dev instructions.

Use this with **TORQA Desktop** prompt strip or:

```bash
echo "<paste paragraph>" | torqa --json app --workspace <dir> --prompt-stdin
```

(Exact CLI flags match your install; see [`docs/TRY_TORQA.md`](../../docs/TRY_TORQA.md).)

---

## 3. Ultra-short on-screen caption (≤ 140 characters)

> Login shell: session + audit + locked account handling; overview / sign-in / dashboard sections; Vite + React preview.

---

## 4. Flagship outputs (what to show)

| Artifact | Location / how produced |
|----------|-------------------------|
| **Intent surface** | `examples/benchmark_flagship/app.tq` (~20 lines of intent) |
| **Materialized tree** | Run `torqa build examples/benchmark_flagship/app.tq` → default `generated_out/generated/` (see [`expected_output_summary.json`](../benchmark_flagship/expected_output_summary.json) for required paths) |
| **Web preview** | `generated_out/generated/webapp/` → `npm install` && `npm run dev` |
| **Compression metrics (checked in)** | `examples/benchmark_flagship/compression_baseline_report.json` |
| **Portable metrics snapshot** | [`assets/snapshots/flagship_compression_metrics.json`](assets/snapshots/flagship_compression_metrics.json) (regenerate with `python scripts/sync_demo_kit_assets.py`) |

---

## 5. Honest framing (read before recording)

- The flagship path proves **checkable intent → validated IR → projected webapp tree** and **measured NL vs `.tq` compression** for this benchmark — not “any website from any sentence.”  
- See [`PROOF_NARRATIVE.md`](PROOF_NARRATIVE.md) and [`docs/KNOWN_LIMITS.md`](../../docs/KNOWN_LIMITS.md).

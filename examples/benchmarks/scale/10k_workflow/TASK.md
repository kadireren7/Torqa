# Scale tier: ~10K-token intent equivalent

This file is the **human-readable header** for the scenario. The benchmark **does not** store a multi‑thousand‑line spec on disk.

At report time, `torqa-token-proof --scale` **synthesizes** the measured natural-language body by repeating a shared structured pattern from `examples/benchmarks/scale/_shared/nl_repeat_unit.md` until the UTF‑8÷4 token estimate reaches at least `target_prompt_tokens_floor` in `scale_target.json`.

The paired `.tq` surface remains a **minimal validated** workflow (same semantics family as smaller token-proof scenarios).

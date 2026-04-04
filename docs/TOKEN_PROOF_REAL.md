# Token proof — real tokenizer & cost (P79)

This report complements the legacy **UTF-8÷4 estimator** used in [`TOKEN_PROOF.md`](TOKEN_PROOF.md) with **offline BPE token counts** (via **tiktoken** `cl100k_base` when installed) and a small **illustrative cost model**.

## Reproduce

```bash
pip install -e ".[dev]"   # includes tiktoken
torqa-token-proof-real
# or: python -m src.benchmarks.token_proof_real_cli
```

Output: [`reports/token_proof_real.json`](../reports/token_proof_real.json)

Optional custom rates (USD per 1K tokens):

```bash
echo '{"input_cost_per_1k": 0.001, "output_cost_per_1k": 0.005}' > /tmp/cm.json
python -m src.benchmarks.token_proof_real_cli --cost-model-json /tmp/cm.json
```

## Estimator vs real tokenizer

| Aspect | Standard token proof | This report (`*_real`) |
|--------|----------------------|-------------------------|
| Counter | `utf8_bytes_div_4_v1` | `tiktoken` `cl100k_base` (or **fallback** to the same estimator if tiktoken is missing) |
| Intent | Stable, cheap, comparable everywhere | Closer to **OpenAI-style** English+code tokenization for many models |
| Determinism | Yes | Yes (bundled tables; **no network**) |

**Typical gap:** BPE splits words and punctuation differently from ÷4; prose often has **more** real tokens than ÷4 for the same bytes, but the **ratio** between a long NL spec and a short `.tq` is usually **directionally similar**. The report includes **`estimator_vs_real_diff`** (mean deltas and mean `real/est` ratios per field).

If `tokenizer_backend_id` is `utf8_bytes_div_4_v1_fallback`, real counts **match** the legacy estimator by design — install **tiktoken** to see a non-trivial comparison.

## Cost fields (illustrative only)

Default **`cost_model`** in JSON uses placeholder **USD per 1K** input/output tokens so you can reason about **relative** savings. **Replace** with your provider’s list price; TORQA does **not** call any billing API.

For each passing scenario:

- **`prompt_cost`**, **`baseline_cost`**, **`torqa_cost`** — priced as **input** using `input_cost_per_1k`.
- **`output_tokens_real`** — **0** for this static benchmark (no generated completion is measured); **`output_cost`** is therefore 0 unless you add synthetic output later.
- **`combined_nl_path_cost_real`** — `prompt_cost + baseline_cost` (fat NL + baseline stub in context).
- **`torqa_path_cost_real`** — cost of the `.tq` surface as input.
- **`cost_reduction_percent`** — \((\text{combined\_nl} - \text{torqa}) / \text{combined\_nl} \times 100\) when comparing “carry NL+code” vs “carry `.tq`”.

**Interpretation:** This is a **scenario-bound** illustration of how much **input context cost** shrinks when the validated surface is compact — not a guarantee for every model or price sheet.

## Constraints honored

- **No external API calls** — tokenizer data is local.
- **Offline** after install.
- **Deterministic** for a fixed tiktoken version + encoding.

## Related

- Standard proof: `torqa-token-proof` → `reports/token_proof.json`
- Scale synthetic suite: [`TOKEN_PROOF_SCALE.md`](TOKEN_PROOF_SCALE.md)
- Estimator definition: [`BENCHMARK_COMPRESSION.md`](BENCHMARK_COMPRESSION.md)

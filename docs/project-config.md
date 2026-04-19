# Project config (`torqa.toml`)

Optional **project-level defaults** live in **`torqa.toml`** at the repository root (or any ancestor directory of the file or path you pass to the CLI). Torqa searches **upward** from:

- the parent directory of a **`FILE`** argument (`validate`, `check`, `doctor`, `explain`), or  
- the directory of a **`PATH`** argument (`scan`, `report`), or the file’s parent if `PATH` is a single file.

If no `torqa.toml` is found, built-in defaults apply (same behavior as before this file existed).

## Keys

Use a **`[torqa]`** table, or place these keys at the **top level** of the file. If `[torqa]` is present, only that table is read for supported keys (other top-level keys are ignored for Torqa).

| Key | Type | Built-in default | Description |
|-----|------|------------------|-------------|
| `profile` | string | `default` | One of `default`, `strict`, `review-heavy`. Used when `--profile` is omitted. |
| `fail_on_warning` | boolean | `false` | If `true`, commands that normally exit **0** when policy passes will exit **1** when there are **semantic** or **policy** warnings (see below). CLI `--fail-on-warning` / `--no-fail-on-warning` overrides this when passed. |
| `report_format` | string | `html` | `html` or `md`. Used when `torqa report` is run **without** `--format`. |

Invalid values (e.g. unknown `profile` or `report_format`) cause the CLI to exit **2** with a clear error.

## Example

```toml
[torqa]
profile = "strict"
fail_on_warning = true
report_format = "md"
```

## `fail_on_warning` behavior

When enabled (config or `--fail-on-warning`), these commands treat **non-empty** semantic or policy warning lists like a failure for **exit status** only (output is still printed):

- `torqa validate`, `torqa check`, `torqa doctor`, `torqa explain`
- `torqa scan`, `torqa report`

Typical sources of policy warnings include, for example, **more than five transitions** while metadata is otherwise valid (see [Trust policies](trust-policies.md)). The reference **`.tq`** surface only emits a small fixed flow, so counts above five usually appear in **bundle JSON** or other IR producers—not by repeating lines in `.tq` (the parser rejects duplicate or unsupported flow steps).

## CI

In pipelines, commit **`torqa.toml`** next to your specs so local runs and CI share the same profile and warning policy without repeating flags. Combine with [CI reports](ci-report.md) for Markdown/HTML artifacts.

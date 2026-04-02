# Using packages

**Prerequisites:** install CLI from [QUICKSTART.md](QUICKSTART.md). This page assumes `torqa` works.

Official IR package flow only. Copy **`examples/packages/minimal_auth`** + **`examples/package_demo`** when starting your own tree. After packages, see [FIRST_PROJECT.md](FIRST_PROJECT.md) for the bigger picture.

## Two different “reuse” mechanisms (do not mix the names)

| Name | What it is | When to use |
|------|------------|-------------|
| **TQ file include** | The `include "path.tq"` line in a `.tq` file (text splice before parse). | Share `.tq` headers/snippets inside `.tq` authoring only. |
| **IR package compose** | `torqa.package.json` + export JSON + `torqa.lock.json` + `compose.json` + `torqa compose`. | Reuse IR fragments and pin versions by fingerprint. |

If you want JSON IR reuse across apps, use **IR package compose**, not TQ file include.

---

## Canonical flow (5 steps)

Same example paths everywhere: package = `examples/packages/minimal_auth`, app = `examples/package_demo`.

### 1. Create the IR package

- Add **`torqa.package.json`** (`name`, `version`, `ir_version`, `exports` → paths under that folder).
- Add **export JSON** files with only **`inputs`**, **`preconditions`**, **`forbids`**, **`postconditions`** (what `torqa compose` merges).
- Use **`c_req_NNNN`** ids in fragments; each id must stay **unique** after merge with your primary bundle.

### 2. Pin the package (`torqa.lock.json`)

- Next to your app’s `compose.json`, add **`torqa.lock.json`** with `source: "path"` and `source_path` relative to **the lock file’s directory**.
- Run **`torqa package-fingerprint examples/packages/minimal_auth`** and copy the printed value into **`fingerprint`** for that package entry.
- **Whenever** you change the manifest or any export file, run fingerprint again and update the lock (the pin is a content hash).

### 3. Wire `compose.json`

- **`primary`**: your app IR bundle JSON path (relative to `compose.json` unless absolute).
- **`fragments`**: paths to package export JSON files.
- **`library_refs_from_lock`**: `true`, and **`lock`**: `"torqa.lock.json"` (or path relative to `compose.json`).

### 4. Compose

```bash
torqa compose examples/package_demo/compose.json --out examples/package_demo/composed_bundle.json
```

### 5. Validate and build

```bash
torqa validate examples/package_demo/composed_bundle.json
torqa build examples/package_demo/composed_bundle.json --out ./generated_out
```

**Optional:** `torqa vendor --lock examples/package_demo/torqa.lock.json` copies pinned trees under `.torqa/deps` next to the lock (default layout).

---

## Sharing packages (other machines / repos)

Minimal registry and `ref:` lock forms: **[PACKAGE_DISTRIBUTION.md](PACKAGE_DISTRIBUTION.md)** (`torqa package publish | fetch | list`).

## Not covered here

Multi-package demos under `examples/multi_package_app/` and `packages/torqa-pkg-*` follow the **same** steps with more `fragments` and lock entries; start from the canonical pair above, then add entries.

# Package distribution (minimal)

**Prerequisites:** [QUICKSTART.md](QUICKSTART.md) (CLI install). IR packages overview: [USING_PACKAGES.md](USING_PACKAGES.md).

Single pinned version per lock line; **fingerprint stays the source of truth**. No semver ranges, no resolver.

## Concepts

| Piece | Role |
|--------|------|
| **Package directory** | `torqa.package.json` + `exports/` (same as local workflow). |
| **Artifact** | `.tgz` of package **root files** (manifest at archive root), produced by `torqa package publish`. |
| **Registry** | Directory containing `torqa-registry.json` + `.tgz` files (or index URL pointing at artifacts). |

## Lock reference (`ref`)

One string per package entry (optional alternative to legacy `source` + `source_path`):

| Form | Meaning |
|------|---------|
| `path:REL_OR_ABS` | Directory tree (same as before). |
| `file:REL_OR_ABS.tgz` | Local tarball (layout as after publish). |
| `https://…` or `http://…` | URL to a tarball. |

Example lock snippet after fetch:

```json
{
  "packages": [
    {
      "name": "torqa/minimal-auth",
      "version": "1.0.0",
      "fingerprint": "sha256:…",
      "ref": "path:.torqa/deps/torqa-minimal-auth-1.0.0"
    }
  ]
}
```

## Commands

```bash
# 1) Publish into a local registry folder
torqa package publish examples/packages/minimal_auth --registry ./registry

# 2) List what is in the index
torqa package list --registry ./registry

# 3) Fetch into a project-owned directory (then point lock ref:path:… at it, or vendor)
torqa package fetch torqa/minimal-auth 1.0.0 --registry ./registry --out ./fetched

# 4) Vendor still materializes lock entries (path / file / URL ref supported)
torqa vendor --lock torqa.lock.json
```

Remote index: pass `--registry https://example.com/path/torqa-registry.json`. Artifact entries may be relative filenames (resolved next to that URL) or absolute `https://…` URLs.

## Flow with compose

Unchanged: after packages are on disk (vendor or fetch), **`compose.json`** + **`torqa compose`** + **`build`**. See [USING_PACKAGES.md](USING_PACKAGES.md).

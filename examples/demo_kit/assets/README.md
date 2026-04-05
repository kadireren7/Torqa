# Demo kit assets (P138)

| Path | Use |
|------|-----|
| [`flow-desktop-proof.svg`](flow-desktop-proof.svg) | Video overlay / deck: desktop flow from folder to comparison |
| [`title-card-template.svg`](title-card-template.svg) | Chapter breaks; edit subtitle in Inkscape / Figma |
| [`website-hero-wireframe.svg`](website-hero-wireframe.svg) | Storyboard for marketing site + static proof block (not a pixel screenshot) |
| [`snapshots/`](snapshots/) | JSON excerpts — run `python scripts/sync_demo_kit_assets.py` to refresh |
| [`screenshots/CAPTURE_CHECKLIST.md`](screenshots/CAPTURE_CHECKLIST.md) | **Real** raster screenshots to capture from running apps |

**Raster policy:** Check polished `.png` / `.webp` captures into `screenshots/` only when they are **real** grabs (avoid fake UI bitmaps that mislead). Use SVGs here for generic diagrams.

**Export for video:** SVG → PNG at 1920×1080 via browser, Inkscape, or `resvg` / similar.

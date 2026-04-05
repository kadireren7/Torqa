# Screenshot & B-roll capture checklist (P138)

Export **PNG** or **WebP** at **1920×1080** (or 2560×1440 for crops). Name files with numeric prefixes for edit order.

## TORQA Desktop (`torqa-desktop`)

| # | Filename | What to show |
|---|----------|----------------|
| 01 | `desktop-home-folder.png` | Home / first screen with **Choose folder** visible |
| 02 | `desktop-workspace-tree.png` | Sidebar with `.tq` files after folder open |
| 03 | `desktop-prompt-strip.png` | Prompt mode, text pasted, provider strip |
| 04 | `desktop-activity-building.png` | Bottom panel **Activity** or busy state during app pipeline |
| 05 | `desktop-editor-tq.png` | Editor with generated `.tq` (syntax visible) |
| 06 | `desktop-preview-split.png` | Code + embedded **preview** split |
| 07 | `desktop-browser-login.png` | External browser on `localhost` showing login page (if not using embed) |
| 08 | `desktop-diagnostics.png` | **Diagnostics** or token / pipeline summary |
| 09 | `desktop-models-compare.png` | **Models** tab — reference comparison table |
| 10 | `desktop-p136-summary.png` | **Models** tab scrolled to P136 comparison summary strip |

**Tip:** Open **repo root** as workspace (or ensure `getPaths().repoRoot` resolves) so comparison JSON loads.

## Marketing website (`torqa-console` → `/`)

| # | Filename | What to show |
|---|----------|----------------|
| 11 | `website-hero.png` | Above the fold hero |
| 12 | `website-proof-widget.png` | Comparison / proof summary block (if present on page) |
| 13 | `website-footer-cta.png` | Links to Desktop / docs |

## Output preview (generated webapp)

| # | Filename | What to show |
|---|----------|----------------|
| 14 | `preview-landing.png` | Landing / overview section |
| 15 | `preview-login.png` | Login form + copy |
| 16 | `preview-dashboard.png` | Post-sign-in shell |

**Source tree:** after `torqa build examples/benchmark_flagship/app.tq` → `generated_out/generated/webapp/`.

## Post-processing

- Blur home paths and API keys.  
- Optional: subtle drop shadow + rounded rect in deck tool for consistency.  
- Keep **one** uncropped wide shot per scene for video keyframes.

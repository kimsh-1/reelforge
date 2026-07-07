# Design Presets

ReelForge presets are schema-valid `design-tokens.json` files for `vf compile --preset`. They keep the shared Pretendard font asset while translating each source system into ReelForge color, mood, subtitle, and font-role tokens.

## Catalog

| Preset | Preview | Best Use | Command |
|---|---|---|---|
| `linear` | Near-black `#010102`, charcoal surface ladder, sparse lavender-blue `#5e6ad2`, hairline borders. | Dark technical SaaS, product dashboards, premium developer tooling. | `node bin/vf compile <projectDir> --preset fixtures/presets/linear.json` |
| `linear-demo` | Linear base with slightly stronger glow and `subtitle.visible=false`. | Demo uplift renders where subtitles should not cover the frame. | `node bin/vf compile <projectDir> --preset fixtures/presets/linear-demo.json` |
| `vercel` | Near-white page, `#171717` ink CTA, 200-step gray feel, cyan/blue/magenta/amber mesh mood accents. | Minimal developer docs, infrastructure explainers, code-first dashboards. | `node bin/vf compile <projectDir> --preset fixtures/presets/vercel.json` |
| `stripe` | White/cool off-white canvas, indigo `#533afd`, deep navy text, cream/orange/lavender/ruby mesh accents. | Fintech, B2B SaaS landing reels, pricing or growth stories. | `node bin/vf compile <projectDir> --preset fixtures/presets/stripe.json` |
| `notion` | White workspace surface, deep navy hero panel, purple `#5645d4`, six pastel card tints plus bold yellow. | Docs, education, wiki/productivity, warm workspace narratives. | `node bin/vf compile <projectDir> --preset fixtures/presets/notion.json` |
| `apple` | Product-first white/parchment and near-black tile alternation with single Action Blue `#0066cc`. | Premium product showcase, keynote-style reels, low-density gallery scenes. | `node bin/vf compile <projectDir> --preset fixtures/presets/apple.json` |

## Contrast Notes

Measured WCAG contrast targets use normal text threshold `4.5:1`. Decorative mood accents may be used as gradients, borders, or glow; body/subtitle/CTA text pairs are the accessibility contracts.

| Preset | Primary Text | Subtitle Text | CTA / Action Text |
|---|---:|---:|---:|
| `linear` | `#f7f8f8` on `#010102` = `19.61:1` | `#f7f8f8` on `#0f1011` = `17.90:1` | `#ffffff` on `#5e6ad2` = `4.70:1` |
| `linear-demo` | `#f7f8f8` on `#010102` = `19.61:1` | subtitle hidden, token pair remains `17.90:1` | `#ffffff` on `#5e6ad2` = `4.70:1` |
| `vercel` | `#171717` on `#fafafa` = `17.18:1` | `#171717` on `#ffffff` = `17.93:1` | `#ffffff` on `#171717` = `17.93:1` |
| `stripe` | `#0d253d` on `#ffffff` = `15.57:1` | `#0d253d` on `#ffffff` = `15.57:1` | `#ffffff` on `#533afd` = `6.19:1` |
| `notion` | `#1a1a1a` on `#ffffff` = `17.40:1` | `#1a1a1a` on `#f6f5f4` = `15.98:1` | `#ffffff` on `#5645d4` = `6.57:1` |
| `apple` | `#1d1d1f` on `#ffffff` = `16.83:1` | `#1d1d1f` on `#f5f5f7` = `15.46:1` | `#ffffff` on `#0066cc` = `5.57:1` |

## Selection Guide

Use `linear` when the source brief says dark product, technical SaaS, engineering craft, or Linear-like UI. Use `linear-demo` for the same look when demo footage needs a cleaner frame without subtitle overlays.

Use `vercel` when the piece should read as minimal developer infrastructure: stark ink, crisp gray dividers, mono labels, and restrained mesh color at hero scale.

Use `stripe` for bright SaaS or fintech explainers where the story benefits from trust, numbers, pricing, and a strong indigo CTA.

Use `notion` for documentation, courses, wiki-like explainers, and workspace stories that need approachable pastel cards and a deep navy hero band.

Use `apple` for product-first presentations where the object should dominate: edge-to-edge tiles, very low chrome, and one blue action color.

## Studio And Skill Use

In Studio, choose the preset whose source design system matches the intended brand voice before recompiling the project. Studio edits should update scene specs or the selected preset path, then run the normal compile path; generated composition HTML stays read-only.

When using design-system skills, pick the closest source skill first, then map only contract-safe values into these presets. Do not add arbitrary top-level fields to a preset; `schemas/design-tokens.schema.json` only permits `version`, `presetId`, `colors`, `moods`, `subtitle`, and `fonts`.

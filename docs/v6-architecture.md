# ReelForge v6 Architecture — video-generation-first

Status: adopted 2026-07-16. This document is the canonical description of what ReelForge is
after the v6 re-architecture, what it deprecated from v5, and why.

## 1. Why v5 was rebuilt

v5 was a deck generator wearing a video shell. Authoring started from a data contract
(`scene_specs.json`: headline, items, values, layout) and the screen was whatever the chosen
block rendered from that data. However much the blocks were polished, the output inherited
the grammar of a presentation: one layout per scene, panel thinking, data-first composition.
Real-world evidence: a promo video authored scene-by-scene as free motion graphics
(direction first, data last) outperformed every pipeline demo on feel.

The conclusion that drives v6: direction (the feel) must be frozen first, and each scene must
be an authored motion-graphic, not a generated layout. The engine's job shrinks to what it is
genuinely good at — timing, tokens, subtitles, transitions, deterministic rendering, and
verification.

## 2. Core loop

```
brief (one line, plus optional music/media/copy sources)
  -> [1] Direction Freeze        direction/frame.md + copy.md + STORYBOARD.md   (user checkpoint)
  -> [2] Pilot Gate              one pilot scene authored, rendered, QC'd; pass recorded in direction/pilot.json
  -> [3] Scene Swarm             one worker per scene authors scenes-src/<sceneId>-free.html
  -> [4] Assemble                thin manifest scene_specs.json -> vf compile -> render-lint
  -> [5] Render                  headless Chrome deterministic seek render (serial queue)
  -> [6] Strip QC loop (<=2)     1fps strip machine checks + viewer judgment -> re-author failing scenes only
```

The pilot gate is physical, not procedural: `vf compile` refuses a project with 2+ free
scenes (RF-PILOT-001..003) until `direction/pilot.json` records a passed pilot
(`schemas/pilot-report.schema.json`).

Timing authority is audio metadata only: TTS duration for narrated scenes, beat grid for
music-driven pieces, silent mock audio for pure motion scenes. Scene specs never carry a
duration field.

## 3. Component map

| Component | Role in v6 | State |
|---|---|---|
| `skills/reelforge/SKILL.md` | the orchestration spine (Direction Freeze -> Strip QC) | rewritten |
| `layout:"free"` + `sourceHtml` | authored fragment mounted as a track-3 sub-composition; transport inlining + runtime-ready injection by the compiler | new in v6 |
| `src/compiler/*` | schema validation, token injection (`--rf-*` incl. surface ladder/hairline/success), scene wrapper, subtitles, transitions | kept, extended |
| `src/compiler/render-lint.mjs` | determinism gate: rejects fetch / Math.random / Date.now / performance.now / non-paused timelines across scenes and fragments | kept, extended |
| `fixtures/presets/*` (17) | color, mood escalation, subtitle and font tokens; contrast floors | reworked |
| `scripts/craft-contact-sheet.mjs` | per-scene 3-frame capture + blank/contrast/frozen-motion checks | new QC harness |
| audio pipeline (TTS/mock/bgm) | the only timing authority | kept |
| Studio (`vf studio`) | scene review and impact-classified edits (E1/E2/E3) | kept |
| `blocks/` (8 data blocks) | optional library for a genuinely quantitative scene; full-bleed, no card chrome | demoted to appendix |

## 4. Directory layout of a v6 project

```
<projectDir>/
  direction/frame.md          visual spine: preset, mood arc, chrome, typography rules
  direction/copy.md           frozen on-screen copy (polished before visuals)
  direction/STORYBOARD.md     scene table: id, duration target, intent, idiom, transition semantic
  scenes-src/<id>-free.html   authored fragments (the only scene source of truth)
  scene_specs.json            thin manifest (id, sourceHtml, altText, mood, transitions...)
  audio_meta.json             timing authority (TTS words or mock durations)
  assets/audio/               bgm.mp3, per-scene narration or silent mocks
  build/                      generated, read-only
  renders/                    draft/final mp4 + 1fps strip for QC
```

## 5. Fragment contract (what a scene worker must produce)

A full HTML document whose `<body>` holds one `<template>` containing `<style>`, one root
element with a unique `data-composition-id` (`free-<sceneId>`) and
`data-rf-fragment-version="1.0"` (the supported contract version, lint-enforced), and one `<script>` that
synchronously registers exactly one `gsap.timeline({paused:true})` at
`window.__timelines["<id>"]` and ends with `tl.seek(0)`.

- Colors only through `var(--rf-*, fallback)` so any preset re-renders the same scene.
- Living motion: CSS keyframes, `infinite alternate`, delay
  `calc(var(--rf-scene-start, 0s) + 1.2s)`, filter/opacity only.
- Entrance completes within 0.4s; count-ups within 1.2s.
- De-slide hard rule: no card frames, no panel-in-panel, no header/footer masters, no
  title-plus-bullets skeleton. A frame that reads as a slide fails QC.
- No wall-clock or randomness — enforced by render-lint, not convention.

## 6. Deprecations (v5 -> v6)

| v5 | v6 |
|---|---|
| Author `scene_specs.json` first (headline/items/values per scene) | Freeze direction first; specs are a thin assembly manifest |
| `layout` chooses one of 8 block renderers per scene | `layout:"free"` everywhere; blocks are an opt-in appendix (default zero per video) |
| Quality loop tuned block CSS | Quality loop re-authors failing scenes from their storyboard intent |
| Deck-shaped demos | Demos are motion-graphic pieces produced by the v6 loop itself |

The 8 blocks remain compilable and full-bleed (they no longer draw card chrome), but they
receive no further investment and never appear by default.

## 7. Verification stack

1. Schema + semantic gates at compile (`vf compile`, closed contracts).
2. render-lint determinism pass over every scene and fragment — each violation reports a
   stable code (`RF-FRAGMENT-001..015` / `RF-INDEX-001..002` / `RF-BUILD-001..002`) with a
   repair hint, stage, and retryable flag (`LINT_RULES` in `src/compiler/render-lint.mjs`).
3. Vendor pinning: GSAP is a sha256-verified local bundle (`vendor/gsap/3.14.2/`, staged to
   `build/vendor/`); remote script/link references are lint errors (RF-FRAGMENT-015) — same
   commit + same input + same vendor bundle = same frames.
4. Contact-sheet machine checks per scene (blank, contrast, frozen living-motion).
5. 1fps full strip of the draft render, judged as a viewer (never isolated stills):
   de-slide rule, no frozen 1.5s stretch, first 3 seconds must stop a feed scroll.
6. Failing scenes are re-authored individually; two failures escalate to the user.

## 8. Performance notes

Renders run serially per machine. On >=8GB machines the engine parallelizes by default; on
smaller boxes it clamps to one worker + software GL. Overrides:
`PRODUCER_LOW_MEMORY_MODE=false PRODUCER_MAX_WORKERS=3 PRODUCER_BROWSER_GPU_MODE=hardware`.
Measured: 42s / 1253 frames in ~6 min at 3 workers on a 7.7GB WSL2 box (vs 30+ min clamped).

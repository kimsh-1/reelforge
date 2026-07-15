---
name: reelforge
description: Author and run ReelForge motion-graphic video projects from a brief, script, or batch of briefs. Use when the user asks in Korean or English to make a video with ReelForge, including triggers such as "영상 만들어", "릴포지", "ReelForge", "브리프로 영상", "대본으로 영상", "쇼츠 만들어", "나레이션 영상", "faceless video", or "run the ReelForge pipeline".
---

# ReelForge

ReelForge turns one brief into a **full-bleed motion-graphic video**. The product is the
feel: kinetic typography, mood-driven color, living motion — never a slide deck. The skill's
core loop is **Direction Freeze -> Scene Swarm -> Assemble -> Render -> Strip QC**. Every
scene is an authored `layout:"free"` HTML fragment; the engine owns timing, subtitles,
transitions, tokens, and deterministic rendering.

Do not start from `scene_specs.json`. Data comes last; direction comes first.

## Step 0 — Brief

Collect only missing production facts, then move on:

- `audience` / `goal`: who watches, what should change after watching.
- `duration target` and `format`: shorts, demo, explainer, report.
- `tone`: one or two mood words — this drives preset choice and mood escalation.
- `assets`: brand, product, screenshots, music track, whether generated images are allowed.
- `constraints`: language, claims to avoid, must-include terms.

When underspecified, propose defaults and proceed (confirm in checkpoint at Step 1).

## Step 1 — Direction Freeze (the stage that decides quality)

Produce three small artifacts under `<projectDir>/direction/` and freeze them before any
scene is authored. This is a user checkpoint: show the summary, then continue.

1. **`frame.md`** — the visual spine: chosen preset (one of the 16-video-preset catalog —
   read `references/design-direction.md` for the selection tree, `docs/design-presets.md`
   for contrast tables; do not invent a palette when a preset fits), mood escalation arc
   (which scenes flash hot accents, where the scarce success color lands), recurring chrome,
   typography scale rules.
2. **`copy.md`** — every on-screen line, polished before visuals (gn-voice-style pass).
   Sellable Korean headlines of 12 characters or fewer; concrete nouns, numbers, contrast,
   payoff. Model lines: `한 줄만 던져`, `누르면 렌더`, `키도 0, 돈도 0`, `말 대신 렌더`.
3. **`STORYBOARD.md`** — the scene table: `sceneId`, duration target (2–4.5s each), the
   one-line intent ("what must the viewer feel"), scene idiom (kinetic typo / image+motion /
   data moment / CTA), and the transition semantic into the next scene (shared-object
   continuity, hard cut for new section, dissolve for time passing).

**Timing authority**: if the project has music, analyze it first and snap scene boundaries
to the beat grid (`audiomap.json`, music-to-video interop). Otherwise scene durations come
from audio metadata — for silent/music-only scenes use mock narration (see Step 3).

## Step 2 — Scene Swarm

Dispatch **one worker per scene**, in parallel. Each worker authors exactly one fragment at
`<projectDir>/scenes-src/<sceneId>-free.html` and touches nothing else. Worker context:

```text
PROJECT_DIR, sceneId, its STORYBOARD row, direction/frame.md, direction/copy.md (frozen copy
for this scene), the fragment contract below, and one approved sibling fragment as the
house-style reference.
```

Run a **pilot scene first**, review it against the storyboard intent, correct the shared
brief once, then fan out the rest. Workers never run the CLI, never render, never edit
`scene_specs.json` or generated HTML.

**Fragment contract** (lint-enforced): a full HTML document whose `<body>` contains one
`<template>` with `<style>`, one root element carrying a unique `data-composition-id`
(use `free-<sceneId>`), and one `<script>` that synchronously registers exactly one
`gsap.timeline({paused:true})` at `window.__timelines["<that id>"]` and ends with
`tl.seek(0)`.

- Consume preset colors only through `var(--rf-*)` with fallbacks: `--rf-text`,
  `--rf-muted-text`, `--rf-accent`, `--rf-bg`, `--rf-surface-2`, `--rf-surface-3`,
  `--rf-hairline`, `--rf-hairline-strong`, `--rf-ink-subtle`, `--rf-ink-tertiary`,
  `--rf-accent-alt`, `--rf-on-accent`, `--rf-success`.
- Living motion: CSS keyframes with `infinite alternate`, delay
  `calc(var(--rf-scene-start, 0s) + 1.2s)`, `filter`/`opacity` only — visible change must
  survive a 1fps strip (frozen scenes fail QC).
- Entrance completes within 0.4s of scene start; count-ups finish within 1.2s.
- **De-slide hard rule**: no card frames, no panel-in-panel, no header/footer masters, no
  title+bullets skeleton. If a frame reads as a presentation slide, the scene fails.

## Step 3 — Assemble

`scene_specs.json` is a **thin manifest**, not an authoring surface. For each scene:
`sceneId`, `sceneNumber`, `layout:"free"`, `sourceHtml`, authored `altText`, `headline`
(display copy), `mood`, `reveal`, `emphasis`, `items: []`, `visual_kind`, `kenBurns`
(disabled unless image scene), `subtitleMode`, and narration fields. Root:
`version`, `projectId`, `scenes`, `transitions[]{from,to,type,duration}`.

- Narrated scene: `narration_tts` drives duration through TTS. Spell out symbols for Korean
  TTS (`37%` -> `삼십칠 퍼센트`).
- Silent/music-only scene: set `narration`/`narration_tts` to `" "`, generate mock audio of
  the target duration (`ffmpeg -f lavfi -i anullsrc=r=24000:cl=mono -t <dur> -q:a 9
  assets/audio/<sceneId>.mock.mp3`) and list it in `audio_meta.json` with
  `sourceHash` = sha256 of `" "` (`36a9e7f1c95b82ffb99743e0c5c4ce95d83c9a430aac59f84ef3cbfab6145068`).
- BGM: place `assets/audio/bgm.mp3`; the compiler wires it when any scene requests OST.

Compile and lint:

```bash
node bin/vf compile <projectDir> --preset fixtures/presets/<preset>.json
```

Compilation fails loudly on schema violations; render-lint rejects `fetch()`,
`Math.random()`, `Date.now()`, `performance.now()`, and non-paused timelines in every
composition fragment. A free scene with a missing/invalid fragment degrades to
`headline_only` with a `free-missing-source`/`free-missing`/`free-invalid` warning — treat
any of those warnings as a build failure and fix the fragment.

## Step 4 — Render

Render serially (one render at a time per machine). On capable machines raise throughput:

```bash
cd <projectDir>/build
PRODUCER_LOW_MEMORY_MODE=false PRODUCER_MAX_WORKERS=3 PRODUCER_BROWSER_GPU_MODE=hardware \
  npx hyperframes render . --workers 3 --quality draft -o ../renders/draft.mp4
```

Measured reference: 42s / 1253 frames ≈ 6 min at 3 workers (vs 30+ min clamped). On a
sub-8GB box the engine defaults to 1 worker + software GL; the env overrides above lift the
clamp — watch available RAM and fall back to `--workers 2` if pressured. Kill stray
`chrome-headless` processes between renders. Use `--quality high` only for the final export.

## Step 5 — Strip QC Loop (max 2 rounds)

1. Machine pass: `node scripts/craft-contact-sheet.mjs` for per-scene checks, or build a
   1fps strip of the draft (`ffmpeg -i draft.mp4 -vf "fps=1,scale=480:-1" strip/f%02d.png`)
   and tile it. Blank frames, low contrast, and frozen motion (no pixel change between
   consecutive strip frames after entrance) are automatic failures.
2. Viewer pass on the full strip — never judge from isolated stills: de-slide hard rule,
   no 1.5s stretch that feels frozen, first 3 seconds must stop a feed scroll, generated
   images actually appear in-frame, small labels readable at mobile size.
3. Re-dispatch **only the failing scenes** with the failure reason appended to their brief.
   Two failed rounds on the same scene → escalate to the user with the strip.

Verify the pipeline report when using the full pipeline:

```bash
node bin/vf pipeline run <projectDir> --profile mock
node bin/vf verify-report <projectDir>/reports/pipeline-gate-report.json
```

## Studio Edit Loop

```bash
node bin/vf studio <projectDir> --port <port>
```

- `E1` presentation-field edits (headline, mood, altText, subtitleMode): save, recompile, preview.
- `E2` `narration_tts` changes: re-run TTS for affected scenes, then full compile (global timing shifts).
- `E3` scene order/insert/delete/transition changes: full compile and final render.
- Fragment edits (`scenes-src/*.html`) recompile like `E1` but re-run the strip QC for that scene.

Preview is for local checks; final quality comes from the full render path.

## Hard prohibitions

- Do not author per-scene `duration` fields — timing derives from audio metadata only.
- Do not edit generated HTML under `build/` as source; fragments in `scenes-src/` are the source.
- Do not add unknown keys to `scene_specs.json` — contracts are closed.
- Do not edit schemas as part of video authoring.
- Do not put motion, chrome, or scrims in `scene_specs` — free-scene motion lives only in
  its fragment; timing, subtitles, transitions, tokens, and lint stay engine-owned.

## Appendix — optional data blocks

Eight legacy data-block layouts (`bar`, `pie`, `line`, `list`, `numbered`, `statistic`,
`compare`, `quote`) remain available as an **optional library** for a scene carrying real
quantitative data (they render full-bleed, no card chrome; `values`+`unit` required for
`bar`/`pie`/`line`/`statistic`). Default is zero block scenes per video; use one only when
authoring the same data moment as a free fragment is clearly worse. `headline_only` remains
schema-valid for bare title cards. The eight-block golden fixture
(`fixtures/golden-specs/full-8types/`) is a compile smoke path, not a video-authoring model.

## References

- `references/scene-authoring.md` — fragment contract details and manifest field reference.
- `references/design-direction.md` — preset selection tree, free-scene motion grammar, mood escalation.
- `references/codex-runner.md` — batch jobs, parallel scene-swarm production, image runner handoff.

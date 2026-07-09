---
name: reelforge
description: Author and run ReelForge narration-video projects from a brief, script, or batch of briefs. Use when the user asks in Korean or English to make a video with ReelForge, including triggers such as "영상 만들어", "릴포지", "ReelForge", "브리프로 영상", "대본으로 영상", "쇼츠 만들어", "나레이션 영상", "faceless video", or "run the ReelForge pipeline".
---

# ReelForge

Use this skill to turn a brief into a valid ReelForge `scene_specs.json`, run the pipeline, check gates, and guide Studio edits. ReelForge's authoring boundary is `scene_specs.json`; generated composition HTML is a read-only build artifact.

For production work, follow **Brief Interview -> Authoring Workflow -> Pipeline And Gate -> Studio Edit Loop**. Quick Start is only a fixture smoke path.

## Quick Start

1. Create or choose a project directory under an ext4 path and seed it from the full eight-layout fixture:

```bash
PROJECT_DIR=~/reelforge-full8
mkdir -p "$PROJECT_DIR"
cp fixtures/golden-specs/full-8types/scene_specs.json "$PROJECT_DIR/scene_specs.json"
```

2. Treat `fixtures/golden-specs/full-8types/scene_specs.json` as the quickest complete example of all eight primary scene layouts: `bar`, `pie`, `line`, `list`, `numbered`, `statistic`, `compare`, `quote`.
3. Validate `scene_specs.json` through the write path:

```bash
node bin/vf write "$PROJECT_DIR/scene_specs.json" --project-root "$PROJECT_DIR" --schema scene-specs < "$PROJECT_DIR/scene_specs.json"
```

4. Run the local pipeline:

```bash
node bin/vf pipeline run "$PROJECT_DIR" --profile mock
```

Use `--profile real` only when real TTS/image generation is desired. For generated images, the real profile may stop with `WAIT` until PNG results are written under `assets/images/runner/results`.

5. Verify the project report:

```bash
node bin/vf verify-report "$PROJECT_DIR/reports/pipeline-gate-report.json"
```

6. Open Studio for local review and edits:

```bash
node bin/vf studio "$PROJECT_DIR" --port 4317
```

## Brief Interview

First ask only for missing production facts. Force the answer into this pattern:

```text
Act as a <role> specialist. Design my video: audience, offer/message, structure, visual style.
```

For Korean users, keep the same structure:

```text
<역할> 전문가로 행동해. 영상 설계를 확정해: 대상, 핵심 메시지, 장면 구조, 비주얼 스타일.
```

Collect these fields before authoring:

- `audience`: who must understand or buy in.
- `goal`: what should change after watching.
- `duration target`: rough total length, not a JSON field.
- `format`: desired output context such as shorts, demo, explainer, report.
- `tone`: one or two mood words.
- `assets`: brand, product, source data, screenshots, or whether generated images are allowed.
- `constraints`: language, claims to avoid, must-include terms, delivery path.

When the brief is underspecified, propose defaults and ask for confirmation. For agency/batch work, keep a reusable brand/tone block and vary only the message and scene plan per video.

## Authoring Workflow

Work in this order; do not jump straight from brief to JSON:

1. **Copy polish**: rewrite all on-screen copy with a gn-voice-style pass before visual authoring. No empty placeholders, raw English labels, fixture text, or dummy copy. Target sellable Korean headlines of 12 characters or fewer; prefer concrete nouns, numbers, contrast, and a payoff. Good model lines: `한 줄만 던져`, `빈 칸만 되묻기`, `누르면 렌더`, `키도 0, 돈도 0`, `말 대신 렌더`.
2. **Design selection**: choose one preset from the 비디오 전용 16종 카탈로그 + fixture/demo 변형 3종(총 19파일), then keep it stable for the project. Read `references/design-direction.md` for the brief-type selection tree and consult `docs/design-presets.md` for the full preset catalog and contrast constraints. Do not invent a custom look when a catalog preset fits.
3. **Step 1 content**: produce the narrative arc, scene count, `sceneId`, `sceneNumber`, polished `headline`, `narration`, `narration_tts`, `items`, `values`, `unit`, and `source`.
4. **Step 2 visuals**: assign `layout`, `mood`, `reveal`, `emphasis`, `visual_kind`, optional `imageAsset`, `kenBurns`, `subtitleMode`, authored `altText`, and `transitions`.
5. **Viewer QC**: after render, run machine checks and inspect frames as a viewer. Reject if any 1.5s stretch feels frozen, generated images are absent from the actual frame, headline contrast is weak, or the first three seconds would not stop a feed scroll.

Every scene must include authored `altText`. Do not infer it from narration and do not leave it for a later pass.

Primary layout selection:

- `bar`: compare ranked quantities.
- `pie`: show part-to-whole shares that sum cleanly.
- `line`: show a sequence over time.
- `list`: show checklist, bullets, status, or grouped facts.
- `numbered`: show ordered steps or priorities.
- `statistic`: make one key number dominate.
- `compare`: show before/after, A/B, old/new, or tradeoffs.
- `quote`: show a cited phrase, user voice, testimonial, or insight.

`headline_only` is schema-valid for title or closing cards, but prefer the eight primary layouts when the scene carries substantive content.

## Contract Rules

`scene_specs.json` must contain:

- Root: `version`, `projectId`, `scenes`, `transitions`.
- Each scene: `sceneId`, `sceneNumber`, `narration`, `narration_tts`, `altText`, `layout`, `mood`, `reveal`, `emphasis`, `headline`, `items`, `source`, `visual_kind`, `kenBurns`, `subtitleMode`.
- `values` and `unit` are required only for `bar`, `pie`, `line`, and `statistic`; other layouts may include them only when the visible copy needs them.
- Scene IDs: stable `s01`, `s02`, ... keys. Do not reuse an ID for a different scene.
- Transitions: edges only, `transitions[]{from,to,type,duration}`.

Hard prohibitions:

- Do not add `duration` inside a scene. Scene timing is derived from `narration_tts` through TTS/audio metadata and compiler frame quantization.
- Do not edit generated composition HTML or files under `build/` as source.
- Do not write selected image paths into `scene_specs`; selected assets belong to `image-manifest.json` and `versions.json`.
- Do not use extra fields. Contracts are closed and reject unknown keys.
- Do not make `mood.speed` or visual pacing imply audio duration changes.
- Do not edit schemas as part of video authoring.
- Do not author per-scene motion timelines, mood badges, chrome, or scrim overlays in `scene_specs`. The renderer blocks already own the three-stage motion: entrance, living/develop motion, and exit/hand-off. For living motion itself, authors choose only `mood` and `reveal`; use `layout`, `emphasis`, image fields, and transitions only for content structure and scene wiring.

Use `narration_tts` to control speech. Keep `narration` as display/editor copy when different. For Korean TTS, spell out symbols and compact numbers when needed: `37%` -> `삼십칠 퍼센트`, `184ms` -> `백팔십사 밀리초`.

Estimate scene duration only as an authoring sense check: one short Korean sentence is usually a compact scene; two clauses are medium; three or more clauses should usually split. Never persist that estimate as a scene field.

For image scenes, set `visual_kind`, `imageAsset.prompt`, `imageAsset.placement`, `kenBurns`, and `altText` so the asset is actually used. Image scrims are automatically applied by image-aware blocks; do not add extra schema fields or hand-edit HTML to darken images.

## Pipeline And Gate

Run:

```bash
node bin/vf pipeline run <projectDir> --profile mock
```

Expected graph:

```text
tts -> images -> compile -> render -> gate
```

The pipeline writes `audio_meta.json`, `image-manifest.json`, `versions.json`, `build/`, `out/main.mp4`, and a report under `reports/`. If `versions.json` is dirty, reconcile edits or rerun with `--force-dirty` only when intentional.

Check reports through the supervisor path:

```bash
node bin/vf verify-report <projectDir>/reports/pipeline-gate-report.json
node bin/vf gate list
```

For broader regression evidence use `npm run gate`; for expensive PoC execution use an explicit gate command with `--execute`.

For demo/showcase visual quality, run the full-profile visual QC gate:

```bash
node bin/vf gate demo-visual-qc --profile full
```

Current full-profile QC measures 씬 콘텐츠 29행 + 모션 88쌍 + 이미지 행 + supervisor 4 checks. Then inspect snapshot grids or rendered frames manually. The viewer standard is stricter than gate pass: no static holds, generated images must appear in-frame, small labels must remain readable, and contrast must pass the runtime `contrast >= 3` or central-edge rule at mobile feed size.

No-narration demos may rely on a project BGM file at `assets/audio/bgm.mp3`; the compiler wires that file automatically when any scene requests OST. Scenes with empty narration and no timed words emit no subtitle container.

## Studio Edit Loop

Start Studio with:

```bash
node bin/vf studio <projectDir> --port <port>
```

Guide edits by impact class:

- `E1`: presentation fields such as headline, layout, mood, reveal, altText, image prompt, or subtitle mode. Save `scene_specs.json`, recompile, preview.
- `E2`: `narration_tts` changes. Re-run TTS for affected scenes, then full compile because global timing can shift.
- `E3`: scene order, insertion, deletion, or transition changes. Full compile and final render.

Warn users that preview is for local visual checks; final export quality comes from the full render path.

## References

- Read `references/scene-authoring.md` when authoring or repairing `scene_specs.json`.
- Read `references/design-direction.md` before choosing a preset, motion strength, reveal palette, or scene emphasis.
- Read `references/codex-runner.md` for batch jobs, parallel brief-to-spec production, or real image runner handoff.

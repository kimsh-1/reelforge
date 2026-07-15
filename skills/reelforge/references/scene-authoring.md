# Scene Authoring Reference

Use this reference after Direction Freeze, when each Scene Swarm worker authors one
full-bleed ReelForge scene. The default video contains **zero data-block scenes**:
each scene is an authored `layout: "free"` HTML fragment. `scene_specs.json` is the
thin manifest that connects that fragment to engine-owned timing, subtitles, transitions,
tokens, and deterministic rendering.

Do not start from `scene_specs.json`. Direction lives in `direction/frame.md`,
`direction/copy.md`, and `direction/STORYBOARD.md`; visible composition lives in
`scenes-src/<sceneId>-free.html`. Generated HTML under `build/` is read-only.

## Free Scene Fragment Contract

Declare `layout: "free"` and a project-relative `sourceHtml` path. `sourceHtml` is
required if and only if the layout is `free`. A free scene has no visible
`items`/`values` content contract: the authored fragment owns every visible element.

Each Scene Swarm worker owns exactly one source file,
`<projectDir>/scenes-src/<sceneId>-free.html`, and nothing else. Author a full HTML
document whose `<body>` contains one `<template>`. The template contains a `<style>`,
one root element with a scene-unique `data-composition-id` (recommend
`free-<sceneId>`), and a `<script>`. Build exactly one synchronous paused GSAP timeline,
register it at `window.__timelines["<that id>"]`, and end with `tl.seek(0)`:

```html
<!doctype html>
<html lang="en">
  <body>
    <template>
      <style>
        .free-s01 {
          color: var(--rf-text, #f8f7f2);
          background: var(--rf-bg, #111216);
        }
      </style>
      <main class="free-s01" data-composition-id="free-s01">
        <!-- The free scene author owns all scene content. -->
      </main>
      <script>
        const tl = gsap.timeline({ paused: true });
        // Add seek-safe animation synchronously.
        window.__timelines["free-s01"] = tl;
        tl.seek(0);
      </script>
    </template>
  </body>
</html>
```

Consume preset colors with `var(--rf-*)` and a local fallback rather than hardcoding a
preset. Available tokens are `--rf-text`, `--rf-muted-text`, `--rf-accent`, `--rf-bg`,
`--rf-surface-2`, `--rf-surface-3`, `--rf-hairline`, `--rf-hairline-strong`,
`--rf-ink-subtle`, `--rf-ink-tertiary`, `--rf-accent-alt`, `--rf-on-accent`, and
`--rf-success`.

For living motion, use CSS keyframes with `infinite alternate`, delay them with
`calc(var(--rf-scene-start, 0s) + 1.2s)`, and animate only `filter` and `opacity`:

```css
@keyframes free-breathe {
  from { opacity: 0.72; filter: brightness(0.92); }
  to { opacity: 1; filter: brightness(1.08); }
}

.free-s01 .glow {
  animation: free-breathe 2.4s ease-in-out infinite alternate;
  animation-delay: calc(var(--rf-scene-start, 0s) + 1.2s);
}
```

Complete the entrance within 0.4 seconds of scene start; finish count-ups within 1.2
seconds. The loop must make a visible difference in a 1fps strip. Do not use card frames,
panel-in-panel, header/footer masters, or a title-plus-bullets skeleton. If the frame reads
as a presentation slide, it fails QC.

Render lint applies to every composition HTML file, including free fragments. Do not use
`Math.random()`, `Date.now()`, `performance.now()`, or `fetch()`; they break deterministic
seek renders or violate the runtime contract.

The compiler copies a valid fragment to `build/blocks/free/<sceneId>.html`, performs
transport inlining and runtime-ready injection, and mounts it as a sub-composition on track
3 of the generated scene wrapper. Scene timing, subtitles, transitions, `--rf-*` token
injection, Ken Burns, and render lint remain engine-owned. If `sourceHtml` is missing,
unavailable, or has no `data-composition-id`, compilation emits `free-missing-source`,
`free-missing`, or `free-invalid` respectively and degrades the scene to `headline_only`.
Treat any of those warnings as a build failure and repair the fragment.

## Thin Manifest Field Reference

`scene_specs.json` connects frozen direction and authored fragments; it is not a layout
authoring surface. The root requires `version`, `projectId`, `scenes`, and
`transitions`. Every scene is closed-schema, and scene duration is never authored here:
audio metadata is the timing authority. Only transition edges own `duration`.

```json
{
  "sceneId": "s01",
  "sceneNumber": 1,
  "layout": "free",
  "sourceHtml": "scenes-src/s01-free.html",
  "narration": "사용자에게 보일 수 있는 문장입니다.",
  "narration_tts": "티 티 에스가 읽을 문장입니다.",
  "altText": "장면의 핵심 시각 정보를 설명한다.",
  "mood": "informative",
  "reveal": "count_up",
  "emphasis": "number",
  "headline": "핵심 수치",
  "items": [],
  "source": "brief:user",
  "visual_kind": "none",
  "kenBurns": {
    "enabled": false,
    "zoomFactor": 1,
    "zoomDirection": "in",
    "panDirection": "none"
  },
  "subtitleMode": "karaoke"
}
```

| Field | Free-scene use |
|---|---|
| `sceneId`, `sceneNumber` | Stable `sNN` identifier and scene order. The id also names the fragment and its unique composition id. |
| `layout`, `sourceHtml` | Set `layout` to `free`; point `sourceHtml` at the project-relative authored `.html` fragment. |
| `headline` | Display copy for engine fallback and metadata. Keep it polished even when the fragment stages it differently. |
| `narration`, `narration_tts` | On-screen/source narration and the speech-ready TTS string. `narration_tts` drives `audio_meta` and therefore duration. |
| `altText` | Required authored visual description; it is never inferred from narration. |
| `mood`, `reveal`, `emphasis` | Required direction metadata. Keep them aligned with the frozen storyboard and fragment intent; do not use them to author extra JSON motion. |
| `items` | Required by the schema even for free scenes. Use `[]`; it does not carry free-scene visible content. |
| `source` | Brief, citation, or provenance text. It is not automatic on-screen copy. |
| `visual_kind`, `imageAsset` | Declare visual intent. `generate_image` requires `imageAsset.prompt` and `imageAsset.placement`; only that image kind is currently wired into compiled image placement. `search_image`, `map_scene`, and `video` are reserved; `chart` and `none` are valid intents. |
| `kenBurns` | Use `enabled: true` only when an image or visual plate benefits from slow motion. Keep `zoomFactor >= 1`; `panDirection` is `none`, `left`, `right`, `up`, or `down`. |
| `subtitleMode` | Use `karaoke` when word timing matters and `keyword` when the scene is dense. |
| `caption`, `ost`, `overrides` | Optional contract fields. Do not use them to replace fragment composition; OST requests let the compiler wire BGM. |

Allowed `imageAsset.placement` values are `fullscreen`, `background`, `center`, `left`,
`right`, and `inline`. Selected image paths belong in `image-manifest.json` and
`versions.json`, not in `scene_specs.json`; do not add non-schema scrim fields or edit
generated HTML for image contrast.

## Silent Or Music-Only Scene Timing

Narrated scenes derive duration from TTS. For a silent or music-only free scene, set both
`narration` and `narration_tts` to a single space (`" "`), then generate mock silence at
the storyboard target duration:

```bash
ffmpeg -f lavfi -i anullsrc=r=24000:cl=mono -t <dur> -q:a 9 \
  assets/audio/<sceneId>.mock.mp3
```

Add the matching entry to `audio_meta.json`. `sourceHash` must be the SHA-256 of the
single-space `narration_tts` value:

```json
{
  "sceneId": "s01",
  "audioPath": "./assets/audio/s01.mock.mp3",
  "audioDurationSec": 4.0,
  "words": [],
  "sourceHash": "36a9e7f1c95b82ffb99743e0c5c4ce95d83c9a430aac59f84ef3cbfab6145068",
  "provider": "ffmpeg-anullsrc",
  "voice": "silent-mock"
}
```

The compiler verifies that every `audio_meta.scenes[].sourceHash` equals
`SHA-256(scene_specs.scenes[].narration_tts)`. If the hash changes, regenerate that
scene's speech/alignment, then recompile global timing. Place project BGM at
`assets/audio/bgm.mp3`; the compiler wires it when any scene requests OST.

## Mood And Reveal Pairing

| Intent | Mood | Reveal | Emphasis |
|---|---|---|---|
| Neutral explanation | `informative` | `stagger` or `fade_in` | `keyword` |
| Urgent next step | `urgent` | `stagger_then_flash` or `cascade` | `count` or `sequence` |
| Serious cost/risk | `somber` | `cascade` or `dramatic_pause` | `contrast` |
| Reflective user insight | `contemplative` | `typewriter` or `fade_in` | `quote` |
| Suspense before result | `suspense` | `split_reveal` or `dramatic_pause` | `contrast` |
| Win or growth | `triumphant` | `build_up` or `zoom_in` | `number` |
| Big metric | `dramatic` | `count_up` or `spotlight` | `number` |

Available reveals are `fade_in`, `stagger`, `stagger_then_flash`, `cascade`, `count_up`,
`typewriter`, `spotlight`, `split_reveal`, `zoom_in`, `build_up`, `dramatic_pause`, and
`parallel`.

## Transitions

Create scene-to-scene edges only:

```json
{ "from": "s01", "to": "s02", "type": "fade", "duration": 0.2 }
```

Allowed types are `cut`, `fade`, `crossfade`, `flash-cut`, `push-wipe`,
`push-wipe-left`, `push-wipe-right`, `zoom-punch`, `slide`, `wipe`, `slide_left`,
`slide_right`, `wipe_left`, and `wipe_right`. Use `cut` with `duration: 0`. For a normal
fade or crossfade, use 0.2–0.25 seconds by default. Do not attach transition fields to
scenes.

## Korean TTS Preprocessing

Author `narration_tts` for speech clarity, not typography.

- Expand symbols: `%` -> `퍼센트`, `ms` -> `밀리초`, `/` -> context-specific words.
- Spell numbers naturally when pronunciation matters: `37%` -> `삼십칠 퍼센트`, `184ms` -> `백팔십사 밀리초`.
- Remove invisible or control characters. Headlines reject zero-width characters.
- Avoid emoji, Markdown bullets, bracket labels like `[DRAFT]`, and dense punctuation in `narration_tts`.
- Keep each scene to one strong sentence when possible. Split long Korean explanations into multiple scenes instead of forcing long audio.
- Preserve `narration_tts` exactly once audio exists unless the change is intentional; it drives `audio_meta.scenes[].sourceHash`.

## Accessibility And Free-Scene QC

Write `altText` as a visual description of the authored frame. Name the dominant object,
the visible text or data that matters, and the spatial relation or motion when that carries
meaning. Do not copy narration verbatim unless it truly describes the visual.

Good: `검은 배경에서 흰색 '씬은 자유다' 글자가 화면을 가로질러 커지고, 뒤의 청록 빛이 천천히 밝아진다.`

Weak: `씬은 자유다.`

Before handoff, check the full 1fps strip rather than an isolated still:

- **Empty copy makes empty scenes**: polished, Korean-first visible copy must sell the beat without narration; placeholders, raw brief fragments, and fixture labels fail.
- **Generated images are not enough**: a prompt or runner result matters only when `visual_kind: "generate_image"`, `imageAsset.prompt`, `imageAsset.placement`, `kenBurns`, and `altText` are all wired. Never paste selected asset paths into `scene_specs`.
- **Hardcoded labels leak implementation**: never expose layout names, schema field names, fixture labels, or renderer defaults as visible copy.
- **Frozen motion fails**: the entrance and living loop must leave visible pixel change between consecutive strip frames after the entrance.
- **Korean clipping trap**: `line-height < 1` combined with `overflow: hidden` clips the top of Hangul glyphs. Keep Korean text containers at safe line-height or visible overflow.

## Appendix: optional data blocks

The eight legacy data blocks are an optional library, not the scene-authoring path. Default
is zero block scenes per video. Use one only for a real quantitative-data moment when an
authored free fragment is clearly worse; they must still read full-bleed, never as card
chrome. `headline_only` remains schema-valid for a bare title card. The full-eight fixture
at `fixtures/golden-specs/full-8types/` is a compile smoke path, not a video-authoring
model.

### Block Items And Values

This table applies to optional data blocks only, never to `free` scenes.

| Layout | Use for | `items` | `values` | Notes |
|---|---|---|---|---|
| `bar` | ranked quantities | category labels | numbers | 2-6 bars read best; include `unit`. |
| `pie` | share of whole | slice labels | numbers | Prefer percentages or clean proportions. |
| `line` | time sequence | time labels | numbers | Keep chronological order. |
| `list` | checklist/status | bullet labels | strings or numbers | Use short status values such as `진행`, `대기`, `완료`. |
| `numbered` | ordered steps | step labels | step numbers | Values should match the order. |
| `statistic` | one dominant metric | metric labels | numbers or short strings | Put the hero metric first. |
| `compare` | before/after or A/B | paired labels | paired values | Keep order symmetrical: old/new, old/new. |
| `quote` | cited voice or insight | source and quote | context strings | Keep the quote concise enough for one card. |

General limits: `items` and `values` max 40 entries; item text max 200 chars; string
values max 120 chars. Keep most production scenes far below those limits.

`values` and `unit` are contract-required only for `bar`, `pie`, `line`, and `statistic`.
For `list`, `numbered`, `compare`, `quote`, and `headline_only`, include them only when
the visible design needs explicit values.

### Block-Specific Guidance

Image-aware blocks apply their own readability scrim and living Ken Burns-style motion.
For data-block accessibility, mention the chart type and important values, the visible
comparison relation, or the quote/source treatment rather than repeating narration.

Good: `막대 차트가 검색 유입 6200명, 추천 유입 4800명, 광고 유입 3100명을 비교한다.`

Weak: `지난주 신규 가입은 검색 유입이 가장 컸다.`

Do not compensate for a dull block by inventing extra JSON fields or editing HTML. Use
better `mood`, `reveal`, `emphasis`, transition, or shorter copy so the block's built-in
entrance, living motion, and exit can work. Nested inline scenes may strip an inner root
`id`, so block roots should rely on classes or data attributes rather than a fragile inner
`#root`. A solo block render is not whole-render proof: compare at least one full-render
frame against the solo frame for changed blocks.

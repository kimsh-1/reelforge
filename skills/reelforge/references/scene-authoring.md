# Scene Authoring Reference

Use this reference when drafting or repairing ReelForge `scene_specs.json`.

## Scene Skeleton

Each scene is closed-schema and must use only contract fields:

```json
{
  "sceneId": "s01",
  "sceneNumber": 1,
  "narration": "사용자에게 보일 수 있는 문장입니다.",
  "narration_tts": "티 티 에스가 읽을 문장입니다.",
  "altText": "장면의 핵심 시각 정보를 설명한다.",
  "layout": "free",
  "sourceHtml": "scenes/s01.html",
  "mood": "informative",
  "reveal": "count_up",
  "emphasis": "number",
  "headline": "핵심 수치",
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

Never add `duration` to a scene. Only transition edges own `duration`.

## Free Scene Authoring Contract

`free` is the default scene idiom for ReelForge video generation: author a full-bleed motion graphic when the beat needs kinetic type, image-led motion, or promo-grade energy. The eight data blocks remain a recommended option when a scene carries real quantitative data.

Declare `layout: "free"` and a project-relative `sourceHtml` path. `sourceHtml` is required if and only if the layout is `free`. A free scene has no `items`/`values` content contract: the authored fragment owns all visible content.

The source file is a full HTML document whose `<body>` contains one `<template>` wrapper. The template contains a `<style>`, one root element with a scene-unique `data-composition-id` (recommend `free-<sceneId>`), and a `<script>`. Build exactly one synchronous paused GSAP timeline, register it at `window.__timelines["<that id>"]`, and end with `tl.seek(0)`:

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

Consume preset colors with `var(--rf-*)` and a local fallback rather than hardcoding a preset. Available tokens are `--rf-text`, `--rf-muted-text`, `--rf-accent`, `--rf-bg`, `--rf-surface-2`, `--rf-surface-3`, `--rf-hairline`, `--rf-hairline-strong`, `--rf-ink-subtle`, `--rf-ink-tertiary`, `--rf-accent-alt`, `--rf-on-accent`, and `--rf-success`.

For living motion, use CSS keyframes with `infinite alternate`, delay them with `calc(var(--rf-scene-start, 0s) + 1.2s)`, and animate only `filter` and `opacity`:

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

Render lint applies to every composition HTML file, including free fragments. Do not use `Math.random()`, `Date.now()`, `performance.now()`, or `fetch()`; they break deterministic seek renders or violate the runtime contract.

The compiler copies a valid fragment to `build/blocks/free/<sceneId>.html`, performs transport inlining and runtime-ready injection, and mounts it as a sub-composition on track 3 of the generated scene wrapper. Scene timing, subtitles, transitions, `--rf-*` token injection, Ken Burns, and render lint remain engine-owned, exactly as they do for block scenes. `narration_tts` and `audio_meta` still determine scene duration; use mock silence when a music-only free scene needs duration without narration.

If `sourceHtml` is missing, unavailable, or has no `data-composition-id`, compilation emits `free-missing-source`, `free-missing`, or `free-invalid` respectively and degrades the scene to `headline_only`.

## Block Items And Values

This table applies to data blocks only, not to `free` scenes.

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

General limits: `items` and `values` max 40 entries; item text max 200 chars; string values max 120 chars. Keep most production scenes far below those limits.

`values` and `unit` are contract-required only for `bar`, `pie`, `line`, and `statistic`. For `list`, `numbered`, `compare`, `quote`, and `headline_only`, include them only when the visible design needs explicit values.

## Visual Fields

Use `visual_kind` deliberately:

- `chart`: data-driven layouts such as `bar`, `pie`, `line`, or metric comparisons.
- `generate_image`: needs `imageAsset.prompt` and `imageAsset.placement`; the pipeline will create selected assets through `image-manifest.json` and `versions.json`. Currently only `generate_image` is wired into compiled image placement.
- `search_image`: reserved for stock/search-backed visuals; not wired into compiled image placement yet.
- `map_scene`: reserved for geographic scenes; not wired into compiled image placement yet.
- `video`: reserved for external clip placement; not wired into compiled image placement yet.
- `none`: text, chartless, or pure layout scenes.

Allowed `imageAsset.placement`: `fullscreen`, `background`, `center`, `left`, `right`, `inline`.

Use `kenBurns.enabled=true` only when an image or visual plate benefits from slow motion. Keep `zoomFactor >= 1`; use `panDirection` from `none`, `left`, `right`, `up`, `down`.

Image-aware blocks apply their own readability scrim and living Ken Burns-style motion. Author the prompt, placement, `kenBurns`, and `altText`; do not add non-schema scrim fields or edit generated HTML for image contrast.

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

Available reveals are `fade_in`, `stagger`, `stagger_then_flash`, `cascade`, `count_up`, `typewriter`, `spotlight`, `split_reveal`, `zoom_in`, `build_up`, `dramatic_pause`, and `parallel`.

## Transitions

Create scene-to-scene edges only:

```json
{ "from": "s01", "to": "s02", "type": "fade", "duration": 0.2 }
```

Allowed types: `cut`, `fade`, `crossfade`, `slide`, `wipe`, `slide_left`, `slide_right`, `wipe_left`, `wipe_right`.

Use `cut` with `duration: 0`. For other transitions, use 0.2-0.25 seconds by default. Do not attach transition fields to scenes.

## Korean TTS Preprocessing

Author `narration_tts` for speech clarity, not typography.

- Expand symbols: `%` -> `퍼센트`, `ms` -> `밀리초`, `/` -> context-specific words.
- Spell numbers naturally when pronunciation matters: `37%` -> `삼십칠 퍼센트`, `184ms` -> `백팔십사 밀리초`.
- Remove invisible or control characters. Headlines reject zero-width characters.
- Avoid emoji, Markdown bullets, bracket labels like `[DRAFT]`, and dense punctuation in `narration_tts`.
- Keep each scene to one strong sentence when possible. Split long Korean explanations into multiple scenes instead of forcing long audio.
- Preserve `narration_tts` exactly once audio exists unless the change is intentional; it drives `audio_meta.scenes[].sourceHash`.

Use `subtitleMode: "karaoke"` when word timing matters and `subtitleMode: "keyword"` when the scene is dense or list-like.

## Accessibility

Write `altText` as visual description:

- Mention chart type and the important values for data scenes.
- Mention layout and visible relation for comparison scenes.
- Mention quote/source treatment for quote scenes.
- Do not copy narration verbatim unless it truly describes the visual.

Good: `막대 차트가 검색 유입 6200명, 추천 유입 4800명, 광고 유입 3100명을 비교한다.`

Weak: `지난주 신규 가입은 검색 유입이 가장 컸다.`

## Round 1-3 Traps

These failures produced valid-looking renders but poor viewer results. Check them before every handoff:

- **Empty copy makes empty scenes**: schema-valid `headline`, `items`, or `values` can still be lifeless if they are placeholders, raw brief fragments, or English fixture labels. Run the copy polish step first; visible copy must be short, Korean-first when the video is Korean, and strong enough to sell the beat without narration.
- **Generated images are not enough**: an image prompt or runner result does not matter unless the scene actually wires `visual_kind: "generate_image"`, `imageAsset.prompt`, `imageAsset.placement`, `kenBurns`, and `altText`. Never paste selected asset paths into `scene_specs`; the manifest and versions files own selection.
- **Hardcoded labels leak implementation**: do not let layout names, schema field names, fixture labels, or renderer defaults become on-screen text. Author the displayed labels in `headline`, `items`, `values`, `unit`, and `source`; keep internal labels out of the frame.
- **Motion is already in the block**: do not compensate for a dull scene by inventing extra JSON fields or editing HTML. Pick a better `mood`, `reveal`, `emphasis`, transition, or shorter copy so the block's built-in entrance, living motion, and exit can work.
- **Nested inline roots can erase selectors**: nested inline scenes may strip the inner root `id`, which kills `#id` CSS and query selectors. Block roots should rely on classes or data attributes, not a fragile inner `#root`.
- **Solo render is not whole-render proof**: bugs that appear only in full composition are missed by rendering a scene alone. Always compare at least one full-render frame against the solo frame for changed blocks.
- **Korean clipping trap**: `line-height < 1` combined with `overflow: hidden` clips the top of Hangul glyphs. Keep Korean text containers at safe line-height or visible overflow.

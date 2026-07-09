# ReelForge Compiler

`vf compile <projectDir> [--format 16:9|9:16|1:1]` turns authored contracts into a self-contained HyperFrames build. The generated HTML is read-only; edits must go back through `scene_specs.json` or the design token preset and then recompile.

## Architecture

Inputs:

- `<projectDir>/scene_specs.json`
- `<projectDir>/audio_meta.json`
- optional `<projectDir>/image-manifest.json`
- optional `<projectDir>/versions.json`
- design tokens via `--preset <path>`, default `fixtures/presets/light.json`

The compiler uses the same `vf` schema and semantic validators as `vf write` before it writes anything. It also verifies that each `audio_meta.scenes[].sourceHash` equals `SHA-256(scene_specs.scenes[].narration_tts)`.

Outputs go under `<projectDir>/build/`:

- `index.html`
- `scenes/scene-<sceneId>.html`
- `render-manifest.json`
- copied render assets under `assets/`

`build/` and `.build-tmp-*` are generated artifact directories. They are ignored by git and skipped by contract discovery gates; source contracts stay in the project root.

## Image Assets

When `<projectDir>/image-manifest.json` exists, the compiler resolves images for scenes whose `visual_kind` is `generate_image`. `search_image`, `map_scene`, and `video` remain schema-compatible reserved values; they are not wired into compiler image placement yet.

Selection order:

- If `versions.json` contains `resources.image_<sceneId>.selected`, that generation must match an `image-manifest.json` asset for the same scene and `gen`.
- Otherwise the first matching `image-manifest.json` asset for the scene is used.

The selected source path must be a project-relative `./assets/...` file. The compiler copies it into `build/assets/images/`, records the build-relative path in `render-manifest.json` as `scenes[].imagePath`, and emits a full-bleed `<img>` layer inside the scene background. Existing image scrim and dim rules are applied over the image, and the scene's `kenBurns` settings animate the image layer rather than relying on post-build HTML overrides.

## Timing

The compiler uses the engine-compatible frame rule:

```js
durationFrames = Math.ceil(audioDurationSec * fps)
```

Scene `startFrame` is the cumulative sum of prior scene `durationFrames`. Transitions do not move incoming starts, narration audio, or subtitle starts. A non-cut transition extends only the outgoing scene slot by the quantized transition frames. All emitted seconds are frame-quantized and converted back from frame counts.

## Block Interface

`headline_only` is implemented natively. Other layouts (`bar`, `pie`, `line`, `list`, `numbered`, `statistic`, `compare`, `quote`) delegate to:

```text
blocks/<layout>/block.html
```

If the block file exists, the scene embeds it as a HyperFrames sub-composition with `data-variable-values`. If it is missing or has no `data-composition-id`, the compiler emits the native `headline_only` fallback and records a warning.

Block variables:

```json
{
  "title": "Scene headline",
  "items": ["label"],
  "values": [12, "42%"],
  "unit": "%",
  "accent": "#2563EB",
  "mood": "informative",
  "emphasis": "keyword",
  "reveal": "fade_in",
  "visualKind": "chart",
  "source": "fixture or citation"
}
```

Block HTML contract:

- Wrap live markup, `<style>`, and `<script>` inside `<template>`.
- The block root `data-composition-id` must match the key registered in `window.__timelines`.
- Create exactly one synchronous `gsap.timeline({ paused: true })`.
- Do not include `<audio>` or `<video>` inside the block; media belongs to `index.html`.
- Treat variables as read-only initialization data from `window.__hyperframes.getVariables()`.

## Subtitle Interface

Every scene gets a direct child subtitle container:

```html
<div data-subtitle-mode="keyword" data-subtitles="{...}">...</div>
```

`data-subtitles` contains:

```json
{
  "mode": "keyword",
  "renderer": "static-line",
  "text": "Narration line",
  "words": [{ "word": "token", "start": 0, "end": 0.4 }],
  "startSec": 0,
  "endSec": 3.2
}
```

P2-00 renders this as a static line. P2-02 owns karaoke and keyword rendering, using the same container and data shape.

## Transition Interface

P2-00 exposes the transition hook contract in `src/compiler/transitions.mjs`:

```js
emitTransition({
  transition,
  fromSlotId,
  toSlotId,
  startFrame,
  durationFrames,
  fps
})
```

Built-ins:

- `cut`: no overlap and no GSAP tween.
- `fade` / `crossfade`: outgoing opacity fades to 0 while incoming opacity fades to 1. Incoming start remains unchanged.

Other transition names currently compile as crossfade with a warning. P2-01 should extend this hook, not change the timing model.

## BGM Interface

When any scene requests OST, `index.html` includes a root-level BGM `<audio>` entry. The compiler first looks for a project track at `assets/audio/bgm.mp3`, then `bgm.wav`, then `bgm.ogg`; if none exists it generates a deterministic silent WAV so the layer and manifest contract remain present.

`render-manifest.json` records:

```json
{
  "bgm": {
    "path": "./assets/audio/bgm.mp3",
    "volume": 0.15,
    "duckingKeyframes": [{ "timeSec": 0, "volume": 0.15 }]
  }
}
```

The manifest path is the selected project track when present, otherwise `./assets/audio/bgm-silence.wav`. Empty-narration scenes with no timed words emit no subtitle container.

## Render Lint

Compilation ends by running `hyperframes lint` plus ReelForge checks:

- Sub-composition transport: live style/script/markup must be inside `<template>`.
- Host scene mount is mandatory; orphan scene files are failures.
- Scene files must not contain `<audio>` or `<video>`.
- Full-frame backgrounds must be on a full-bleed child, not `#root`.
- Scene `#root` must not depend on a root class selector.
- Inline `fetch()` is forbidden.
- Every `gsap.timeline()` must be `paused: true`.

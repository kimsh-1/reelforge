# Deck Adapter

`src/pipeline/deck-adapter.mjs` converts a video-factory `render-manifest.json`
plus its source `scene_specs.json` into a deck-factory `motion-manifest.json`.
The adapter is a file boundary: it does not call deck-factory directly.

## Usage

```sh
node src/pipeline/deck-adapter.mjs \
  --render-manifest path/to/render-manifest.json \
  --scene-specs path/to/scene_specs.json \
  --output path/to/motion-manifest.json
```

The positional form is also supported:

```sh
node src/pipeline/deck-adapter.mjs render-manifest.json scene_specs.json motion-manifest.json
```

## Field Mapping

| deck `assets[]` field | video-factory source | Rule |
|---|---|---|
| `id` | `render-manifest.scenes[].sceneId` | Direct copy. |
| `path` | `render-manifest.scenes[].path` | Direct copy of the per-scene preview-tier rendered clip path. The caller must provide a deck-visible asset path. |
| `kind` | Adapter constant | Emits `motion`. In deck-plan binding this asset is consumed by a `media` slot. |
| `engine` | Adapter constant | Emits `hyperframes`. |
| `width` | `render-manifest.meta.resolution.width` | Direct copy. |
| `height` | `render-manifest.meta.resolution.height` | Direct copy. |
| `durationMs` | `scenes[].durationFrames`, `meta.fps` | `Math.round(durationFrames * 1000 / fps)`. |
| `durationFrames` | `render-manifest.scenes[].durationFrames` | Direct copy; never recovered from `durationMs`. This is the v1.3 extension over the current deck-factory motion schema. |
| `fps` | `render-manifest.meta.fps` | Direct copy. |
| `tokensRef` | `render-manifest.meta.designTokens` | Stub deck-token reference in the form `deck-tokens:inline-background:<hex>`. |
| `altText` | `scene_specs.scenes[].altText` matched by `sceneId` | Direct copy from authored accessibility text. Narration is not used as fallback. |

## Token Mapping Stub

The intended bridge is `design-tokens.json` to deck-factory `deck-tokens`.
Only the background HEX axis is implemented in P1-04.

| deck-token axis | video-factory source | P1-04 behavior |
|---|---|---|
| `palette.role.canvas` / background HEX | `designTokens.colors.background`, then `canvas`, `bg`, `surface`, `base` | Implemented; emitted inside `tokensRef` as `deck-tokens:inline-background:<hex>`. |
| palette role map | `designTokens.colors.*` | Specified as a required future axis; not emitted yet. |
| fonts three-axis mapping | `designTokens.fonts.headline`, `body`, `mono` into deck `fonts.pair.display`, `body`, `mono` | Specified as a required future axis; not emitted yet. |

## Constraints

video-factory is a parallel motion producer for deck-factory, not a replacement
for the existing 3b1b `deck-motion` manim path. The `engine` field separates
`hyperframes` assets from manim-generated assets so both producers can coexist.

The adapter fails if `durationMs` and `fps` cannot round-trip back to the baked
`durationFrames` value:

```js
Math.round((durationMs * fps) / 1000) === durationFrames
```

The adapter also fails if a render scene has no matching authored `altText`.
Composition HTML remains a read-only build artifact; accessibility text comes
from `scene_specs.json`.

## Not Implemented

- Writing a full deck-factory `tokens.json` file.
- Full palette-role mapping beyond the background HEX needed for seam checks.
- Font pair and fallback mapping into deck-token `fonts`.
- deck-factory doctor motion profile changes for the hyperframes branch.
- Updating deck-factory's current `motion-manifest.schema.json` to accept the
  P1-04 `durationFrames` extension.

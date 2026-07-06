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
| `tokensRef` | `render-manifest.meta.designTokens` | Reference to the emitted inline deck-token block: `deck-tokens:inline:<background-hex-without-#>:<sha16>`. |
| `altText` | `scene_specs.scenes[].altText` matched by `sceneId` | Direct copy from authored accessibility text. Narration is not used as fallback. |

The output manifest also includes top-level `tokens` keyed by `tokensRef`, so every
asset points at a concrete deck-token block in the same file.

## Token Mapping

| deck-token axis | video-factory source | Adapter behavior |
|---|---|---|
| `palette.backgroundHex` and `palette.roles.canvas` | `designTokens.colors.background`, then `canvas`, `bg`, `surface`, `base` | Resolves `#RGB`, `#RRGGBB`, or `#RRGGBBAA` to lowercase `#RRGGBB`; also encoded in `tokensRef`. |
| palette role map | `designTokens.colors.*` | Emits every color into `tokens[tokensRef].palette.roles`; known aliases map `background/bg/canvas` to `canvas`, `foreground` to `text`, and preserve other role names. |
| fonts three-axis mapping | `designTokens.fonts.headline`, `body`, `mono` | Emits `tokens[tokensRef].fonts.pair.display`, `.body`, and `.mono` with family, files, weight, style, sourceRole, and deckRole. |

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

It fails when `render-manifest.scenes[]` contains duplicate `sceneId` values or
when the render sceneId set differs from `scene_specs.scenes[]`.

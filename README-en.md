<p align="center"><a href="README.md">한국어</a> | English | <a href="README-ja.md">日本語</a></p>

<!-- HERO: /mnt/d/reelforge-output/hero — 데모 완성 후 GIF+릴리스 링크 삽입 -->
<p align="center">
  <img src="docs/images/studio-scenes.png" alt="ReelForge Studio scene editor" width="900">
</p>

<p align="center"><strong>ReelForge is a keyless AI video loop: write `scene_specs.json`, run the local pipeline, then refine the result in Studio.</strong></p>

## [quick-start] Quick Start(first video in 3 minutes)

Run this from the repository root. The `vf` function is only a short local CLI name for this shell.

```bash
cd ~/reelforge
npm ci
./node_modules/.bin/hyperframes doctor

PROJECT_DIR="tmp/quickstart-reel-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$PROJECT_DIR"
cp fixtures/golden-specs/minimal-3scene/scene_specs.json "$PROJECT_DIR/scene_specs.json"

vf() { node bin/vf "$@"; }
vf pipeline run "$PROJECT_DIR" --profile mock
vf studio "$PROJECT_DIR" --port 4317
```

When the terminal prints `studio: http://127.0.0.1:4317/panel/`, open it in a browser and edit scene copy, layouts, and subtitle modes. The rendered video is written to `$PROJECT_DIR/out/main.mp4`.

## [features] Key Features

### Studio edit loop
`vf studio` shows the scene list, preview, schema-driven form, and version state in one local surface.
Copy/layout edits are E1, TTS text edits are E2, and scene order or transition edits are E3, so the UI can show the needed rerun scope.
<!-- SCREENSHOT: docs/images/studio-scenes.png -->

### Eight scene blocks
Choose `bar`, `pie`, `line`, `list`, `numbered`, `statistic`, `compare`, or `quote` through the `layout` field in `scene_specs.json`.
`headline_only` is available for title and closing cards, but content scenes usually start faster with one of the eight primary blocks.
<!-- SCREENSHOT: docs/images/blocks-8.png — add block gallery after demo render -->

### Multi-format
The compiler supports `16:9`, `9:16`, and `1:1` canvases with format-aware subtitle safe zones and overrides.
Example: `vf compile "$PROJECT_DIR" --format 9:16 --json`.
<!-- SCREENSHOT: docs/images/multiformat.png — add 16:9/9:16/1:1 comparison -->

### Free keyless stack
The default path uses mock TTS, mock images, local Chrome/ffmpeg, and `hyperframes@0.7.26`, so it can run without API keys.
Real TTS and image runners are optional; rights and service terms stay in project-level provenance.
<!-- SCREENSHOT: docs/images/keyless-stack.png — add local artifact flow -->

## [demos] Three Demos

| Demo | Use | Spec | Release |
|---|---|---|---|
| D1 Usage | Tutorial video for install, pipeline run, and Studio review | `demos/d1-usage/scene_specs.json` | [Release link pending](#) |
| D2 Engine | Short engine explainer for HTML compilation, seek determinism, and gates | `demos/d2-engine/scene_specs.json` | [Release link pending](#) |
| D3 Intro | Brand/product intro for people seeing ReelForge for the first time | `demos/d3-intro/scene_specs.json` | [Release link pending](#) |

## [skill] Using The Skill In Claude Code

Open this repository in Claude Code and register or reference `skills/reelforge/SKILL.md` as the project skill.
Start with a request like "Use the ReelForge skill to turn this brief into `scene_specs.json` and run the mock pipeline."
The skill guides brief intake, scene authoring, `vf pipeline run`, gate checks, and Studio review.

## [reference] Settings Reference

CLI options and settings live in [docs/usage.md](docs/usage.md). See [docs/studio.md](docs/studio.md) for Studio behavior and [docs/pipeline.md](docs/pipeline.md) for resume and dirty-guard details.

## [validation] How The Project Was Verified

P0~P3 proof results, gate details, and architecture notes moved to [docs/build-journey.md](docs/build-journey.md).

## [license-disclaimer] License And Disclaimer

Code is Apache-2.0. Fonts, audio, images, and TTS outputs follow their own licenses and service terms; check project-level provenance before public distribution or commercial use.

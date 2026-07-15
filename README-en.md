<p align="center"><a href="README.md">한국어</a> | English | <a href="README-ja.md">日本語</a></p>

<p align="center"><img src="docs/assets/hero.gif" alt="ReelForge demo highlights" width="720"></p>

<p align="center"><strong>ReelForge is a keyless AI video-generation loop that turns a one-line brief into a full-bleed motion-graphics video.</strong></p>

The output is a video, not a slide deck.
Kinetic typography, mood-driven color systems, and continuous living motion are its default language,
and every scene is an HTML motion-graphics fragment authored directly by an agent (or a person).

## [loop] Core Loop (v6)

```
One-line brief
  → 1. Freeze direction       Establish the feel as a contract first: frame (palette, type, mood arc) + copy + storyboard
  → 2. Scene swarm            One worker per scene authors a free HTML fragment directly (in parallel)
  → 3. Assemble and validate  Thin manifest → compile → deterministic lint (blocks wall-clock and nondeterministic code)
  → 4. Render                 Deterministic headless-Chrome render (multi-worker and GPU options)
  → 5. Strip QC               Mechanical inspection of the full 1 fps strip + viewer review → reauthor only failed scenes locally
```

Design principle: direction—the feel—comes before the data contract.
Scenes are authored works, not automatically generated layouts; the engine owns only timing, captions, transitions, tokens, and validation.
See [docs/v6-architecture.md](docs/v6-architecture.md) for the complete design and what was discarded from v5, and why.

## [quick-start] Quick Start

Recommended agent path: open this repository in Claude Code, register `skills/reelforge/SKILL.md` as a skill,
then make a request such as “Create a 30-second brand intro with ReelForge.”
The skill runs the loop above exactly as written, from freezing the direction through strip QC.

Local smoke test (to verify the pipeline):

```bash
cd <repo>
npm ci
./node_modules/.bin/hyperframes doctor

PROJECT_DIR="tmp/smoke-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$PROJECT_DIR"
cp fixtures/golden-specs/minimal-3scene/scene_specs.json "$PROJECT_DIR/scene_specs.json"

node bin/vf pipeline run "$PROJECT_DIR" --profile mock
node bin/vf studio "$PROJECT_DIR" --port 4317
```

The final video is created at `$PROJECT_DIR/out/main.mp4`.

## [features] Key Features

### Free scenes — the motion-graphics authoring unit
Each scene is an authored HTML fragment (`layout: "free"` + `sourceHtml`).
Paused GSAP timelines and CSS living loops are safe for deterministic seek rendering,
and consuming color solely through preset tokens (`--rf-*`) lets the same scene render again in any preset.

### Seventeen design presets
From linear, vercel, stripe, and apple to dark-hype and Korean broadcast/variety-show tones.
A single preset controls the surface ladder, hairlines, mood-specific accents and glows, and caption tokens,
while a minimum contrast threshold is enforced at compile time. See the catalog in [docs/design-presets.md](docs/design-presets.md).

### Deterministic rendering and validation
Rendering is seek-based and deterministic, so identical inputs produce identical pixels.
render-lint rejects fetch, Math.random, Date.now, performance.now, and non-paused timelines,
while mechanical inspection of the 1 fps strip (blank frames, low contrast, frozen motion) underpins the QC loop.

### Audio-authoritative timing
Audio metadata is the sole authority for scene duration.
With narration, TTS determines scene boundaries; for music-led work, a beat grid or silent mock does.
The default stack is reproducible without API keys using mock TTS and local Chrome/ffmpeg.

### Studio editing loop
Use `vf studio` to preview scenes and refine them with guidance on the scope of a change: E1 expression, E2 dialogue, or E3 structure.

### Appendix — eight data blocks (optional)
An option only for the rare scene that truly needs quantitative data (`bar`, `pie`, `line`, `list`,
`numbered`, `statistic`, `compare`, `quote` — full-bleed render). The default is zero blocks;
do not start body scenes with blocks.

## [demos] Demos

| Demo | Purpose | Release |
|---|---|---|
| D1 Usage | Usage-flow tutorial | [d1-usage.mp4](https://github.com/kimsh-1/reelforge/releases/download/v0.1.0/reelforge-d1-usage.mp4) |
| D2 Engine | Introduction to compilation, determinism, and gates | [d2-engine.mp4](https://github.com/kimsh-1/reelforge/releases/download/v0.1.0/reelforge-d2-engine.mp4) |
| D3 Intro | Brand/product intro | [d3-intro.mp4](https://github.com/kimsh-1/reelforge/releases/download/v0.1.0/reelforge-d3-intro.mp4) |

The current release is an output of the v5 pipeline. It will be replaced as soon as demos generated with the v6 loop are ready.

## [reference] Configuration Reference

For CLI options and configuration, see [docs/usage.md](docs/usage.md); for Studio details, see [docs/studio.md](docs/studio.md);
for pipeline resumption and the dirty guard, see [docs/pipeline.md](docs/pipeline.md); and for the compiler contract (blocks and the free interface),
see [docs/compiler.md](docs/compiler.md).

## [validation] How the Project Was Validated

P0–P3 proof results, gate details, and architecture records are in [docs/build-journey.md](docs/build-journey.md).

## [license-disclaimer] License and Disclaimer

The code is Apache-2.0. Fonts, audio, images, and TTS outputs follow their respective licenses and service terms;
check project-level provenance before public distribution or commercial use.

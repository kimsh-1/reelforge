# Codex Runner Reference

Use this reference for batch ReelForge production: many briefs in, many finished
motion-graphic projects out. A batch is not a parallel `scene_specs.json` writing job.
For every project, the production spine is **Direction Freeze -> Scene Swarm -> Assemble
-> Render -> Strip QC**. The default video has zero data-block scenes.

## Batch Shape

Represent each incoming job as:

```json
{
  "projectId": "agency-demo-01",
  "brief": "브리프 한 줄 또는 대본",
  "audience": "대상",
  "goal": "시청 후 행동",
  "format": "shorts|demo|explainer|report",
  "targetSeconds": 30,
  "brand": {
    "tone": "차분하고 전문적",
    "mustUse": ["ReelForge"],
    "avoid": ["검증되지 않은 성과 주장"]
  },
  "imagePolicy": "none|generated|runner"
}
```

For `N` briefs, create `N` isolated project directories. Each completed project contains
frozen direction (`direction/frame.md`, `direction/copy.md`, `direction/STORYBOARD.md`),
one authored free-source fragment per scene by default under `scenes-src/`, a thin assembled
`scene_specs.json`, audio metadata/assets, and its own build, render, and report outputs.
Do not share mutable `versions.json`, `image-manifest.json`, `audio_meta.json`, or image
runner result directories across projects.

## Batch Production Pattern

1. **Freeze direction per project before dispatch.** Normalize the brief, select the
   preset and mood arc, polish all visible copy, and assign deterministic scene IDs in the
   storyboard. The storyboard records each scene's duration *target*, intent, idiom, and
   transition semantic; it never authorizes a `duration` field in the manifest. Treat the
   resulting direction files as read-only worker context.
2. **Prepare a single pilot.** Choose a representative early scene (normally the hook),
   and give one worker ownership of only
   `<projectDir>/scenes-src/<sceneId>-free.html`. Review the returned fragment against the
   frozen storyboard and its 1fps view. Repair the shared direction or worker brief once;
   do not begin a batch-wide rewrite from an unreviewed first fragment.
3. **Fan out the remaining scene swarm only after the pilot is approved.** Dispatch one
   Codex worker per remaining scene. Pass the approved pilot as the house-style reference,
   but keep the original direction artifacts authoritative. A worker authors its one free
   fragment and touches nothing else.
4. **Assemble centrally.** The coordinator creates the thin manifest, narration/mock
   audio metadata, and transition edges from the frozen direction; it then compiles and
   render-lints. Workers do not run the CLI, render, edit `scene_specs.json`, or edit
   generated `build/` HTML.
5. **Render and QC centrally.** Render one project at a time per machine. Inspect the
   contact sheet and the full 1fps strip, then re-dispatch only failing scene owners with
   the specific failure attached. Two failed QC rounds for one scene escalate with its
   strip rather than silently broadening the job.

Keep each worker inside its project directory. Pass shared brand rules and frozen direction
as read-only prompt context; never make a worker edit a shared batch file.

## Scene Worker Ownership Contract

One scene worker owns exactly one file:

```text
<projectDir>/scenes-src/<sceneId>-free.html
```

It authors a full HTML document whose `<body>` has one `<template>` containing `<style>`,
one root with `data-composition-id="free-<sceneId>"`, and one script that synchronously
registers exactly one `gsap.timeline({paused:true})` at
`window.__timelines["free-<sceneId>"]` and ends with `tl.seek(0)`. The worker uses
`var(--rf-*, fallback)` tokens, gives entrance motion no more than 0.4 seconds, leaves a
visible `filter`/`opacity` living loop for the strip, and never builds a card, panel stack,
master header/footer, or title-and-bullets slide.

The coordinator must record the assignment before dispatch and autopsy each return rather
than trusting a completion message. At minimum, verify all of the following before a
fragment is accepted:

```bash
# The worker changed only its assigned source file (include untracked files in this check).
git status --short --untracked-files=all -- <projectDir>

# Determinism violations are never repaired downstream.
rg -n 'Math\.random|Date\.now|performance\.now|fetch\s*\(' \
  <projectDir>/scenes-src/<sceneId>-free.html

# Inspect each contract anchor with the assigned composition id substituted literally.
rg -n '<template>' <projectDir>/scenes-src/<sceneId>-free.html
rg -n 'data-composition-id="free-<sceneId>"' <projectDir>/scenes-src/<sceneId>-free.html
rg -n 'gsap\.timeline\(\{\s*paused:\s*true\s*\}\)' <projectDir>/scenes-src/<sceneId>-free.html
rg -n 'window\.__timelines\["free-<sceneId>"\]' <projectDir>/scenes-src/<sceneId>-free.html
rg -n 'tl\.seek\(0\)' <projectDir>/scenes-src/<sceneId>-free.html

# Flag the most common slide skeleton before visual review.
rg -n '<(header|footer|li)\b|title.{0,80}(bullet|list)|(bullet|list).{0,80}title' \
  <projectDir>/scenes-src/<sceneId>-free.html
```

The first command is compared with the recorded file owner; the determinism grep must find
no violation and every contract-anchor grep must match. The last grep is an autopsy
prompt, not a waiver: inspect any match for a deck-like composition. Also inspect the
fragment's actual motion in the pilot/QC strip; greps cannot prove that the living loop is
visible or that a composition feels full-bleed.

## Worker Prompt Template

```text
Use the ReelForge skill to author exactly one v6 Scene Swarm fragment.

PROJECT_DIR: <projectDir>
FILE YOU OWN: <projectDir>/scenes-src/<sceneId>-free.html
SCENE: <the single frozen STORYBOARD row>
FROZEN CONTEXT: direction/frame.md, direction/copy.md, direction/STORYBOARD.md
HOUSE STYLE: <approved pilot fragment, when this is a fan-out scene>

Author only FILE YOU OWN. It is a full free-scene HTML fragment: one template, a unique
free-<sceneId> composition id, exactly one synchronous paused GSAP timeline registered at
window.__timelines["free-<sceneId>"], and tl.seek(0). Use only --rf-* colors with
fallbacks. Make the entrance complete within 0.4s and leave visible filter/opacity living
motion for the 1fps strip.

Do not edit direction files, scene_specs.json, audio_meta.json, image manifests, another
scene, build output, schemas, or batch files. Do not run compile, pipeline, Studio, or a
render. Do not use fetch, Math.random, Date.now, or performance.now. Do not make a slide:
no card/panel frame, master header/footer, or title-plus-bullets skeleton.

Before returning, run the ownership and autopsy greps supplied by the coordinator and
report the exact file changed plus any visual assumption that needs coordinator review.
```

## Central Assembly And Gate

After all accepted fragments exist, the coordinator builds `scene_specs.json` as an
assembly manifest, never as visible-layout source. Every default scene is `layout: "free"`
with its project-relative `sourceHtml`, authored `altText`, headline, mood/reveal/emphasis,
`items: []`, visual intent, subtitle mode, narration fields, and transition edge. The
manifest has no per-scene duration: TTS/audio metadata owns narrated timing, beat data owns
music timing, and silent motion scenes receive a matching mock-audio duration.

Compile each project with its selected preset:

```bash
node bin/vf compile <projectDir> --preset fixtures/presets/<preset>.json
```

Treat `free-missing-source`, `free-missing`, and `free-invalid` as batch failures even
though the compiler can degrade those scenes to `headline_only`. Use the full pipeline when
appropriate, verify its report, and record the command, status, and project-scoped report:

```bash
node bin/vf pipeline run <projectDir> --profile mock
node bin/vf verify-report <projectDir>/reports/pipeline-gate-report.json
```

The final batch gate for every project records: frozen direction present; one accepted free
fragment per default storyboard scene; file ownership and autopsy results; compile/render-
lint status with no free-scene fallback warnings; pipeline command and report; image-runner
status when requested; final render path; and the completed strip-QC result. Apply the
legacy contract gate separately to the rare optional data-block scene. Do not commit batch
outputs unless the user explicitly asks. Do not use `/mnt/d` for active worktrees or render
work; use it only for requested output mirrors.

## Image Runner Contract

`imagePolicy: "runner"` keeps the image handoff separate from scene authorship. The
coordinator marks an image scene's visual intent in the thin manifest; its Scene Swarm
worker still owns only the free fragment and does not write runner files. With
`--profile real`, `visual_kind: "generate_image"` scenes use the `codex-imagegen-runner`
contract.
The pipeline writes:

```text
<projectDir>/assets/images/runner/prompts.jsonl
<projectDir>/assets/images/runner/status.json
<projectDir>/assets/images/runner/results/
```

Each `prompts.jsonl` line is JSON with these fields:

```json
{
  "contractVersion": "reelforge.image-runner.v1",
  "id": "image_s03_gen_01",
  "sceneId": "s03",
  "gen": "gen_01",
  "prompt": "compiled image prompt",
  "width": 1920,
  "height": 1080,
  "resultPath": "./assets/images/runner/results/image_s03_gen_01.png",
  "finalPath": "./assets/images/s03_gen_01.png"
}
```

The image worker writes a non-empty valid PNG to `resultPath`, never directly to
`finalPath`. The pipeline copies accepted PNGs into final assets and updates the selected
pointers in `versions.json`. Missing, invalid, zero-byte, or wrongly named results remain
pending; extra unrelated result files are ignored. When status is pending, record `WAIT`,
do not mark the image step complete, and rerun the same pipeline command after valid PNGs
arrive.

## Appendix — Optional Data Blocks

The eight legacy layouts (`bar`, `pie`, `line`, `list`, `numbered`, `statistic`, `compare`,
and `quote`) are an optional appendix for a genuinely quantitative scene. They are not the
batch default, not a Scene Swarm assignment pattern, and not a reason to start from a
brief-to-`scene_specs.json` block workflow. Default production is zero block scenes.

Use a block only when a real data moment is materially clearer than an authored free
fragment; it must remain full-bleed and avoid card chrome. See `scene-authoring.md` for the
legacy block contract and validation details. The full-eight fixture is a compile smoke
path, not a production template.

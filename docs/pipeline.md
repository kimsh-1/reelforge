# ReelForge Pipeline

`vf pipeline run <projectDir>` executes the P3 pipeline graph:

```text
tts -> images -> compile -> render -> gate
```

The pipeline starts from existing authoring contracts. P6 owns brief-to-scene authoring; P3 starts at `scene_specs.json`.

## CLI

```bash
node bin/vf pipeline run <projectDir> [--until <step>] [--only <step>] [--force] [--force-dirty] [--profile mock|real]
```

- `--profile mock` is the default and is fully local.
- `--profile real` uses the Wave 1 adapters: TTS runs through `src/pipeline/tts`, and image generation runs through `src/pipeline/images`.
- `--until <step>` runs from `tts` through the named step.
- `--only <step>` runs one step without running dependencies.
- `--force` ignores `pipeline_state.json` and reruns selected steps.
- `--force-dirty` lets the run continue when `versions.json dirty=true`; without it the pipeline warns and stops before writing run state.

## Step Contract

Step definitions live in `src/pipeline/core/steps.mjs`. A step is:

```js
{
  id: "tts",
  inputs: ["scene_specs.json"],
  outputs: ["audio_meta.json", "assets/audio/*.mp3"],
  run(ctx) {},
  skipWhen(ctx, step, inputHash) {}
}
```

Rules:

- `id` must be one of `tts`, `images`, `compile`, `render`, or `gate`.
- `inputs` and `outputs` are file globs. Project-relative globs read under `<projectDir>`.
- `repo:<glob>` is allowed for implementation inputs such as `repo:src/compiler/**`.
- `run(ctx)` must write every declared output before returning.
- `skipWhen` should skip only when outputs exist and either resume state proves the same input hash completed or a prior project gate report is valid and fresh.
- Step outputs must be append-safe where generations are involved; destructive replacement belongs behind explicit version logic.

## Adapter Surface

The step `ctx` contains:

- `repoRoot`: absolute repository root.
- `projectDir`: absolute project directory.
- `profile`: `mock` or `real`.
- `force`: whether `--force` was passed.
- `command`: original CLI command string for reports.
- `state`: mutable in-memory `pipeline_state.json` data.
- `resolveSelectedResource(resourceType, fallbackPath)`: resolves `versions.json resources[resourceType].selected` first, then returns the fallback.

TTS adapters must emit:

- `<projectDir>/audio_meta.json`
- `<projectDir>/assets/audio/*.mp3`
- `audio_meta.scenes[].sourceHash = SHA-256(scene_specs.scenes[].narration_tts)`

Image adapters must emit:

- `<projectDir>/image-manifest.json`
- `<projectDir>/versions.json` resources with `selected` pointing at the active generation
- `<projectDir>/assets/images/*` for every generated image asset listed in the manifest

The compiler does not consume selected images yet. P3-03 owns full selected-pointer lifecycle and compiler asset resolution.

## Resume State

The pipeline writes `<projectDir>/pipeline_state.json` through `vf write --schema pipeline-state`:

```json
{
  "completedSteps": ["tts", "images"],
  "failedSteps": {},
  "stepHashes": { "tts": "<sha256>" },
  "startedAt": "2026-07-07T00:00:00.000Z",
  "finishedAt": null
}
```

On rerun, a step is skipped when:

- `--force` is not set,
- the step is listed in `completedSteps`,
- the current canonical input hash equals `stepHashes[stepId]`, and
- all declared outputs exist and are non-empty.

If a process is killed mid-run, completed steps remain in `pipeline_state.json` because state is flushed after each step.

If the real image runner has outstanding PNG results, the images module writes `image-manifest.json` with `status: "pending"` plus `assets/images/runner/prompts.jsonl`, then the pipeline logs `WAIT` and stops without marking `images` failed or complete. After the runner writes the requested PNGs under `assets/images/runner/results`, rerun the same pipeline command to resume from the incomplete `images` step.

## Dirty Guard

Pipeline runs call the versions lifecycle guard in `src/pipeline/versions-impl` before state is written. When `versions.json dirty=true`, the run logs a warning and aborts so manual or Studio edits can be reconciled. `--force-dirty` logs the same warning and continues.

## Profiles

`mock` profile:

- `tts`: `src/pipeline/tts` dispatches to the existing local mock, which creates silent MP3 files with `ffmpeg anullsrc` and synthetic monotonic word timings.
- `images`: `src/pipeline/images` uses its `mock-image` provider, writes `image-manifest.json`, creates deterministic PNGs for `visual_kind=generate_image` scenes, and records selected generations in `versions.json`. Projects with no generated-image scenes still get a complete manifest and a schema-valid `versions.json`.
- `compile`, `render`, and `gate` are the same as real profile.

`real` profile:

- `tts`: `src/pipeline/tts` runs the real adapter. The default provider chain uses edge-tts first and can fall back through the configured MeloTTS path for retryable edge failures.
- `images`: `src/pipeline/images` uses the `codex-imagegen-runner` contract. It writes prompts to `assets/images/runner/prompts.jsonl`; absent PNG results produce a pending manifest and a resumable `WAIT` stop instead of a failed step.

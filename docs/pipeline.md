# ReelForge Pipeline

`vf pipeline run <projectDir>` executes the P3 pipeline graph:

```text
tts -> images -> compile -> render -> gate
```

The pipeline starts from existing authoring contracts. P6 owns brief-to-scene authoring; P3 starts at `scene_specs.json`.

## CLI

```bash
node bin/vf pipeline run <projectDir> [--until <step>] [--only <step>] [--force] [--profile mock|real]
```

- `--profile mock` is the default and is fully local.
- `--profile real` is an adapter slot. Until P3-01/P3-02 land, the built-in real steps are passthrough checks that require their output contracts to already exist.
- `--until <step>` runs from `tts` through the named step.
- `--only <step>` runs one step without running dependencies.
- `--force` ignores `pipeline_state.json` and reruns selected steps.

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

P3-01 and P3-02 should replace only the `tts` and `images` implementations, not the orchestrator.

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

- `<projectDir>/assets/images/*`
- `<projectDir>/versions.json` resources with `selected` pointing at the active generation

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

## Profiles

`mock` profile:

- `tts`: creates silent MP3 files with `ffmpeg anullsrc` and synthetic monotonic word timings.
- `images`: creates deterministic solid PNGs and selected generation entries in `versions.json`.
- `compile`, `render`, and `gate` are the same as real profile.

`real` profile:

- `tts` and `images` are extension points for P3-01/P3-02.
- Current fallback is passthrough only: `audio_meta.json` and `versions.json` must already exist.

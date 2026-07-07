# Codex Runner Reference

Use this reference for batch authoring: many briefs in, many valid ReelForge project specs out.

## Batch Shape

Represent each job as:

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

For `N` briefs, create `N` isolated project directories and produce exactly one `scene_specs.json` per project. Do not share mutable `versions.json`, `image-manifest.json`, `audio_meta.json`, or runner result directories across jobs.

## Parallel Authoring Pattern

1. Normalize briefs into the interview frame: `Act as a <role> specialist. Design my video: audience, offer/message, structure, visual style.`
2. Assign deterministic project IDs and scene IDs before parallel work starts.
3. Run independent Codex workers per brief to draft only `scene_specs.json`.
4. Validate each spec with `vf write --schema scene-specs`.
5. Run `node bin/vf pipeline run <projectDir> --profile mock` for fast local validation.
6. Promote only validated specs to `--profile real` or Studio review.

Keep each worker scoped to its own project directory. If a worker needs shared brand rules, pass them as read-only text in the prompt rather than letting workers edit a shared file.

## Worker Prompt Template

```text
Use the ReelForge skill to author one project.

Input:
- projectId: <projectId>
- brief: <brief>
- targetSeconds: <rough total>
- audience: <audience>
- goal: <goal>
- visual policy: <none|generated|runner>
- brand/tone: <brand block>

Return:
- a valid <projectDir>/scene_specs.json
- no scene.duration fields
- authored altText for every scene
- transitions between adjacent scenes
- generated-image scenes only when imagePolicy allows them
```

## Image Runner Contract

With `--profile real`, `visual_kind: "generate_image"` scenes use the `codex-imagegen-runner` contract. The pipeline writes:

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

The image worker must write a non-empty valid PNG to `resultPath`. Do not write directly to `finalPath`; the pipeline copies accepted PNGs into final assets and updates `versions.json` selected pointers.

If results are missing, the pipeline leaves `image-manifest.json` as `pending`, logs `WAIT`, and stops without marking the image step failed or complete. After PNGs are written, rerun the same pipeline command to resume.

Invalid PNGs, 0-byte files, or wrong names remain pending. Extra unrelated files under `results/` are ignored.

## Batch Quality Gate

For each project, record:

- `scene_specs.json` validated through `vf write`.
- pipeline command and exit status.
- report path under `reports/`.
- whether image runner status is `pending` or `complete`.
- final `out/main.mp4` path when render completes.

Do not commit batch outputs unless the user explicitly asks. Do not use `/mnt/d` for active worktrees or render work; use it only for output mirrors when requested.

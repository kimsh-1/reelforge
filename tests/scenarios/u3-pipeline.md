# U-3 Pipeline Misuse Scenario

Scope: P3 U-3 2차, pipeline-level misuse. Source contracts: `research/06-plan/VERIFICATION-PLAN.md` L4 U-3 and `docs/pipeline.md`.

Command:

```sh
node tests/scenarios/u3-pipeline-suite.mjs
node bin/vf gate u3-pipeline --profile fast --json
```

Pass criterion: each misuse either receives a clear rejection or takes a safe resumable action. Crashes, silent acceptance of unsafe state, and infinite pending loops without a resumable contract are failures.

| ID | Misuse | Expected behavior |
|---|---|---|
| U3P-01 | Inject broken `audio_meta.json` after `tts`, then resume to `compile` | Compile rejects semantic word timing instead of rendering stale audio metadata |
| U3P-02 | Edit `scene_specs.json` through lifecycle backup while pipeline state exists | `versions.json dirty=true` blocks blind resume |
| U3P-03 | Delete the file currently selected by `versions.json` | Images step detects missing manifest asset, regenerates `gen_02`, and preserves history |
| U3P-04 | Put unrelated trash PNG in the runner recovery directory | Runner ignores the trash and remains pending for the requested result id |
| U3P-05 | Rerun while real image runner results are still pending | Pipeline returns `WAIT` again and does not mark `images` complete or failed |
| U3P-06 | Add the exact requested runner PNG after pending | Pipeline recovers to complete image manifest and selected version |
| U3P-07 | Run with `versions.json dirty=true` | Pipeline rejects before writing new run state |
| U3P-08 | Run dirty project with explicit `--force-dirty` equivalent | Pipeline proceeds and emits a warning |
| U3P-09 | Delete a completed step output before rerun | Resume refuses to skip and reruns the missing-output step |
| U3P-10 | Corrupt `pipeline_state.stepHashes.tts` | Resume refuses to skip and reruns the changed-hash step |
| U3P-11 | Directly edit `scene_specs.scenes[].narration_tts` after `tts`, then run only `gate` | Gate rejects stale `audio_meta.sourceHash` instead of accepting dirty edit/audio mismatch |

Last run target: `vf gate u3-pipeline`.

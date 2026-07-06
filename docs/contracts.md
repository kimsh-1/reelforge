# video-factory Contracts

The five JSON contracts are the single source boundary between authoring, assets, compilation, rendering, and deck export.

## Flow

| Contract | Written By | Read By | Truth Owned |
|---|---|---|---|
| `scene_specs.json` | script/director, studio save path | TTS planner, image planner, compiler, studio | Authored scene content, stable `sceneId`, accessibility `altText`, visual intent, transition edges |
| `audio_meta.json` | TTS/alignment step | compiler, invalidation checks, subtitle renderer | Audio paths, durations, word timings, narration `sourceHash` |
| `design-tokens.json` | preset/project editor | compiler, studio form generator | Colors, mood pacing, subtitle style, bundled font roles |
| `versions.json` | pipeline state manager | resume logic, studio, asset resolvers | Resource generation history and each active `resources[type].selected` pointer |
| `render-manifest.json` | compiler only | hyperframes renderer, deck adapter, gates | Resolved timing, token snapshots, scene clip paths, subtitles, BGM ducking |

`composition HTML` is a read-only build artifact. Every user edit must patch `scene_specs.json` or `design-tokens.json`, then recompile. Direct edits to generated HTML are discarded and must not become state.

## Invalidation

`audio_meta.scenes[].sourceHash` is the SHA-256 of `scene_specs.scenes[].narration_tts`.

| Condition | Action |
|---|---|
| `sourceHash` unchanged | Reuse existing audio, word timings, and selected generation pointers |
| `sourceHash` changed for one scene | Re-run TTS and word extraction for that scene only, then recompile all scene timings |
| Scene insertion, deletion, or reordering | Recompile global timing and adjacent transition edges |
| Design token change | Recompile render manifests and HTML; audio is reused unless narration changed |
| Image prompt or placement change | Create a new image generation entry, update `resources[image].selected`, then recompile |

## Generations

| Rule | Meaning |
|---|---|
| `gen_NN` entries are append-only | Regeneration creates a new entry; previous generations remain addressable |
| `resources[type].selected` is the active pointer | Consumers must resolve resources through the selected pointer, not by sorting paths |
| `note` records why a generation exists | Useful for studio backups, retries, and audit trails |
| `dirty=true` blocks blind overwrite | Studio and pipeline writers must reconcile unsaved edits before replacing state |
| `editLock` is advisory but mandatory to check | Concurrent writers must verify `owner` and `acquiredAt` before saving |

## Deck Adapter

The deck adapter reads `render-manifest.json`, emits `id` from `sceneId`, `path` from each scene clip, `width` and `height` from `meta.resolution`, `durationFrames` from the baked scene value, and `fps` from `meta.fps`. It must not recalculate `durationFrames` from `durationMs`.

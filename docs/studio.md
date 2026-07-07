# ReelForge Studio

P4 Studio is a local-only node `http` server exposed through:

```bash
node bin/vf studio <projectDir> [--port <number>]
```

It binds to `127.0.0.1` by default, serves `/panel/*` from the bundled placeholder panel, and serves `/build/*` read-only from the selected project's compiled build directory.

## Impact Classes

| Class | Trigger | Server action |
|---|---|---|
| `E1` | Scene presentation fields change: `headline`, `caption`, `altText`, `layout`, `mood`, `reveal`, `emphasis`, `items`, `values`, `unit`, `source`, `visual_kind`, `imageAsset`, `kenBurns`, `subtitleMode`, `ost`, `overrides`, or non-TTS `narration` | Save `scene_specs.json` through the edit-lock backup path and trigger scene-scope compile. The current compiler still emits a full build. |
| `E2` | `narration_tts` changes and therefore the expected `audio_meta.scenes[].sourceHash` changes | Save the dirty edit and return `pipeline:tts` plus `compile:full` actions. The caller should run `POST /api/pipeline/tts` for the affected scene IDs before compiling. |
| `E3` | Scene ID set/order changes, scene add/delete, or `transitions` changes | Save through the edit-lock backup path and trigger full compile. |

`PATCH /api/scenes/:sceneId` only accepts the scene field whitelist above. Structural scene edits are classified by comparing the before/after scene ID list, but P4-00 does not expose a scene create/delete endpoint.

## Events

`GET /api/events` is an SSE stream. It emits `compile.completed`, `compile.failed`, `render.status`, `tts.completed`, and debounced `file.changed` events for external `scene_specs.json` changes. The watcher is scoped to `scene_specs.json`; build artifacts are not watched.

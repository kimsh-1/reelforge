# L3-12 Long Video Memory Scenario

P5-pre long-video gate scenario.

- Gate: `node src/gates/p5-l3-12-long-video.mjs --profile full`
- Source: generated `scene_specs.json` under `tmp/gate-work/p5/l3-12-long-video/project`
- Shape: 12 scenes, `headline_only`, mock TTS audio, 1920x1080 render
- Duration target: actual final MP4 must be at least 120 seconds
- Reduction note: P5-pre-resume uses the allowed 12-scene, 2-minute configuration to reduce timeout risk while keeping the same verdict criteria.
- Memory evidence: `/usr/bin/time -v` peak RSS must be recorded
- Failure class: nonzero pipeline exit, SIGKILL, OOM/ENOMEM/heap/Killed signature, missing report, or output duration under 120 seconds

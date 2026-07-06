<h3 align="center"><a href="README.md">한국어</a> | English | <a href="README-ja.md">日本語</a></h3>

<h1 align="center">ReelForge</h1>

<p align="center">
  <a href="#"><img alt="CI placeholder" src="https://img.shields.io/badge/CI-placeholder-lightgrey"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-blue"></a>
  <a href="#"><img alt="Docker placeholder" src="https://img.shields.io/badge/docker-placeholder-lightgrey"></a>
</p>

reelforge is a deterministic video-production repository that starts from a short brief and carries narration contracts, compilation, rendering, and gate verification through one auditable path. Demo videos and large media files are not committed; evidence and research are tracked instead.

## [overview] Project Overview

reelforge targets Korean narration videos in landscape, portrait, and square formats. The render engine is exactly pinned to `hyperframes@0.7.26`, and edits flow through contract files such as `scene_specs` followed by recompilation rather than direct HTML mutation.

This T3 commit is the canonical repository foundation, not the finished product. It migrates research documents 00~10, P0 PoC evidence, the gate-runner skeleton, licensing policy, and Codex execution rules into one repo.

## [architecture] Five-Layer Architecture Summary

| Layer | Role |
|---|---|
| L0 Contracts | Treat `scene_specs`, `audio_meta`, `design-tokens`, `versions`, and `render-manifest` as sources of truth. |
| L1 Pipeline | Convert briefs into scripts, scenes, audio, images, and compiler inputs. |
| L2 Compiler | Read contracts and emit deterministic hyperframes HTML plus custom render-lint results. |
| L3 Studio | Provide adapter-hosted preview and schema-driven editing panels. |
| L4 Gates/Packaging | Own `vf gate`, CI, golden fixtures, regression checks, and final skill packaging. |

## [p0-results] P0 Proof Results

| Gate | Result | Migrated Evidence |
|---|---|---|
| P0a | Passed | Environment doctor, 5-second MP4, yuv420p, faststart, deterministic rerender record |
| P0b | Passed | Three mounted scenes, scene-only render, explicit orphan-render-success expectation, body-frame match |
| P0c | Passed | edge-tts word output, CJK font render, OCR positive control, 20-line stress run |
| P0d | Passed | Narration edit, sourceHash change, selective re-TTS, full recompile, one SSE observation |

Errata note: P0c did not prove word-synced subtitle rendering. What is proven so far is word extraction, monotonicity, audio-duration consistency, and static Korean text rendering.

## [free-stack] Free Stack

The default path is keyless and free. Korean TTS uses `edge-tts` as the default candidate, while transcription/alignment will be pinned to `faster-whisper` in a future gate. Images assume codex-imagegen plus keyless stock fallbacks, and BGM allows only verified CC0 or CC-BY sources.

Forbidden items are fixed in `THIRD_PARTY_LICENSES.md`. MusicGen, unclear-source BGM, non-redistributable SFX, and non-commercial-weight TTS are excluded from the default stack.

## [roadmap] Roadmap P1~P6

- P1: Five contract schemas, validators, and negative fixture suites.
- P2: Audio-independent compiler, eight scene blocks, transitions, and render-lint.
- P3: TTS, images, versions, resumable pipeline, and real TTS smoke gates.
- P4: Studio adapter, form generator, edit-impact classes, and concurrent editing behavior.
- P5: Long-video memory gates, golden regressions, and visual judgment gates.
- P6: Skill packaging, multi-format output, deck-factory integration, and cross-environment hashes.

## [installation] Installation

```bash
cd ~/reelforge
npm ci
npm run lint
npm run gate
node bin/vf gate list
```

Only rerun render gates intentionally, for example `node bin/vf gate p0b --execute`. Generated videos belong under `out/` and must not be committed.

## [disclaimer] License and Disclaimer

The code is Apache-2.0. Media, fonts, BGM, and SFX follow their own licenses, and users are responsible for how generated outputs are used. Paid adapter keys are optional; the default path must not require credentials.

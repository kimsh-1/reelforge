# ReelForge Docs

## Current (v6)

[v6-architecture.md](v6-architecture.md) is the canonical architecture document: what ReelForge is after the v6 re-architecture (video-generation-first, adopted 2026-07-16), what it deprecated from v5, and why. Start there.

Reference documents for the current engine:

| Document | Covers |
|---|---|
| [v6-architecture.md](v6-architecture.md) | Canonical v6 architecture: direction freeze, scene swarm, assemble, render, strip QC |
| [pipeline.md](pipeline.md) | `vf pipeline run` step graph, resume state, dirty guard, mock/real profiles |
| [compiler.md](compiler.md) | `vf compile` contracts: block and `layout:"free"` interfaces, render lint |
| [contracts.md](contracts.md) | The six JSON contracts between authoring, assets, compilation, rendering, and deck export |
| [studio.md](studio.md) | Local Studio server: adapter-hosted preview and schema-driven editing |
| [usage.md](usage.md) | Full `node bin/vf` CLI subcommand reference |
| [design-presets.md](design-presets.md) | `design-tokens.json` preset catalog for `vf compile --preset` |
| [motion-design-guide.md](motion-design-guide.md) | Motion grammar for commercial-grade 30s showcases: reveal/transition quality rules with sources |
| [deck-adapter.md](deck-adapter.md) | `render-manifest.json` to deck-factory `motion-manifest.json` conversion |

## History

Records kept for provenance; they describe earlier states of the engine, not the current one.

| Document | Covers |
|---|---|
| [history/v5-architecture.md](history/v5-architecture.md) | The original five-layer (L0-L4) architecture plan superseded by v6 |
| [history/build-journey.md](history/build-journey.md) | P0-P5 build journey: phase-by-phase proof results and gate evidence |

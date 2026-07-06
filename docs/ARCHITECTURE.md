# Architecture

The v1 plan uses five layers:

1. L0 contracts: scene specs, audio metadata, design tokens, versions, and render manifests.
2. L1 pipeline: brief to script to assets to compile to render.
3. L2 compiler: deterministic HTML composition generation and render lint.
4. L3 studio: adapter-hosted preview and schema-driven editing.
5. L4 gates and packaging: `vf gate`, CI, regression fixtures, and future skill packaging.

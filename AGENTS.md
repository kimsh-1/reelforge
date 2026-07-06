# AGENTS.md

This repository is designed for Codex-driven implementation and testing.

## Commands

- Install: `npm ci`
- List gates: `node bin/vf gate list`
- Replay migrated P0 evidence: `npm run gate`
- Execute a PoC gate: `node bin/vf gate p0b --execute`
- Lint local JSON and README section keys: `npm run lint`
- Atomic JSON write stub: `printf '{"ok":true}' | node bin/vf write tmp/example.json`

## Gate Rules

- `vf gate` is the supervisor report path. Generated reports go to `reports/<id>-report.json`.
- Required report fields: `gate`, `pass`, `checks`, `inputSet`, `canonicalInputMerkleHash`, `evidenceHash`, `gateScriptHash`, `gitCommit`, `command`, `exitCode`, `startedAt`, `finishedAt`.
- P0 evidence is migrated under `poc/`. Default gate mode replays copied evidence; use `--execute` for expensive local reruns.

## Known Traps

- Worktrees and render outputs belong on ext4 under `~/`, not `/mnt/d`.
- Keep `hyperframes` pinned to `0.7.26`; do not use `npx hyperframes@latest`.
- Studio preview routes are not read-only by default. Use `createStudioApi(adapter)` or a restrictive proxy in later phases.
- Composition HTML is a read-only build artifact. Edit `scene_specs` and recompile.
- Word-level subtitle rendering was not proven in P0; only word extraction, monotonicity, duration consistency, and static CJK render were proven.

## E-Errata Migration Summary

- P0b orphan negative check now explicitly expects successful orphan render in hyperframes 0.7.26.
- P0c OCR and stress reproduction scripts live in `poc/scripts/p0c-ocr.mjs` and `poc/scripts/p0c-stress.mjs`.
- P0a determinism precheck now records render commands, both run logs, byte counts, hashes, and the equality result.

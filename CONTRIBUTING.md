# Contributing

Use `npm ci` before running local checks. Keep changes scoped, add or update gate fixtures when behavior changes, and never commit generated videos or unlicensed media.

Before opening a PR:

1. Run `npm run lint`.
2. Run `npm run gate` for the migrated P0 evidence replay.
3. Use `node bin/vf gate <id> --execute` only when you are intentionally refreshing PoC render evidence.

All new bundled assets need source, license, and redistribution notes in `THIRD_PARTY_LICENSES.md` or the relevant `PROVENANCE.md`.

# GSAP 3.14.2 — vendored runtime

- Package: `gsap@3.14.2` (official npm dist build, redistributed unmodified)
- License: GreenSock Standard "no charge" license — <https://gsap.com/standard-license>
  (the npm package ships no LICENSE file; the license is declared in its `package.json`)
- Source: <https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js>
- SHA-256: `c174bfce53a729418d57a8ad8625e7247c793a22fef8e2851e3cfa3de9cd8280`

This copy is the only GSAP the render pipeline uses. The compiler stages it into
`build/vendor/gsap.min.js` after verifying the hash against `vendor/vendor-checksums.json`,
so renders are fully offline and byte-identical across environments. Refresh or upgrade via
`node scripts/fetch-vendor.mjs` (updates file + checksum manifest together), then run the
full frame-regression suite before adopting a new version.

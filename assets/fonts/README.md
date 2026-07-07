# Fonts

This directory contains only OFL fonts that are required for deterministic Korean/CJK rendering tests and local examples.

Fetch or refresh the files with:

```bash
node scripts/fetch-fonts.mjs
```

Expected managed files:

| File | Purpose |
|---|---|
| `PretendardVariable.woff2` | Pretendard 1.3.9 official variable webfont from the npm CDN. |
| `Pretendard-OFL.txt` | Pretendard upstream OFL text and Reserved Font Name declarations. |
| `D2Coding.woff2` | D2Coding 1.3.2 regular webfont from a version-pinned webfont release. |
| `D2Coding-OFL.txt` | D2Coding webfont OFL text. |
| `D2Coding-NOTICE.md` | D2Coding NAVER copyright notice and webfont provenance. |
| `font-checksums.json` | Byte counts, SHA-256 hashes, source URLs, versions, and provenance. |

Policy:

1. Do not subset or convert RFN fonts under their reserved names.
2. Keep downloaded font files unmodified after fetching.
3. Keep each font's OFL license text and notice file beside the binary.
4. Refresh `font-checksums.json` whenever a font file or license file changes.

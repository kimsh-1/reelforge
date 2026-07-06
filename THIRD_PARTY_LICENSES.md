# Third-Party Licenses

## Runtime Dependencies

| Component | Use | License | Policy |
|---|---|---|---|
| hyperframes 0.7.26 | Local deterministic render engine | Apache-2.0 | Exact pinned npm dependency. Preserve notices. |
| edge-tts | Optional Python/pip Korean TTS path | LGPLv3 | Pip dependency only; no generated voice files are committed. Keep a local fallback because the service is unofficial. |
| faster-whisper | Future transcription/alignment path | MIT | Pin model/version in later phases before gate use. |

## Fonts

No production font files are committed under `assets/fonts/` in T3. Future OFL
fonts must include their OFL text and source URL. Pretendard and SUIT have
Reserved Font Name constraints, so only official unmodified builds may be
redistributed under their original names. Custom subset or converted builds must
be renamed.

## BGM and SFX

`assets/bgm/` is a placeholder only. Future BGM may use verified FreePD CC0
tracks or Incompetech CC-BY 4.0 tracks with the required credit text. SFX must
not be copied from the hyperframes npm package into this repository; use the npm
dependency at runtime unless a track-level redistribution license is proven.

## Explicitly Forbidden or Restricted

- MoneyPrinterTurbo bundled 29 tracks: forbidden, source unclear.
- short-video-maker bundled 31 tracks: do not redistribute; YAL terms prohibit standalone redistribution.
- hyperframes SFX 21 files: do not rebundle; Pixabay standalone redistribution is not granted.
- archive.org item named `freepd`: do not use as a bulk source because the audit found contamination.
- MusicGen: forbidden for this commercial-capable pipeline because weights are CC-BY-NC.
- Pexels keyless responses: not a default path; use an explicit key if adopted later.
- Coqui XTTS-v2: non-commercial/default commercial use blocked.
- Fish-Speech and F5-TTS official weights: excluded due to CC-BY-NC.

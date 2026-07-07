#!/usr/bin/env python3
import json
import os
import sys

from melo.api import TTS


def speaker_id(model, requested):
    speakers = getattr(getattr(model, "hps", None), "data", None)
    mapping = getattr(speakers, "spk2id", {}) if speakers is not None else {}
    if requested in mapping:
        return mapping[requested]
    if "KR" in mapping:
        return mapping["KR"]
    if mapping:
        return next(iter(mapping.values()))
    return 0


def main():
    payload = json.load(sys.stdin)
    output_path = payload["outputPath"]
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    model = TTS(language=payload.get("language", "KR"), device=payload.get("device", "cpu"))
    speaker = speaker_id(model, payload.get("speaker", "KR"))
    model.tts_to_file(
        payload["text"],
        speaker,
        output_path,
        speed=float(payload.get("speed", 1.0)),
    )

    if not os.path.exists(output_path) or os.path.getsize(output_path) <= 0:
        raise RuntimeError(f"MeloTTS did not create output: {output_path}")
    json.dump({"provider": "melotts-korean", "voice": payload.get("speaker", "KR")}, sys.stdout)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
import json
import sys

from faster_whisper import WhisperModel


def main():
    payload = json.load(sys.stdin)
    model = WhisperModel(
        payload.get("model", "base"),
        device=payload.get("device", "cpu"),
        compute_type=payload.get("computeType", "int8"),
    )
    segments, _info = model.transcribe(
        payload["audioPath"],
        language=payload.get("language", "ko"),
        word_timestamps=True,
        vad_filter=False,
    )

    words = []
    for segment in segments:
        for item in segment.words or []:
            word = str(item.word or "").strip()
            if not word:
                continue
            words.append(
                {
                    "word": word,
                    "start": round(float(item.start or 0), 3),
                    "end": round(float(item.end or item.start or 0), 3),
                }
            )

    if not words:
        raise RuntimeError("faster-whisper returned no word timestamps")
    json.dump({"provider": "faster-whisper", "words": words}, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()

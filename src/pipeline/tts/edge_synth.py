#!/usr/bin/env python3
import asyncio
import json
import sys

import edge_tts


TICKS_PER_SECOND = 10_000_000


def seconds(value):
    return float(value or 0) / TICKS_PER_SECOND


async def synthesize(payload):
    text = payload["text"]
    output_path = payload["outputPath"]
    voice = payload["voice"]
    communicate = edge_tts.Communicate(
        text,
        voice,
        rate=payload.get("rate", "+0%"),
        pitch=payload.get("pitch", "+0Hz"),
        volume=payload.get("volume", "+0%"),
        boundary="WordBoundary",
    )

    byte_count = 0
    words = []
    with open(output_path, "wb") as audio_file:
        async for chunk in communicate.stream():
            chunk_type = chunk.get("type")
            if chunk_type == "audio":
                data = chunk.get("data") or b""
                byte_count += len(data)
                audio_file.write(data)
            elif chunk_type == "WordBoundary":
                word = str(chunk.get("text") or "").strip()
                if not word:
                    continue
                start = seconds(chunk.get("offset"))
                end = start + seconds(chunk.get("duration"))
                words.append({"word": word, "start": round(start, 3), "end": round(end, 3)})

    if byte_count <= 0:
        raise RuntimeError("edge-tts returned no audio bytes")
    if not words:
        raise RuntimeError("edge-tts returned no WordBoundary events; boundary=WordBoundary is required")
    return {"provider": "edge-tts", "voice": voice, "words": words, "bytes": byte_count}


def main():
    payload = json.load(sys.stdin)
    result = asyncio.run(synthesize(payload))
    json.dump(result, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()

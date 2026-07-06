#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const reportPath = path.join(root, "reports", "p0c-stress.json");
const outDir = path.join(root, "out", "p0c-stress");

const lines = Array.from({ length: 20 }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  return `스트레스 테스트 ${number}번 문장입니다. 네 개씩 묶어 합성하고 워드 경계를 기록합니다.`;
});

function runStress() {
  const python = existsSync(path.join(root, ".venv-tts", "bin", "python"))
    ? path.join(root, ".venv-tts", "bin", "python")
    : "python3";
  const script = `
import asyncio
import json
import pathlib
import resource
import subprocess
import time

lines = ${JSON.stringify(lines)}
root = pathlib.Path(${JSON.stringify(root)})
out_dir = pathlib.Path(${JSON.stringify(outDir)})
out_dir.mkdir(parents=True, exist_ok=True)
voice = "ko-KR-SunHiNeural"
boundary = "WordBoundary"
concurrency = 4

try:
    import edge_tts
except Exception as exc:
    print(json.dumps({"pass": False, "error": f"edge_tts import failed: {exc}"}, ensure_ascii=False))
    raise SystemExit(0)

async def synth(index, text, sem):
    started = time.perf_counter()
    path = out_dir / f"line-{index:02d}.mp3"
    words = []
    try:
        async with sem:
            communicate = edge_tts.Communicate(text, voice, boundary=boundary)
            with path.open("wb") as audio:
                async for chunk in communicate.stream():
                    ctype = chunk.get("type")
                    if ctype == "audio":
                        audio.write(chunk.get("data", b""))
                    elif ctype == boundary:
                        words.append(chunk)
        duration = None
        probe = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            text=True,
            capture_output=True,
        )
        if probe.returncode == 0:
            duration = float(probe.stdout.strip())
        return {
            "index": index,
            "path": str(path.relative_to(root)),
            "success": True,
            "bytes": path.stat().st_size,
            "durationSec": duration,
            "wordBoundaries": len(words),
            "elapsedSec": round(time.perf_counter() - started, 3),
        }
    except Exception as exc:
        text = str(exc)
        return {
            "index": index,
            "path": str(path.relative_to(root)),
            "success": False,
            "error": text,
            "httpStatus": 403 if "403" in text else 429 if "429" in text else None,
            "elapsedSec": round(time.perf_counter() - started, 3),
        }

async def main():
    started = time.perf_counter()
    sem = asyncio.Semaphore(concurrency)
    results = await asyncio.gather(*[synth(i + 1, line, sem) for i, line in enumerate(lines)])
    failures = [row for row in results if not row.get("success")]
    http = [row for row in failures if row.get("httpStatus") in (403, 429)]
    report = {
        "provider": "edge-tts",
        "voice": voice,
        "boundary": boundary,
        "concurrency": concurrency,
        "total": len(lines),
        "successes": len(results) - len(failures),
        "failures": len(failures),
        "http429or403": http,
        "elapsedSec": round(time.perf_counter() - started, 3),
        "peakRssBytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * 1024,
        "results": results,
    }
    report["pass"] = report["total"] == 20 and report["successes"] == 20 and report["failures"] == 0 and not http
    print(json.dumps(report, ensure_ascii=False))

asyncio.run(main())
`;
  return spawnSync(python, ["-c", script], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
}

mkdirSync(outDir, { recursive: true });
mkdirSync(path.dirname(reportPath), { recursive: true });
const result = runStress();
let report;
try {
  report = JSON.parse(result.stdout || "{}");
} catch (error) {
  report = {
    pass: false,
    provider: "edge-tts",
    error: `stress JSON parse failed: ${error.message}`,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.status
  };
}
if (result.status !== 0) {
  report.pass = false;
  report.exitCode = result.status;
  report.stderr = result.stderr;
}
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.exitCode = report.pass ? 0 : 1;

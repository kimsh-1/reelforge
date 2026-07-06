#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const reportPath = path.join(root, "reports", "p0c-ocr.json");
const frames = ["out/p0c-frames/mid.png", "out/p0c-frames/random-01.png", "out/p0c-frames/random-02.png"];
const expected = ["영상공장가동", "모든자막은실제음성에맞춰정렬됩니다"];

function normalize(value) {
  return String(value).replace(/\s+/g, "").replace(/[^\p{Letter}\p{Number}]/gu, "");
}

function runEasyOcr() {
  const python = existsSync(path.join(root, ".venv-tts", "bin", "python"))
    ? path.join(root, ".venv-tts", "bin", "python")
    : "python3";
  const script = `
import json
import pathlib
import sys

frames = ${JSON.stringify(frames)}
try:
    import easyocr
except Exception as exc:
    print(json.dumps({"ok": False, "error": f"easyocr import failed: {exc}"}))
    raise SystemExit(0)

reader = easyocr.Reader(["ko", "en"], gpu=False)
rows = []
for frame in frames:
    path = pathlib.Path(frame)
    if not path.exists():
        rows.append({"frame": frame, "error": "missing"})
        continue
    result = reader.readtext(str(path), detail=0, paragraph=False)
    rows.append({"frame": frame, "texts": [str(x) for x in result]})
print(json.dumps({"ok": True, "frames": rows}, ensure_ascii=False))
`;
  return spawnSync(python, ["-c", script], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
}

function buildReport(result) {
  const parsed = (() => {
    try {
      return JSON.parse(result.stdout || "{}");
    } catch (error) {
      return { ok: false, error: `OCR JSON parse failed: ${error.message}`, stdout: result.stdout };
    }
  })();

  if (result.status !== 0 || parsed.ok !== true) {
    return {
      method: "easyocr",
      pass: false,
      measured: {
        expected,
        command: result.spawnargs?.join(" ") ?? null,
        exitCode: result.status,
        stderr: result.stderr,
        error: parsed.error ?? result.error?.message ?? null,
        frames: frames.map((frame) => ({
          frame,
          exists: existsSync(path.join(root, frame)),
          bytes: existsSync(path.join(root, frame)) ? statSync(path.join(root, frame)).size : 0
        }))
      }
    };
  }

  const measuredFrames = parsed.frames.map((frame) => {
    const texts = Array.isArray(frame.texts) ? frame.texts : [];
    const normalized = normalize(texts.join(""));
    const found = {
      [expected[0]]: normalized.includes(expected[0]),
      [expected[1]]: normalized.includes(expected[1]),
      headlineHead: normalized.includes("영상공장"),
      subtitleHead: normalized.includes("모든자막은실제음성")
    };
    return {
      frame: frame.frame,
      texts,
      normalized,
      found,
      pass: found[expected[0]] === true && found.headlineHead === true && found.subtitleHead === true
    };
  });

  return {
    method: "easyocr",
    pass: measuredFrames.length === frames.length && measuredFrames.every((frame) => frame.pass === true),
    measured: {
      expected,
      frames: measuredFrames
    }
  };
}

mkdirSync(path.dirname(reportPath), { recursive: true });
const report = buildReport(runEasyOcr());
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.exitCode = report.pass ? 0 : 1;

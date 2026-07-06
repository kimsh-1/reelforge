#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const fixtureDir = path.join(root, "fixtures", "p0c");
const reportPath = path.join(root, "reports", "P0c-report.json");
const startedAt = new Date().toISOString();
const command = ["node", ...process.argv.slice(1)].join(" ");
const narrationText = "영상 공장이 가동을 시작했습니다.\n모든 자막은 실제 음성에 맞춰 정렬됩니다.";

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sha256File(filePath) {
  return sha256Bytes(readFileSync(filePath));
}

function listFilesRecursive(dir) {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function hashInputDir(dir) {
  const files = listFilesRecursive(dir);
  const hash = createHash("sha256");
  for (const file of files) {
    const rel = path.relative(dir, file).split(path.sep).join("/");
    const bytes = readFileSync(file);
    hash.update(rel);
    hash.update("\0");
    hash.update(String(bytes.length));
    hash.update("\0");
    hash.update(bytes);
    hash.update("\0");
  }
  return hash.digest("hex");
}

function readJson(relPath) {
  const filePath = path.join(root, relPath);
  try {
    return { ok: true, value: JSON.parse(readFileSync(filePath, "utf8")) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function checkTtsWords() {
  const metaResult = readJson("fixtures/p0c/audio_meta.json");
  if (!metaResult.ok) {
    return { id: "tts-words-valid", pass: false, measured: { error: metaResult.error } };
  }

  const meta = metaResult.value;
  const scene = Array.isArray(meta.scenes) ? meta.scenes.find((item) => item.sceneId === "s01") : null;
  const expectedHash = sha256Bytes(Buffer.from(narrationText, "utf8"));
  const audioPath = scene?.audioPath ? path.join(fixtureDir, scene.audioPath) : null;
  const words = Array.isArray(scene?.words) ? scene.words : [];
  const invalidWords = [];
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    const previous = words[index - 1];
    if (
      typeof word?.word !== "string" ||
      word.word.length === 0 ||
      !finiteNumber(word.start) ||
      !finiteNumber(word.end) ||
      word.end < word.start ||
      (previous && word.start < previous.start)
    ) {
      invalidWords.push({ index, word });
    }
  }

  const lastEnd = words.length > 0 ? words[words.length - 1].end : null;
  const pass =
    scene !== null &&
    existsSync(audioPath) &&
    statSync(audioPath).size > 0 &&
    finiteNumber(scene.audioDurationSec) &&
    words.length > 0 &&
    invalidWords.length === 0 &&
    scene.sourceHash === expectedHash &&
    finiteNumber(lastEnd) &&
    lastEnd <= scene.audioDurationSec + 0.5;

  return {
    id: "tts-words-valid",
    pass,
    measured: {
      audioPath: scene?.audioPath ?? null,
      audioBytes: audioPath && existsSync(audioPath) ? statSync(audioPath).size : 0,
      audioDurationSec: scene?.audioDurationSec ?? null,
      wordCount: words.length,
      firstWord: words[0] ?? null,
      lastWord: words[words.length - 1] ?? null,
      invalidWords,
      expectedSourceHash: expectedHash,
      actualSourceHash: scene?.sourceHash ?? null,
      boundary: meta.tts?.boundary ?? null,
      voice: meta.tts?.voice ?? null
    }
  };
}

function checkFontEmbeddedRender() {
  const htmlPath = path.join(root, "fixtures", "p0c", "index.html");
  const fontPath = path.join(root, "fixtures", "p0c", "fonts", "PretendardVariable.woff2");
  const integrityResult = readJson("fixtures/p0c/fonts/font-integrity.json");
  const mp4Path = path.join(root, "out", "p0c.mp4");
  const framePaths = ["out/p0c-frames/mid.png", "out/p0c-frames/random-01.png", "out/p0c-frames/random-02.png"].map((entry) =>
    path.join(root, entry)
  );

  const html = existsSync(htmlPath) ? readFileSync(htmlPath, "utf8") : "";
  const actualFontHash = existsSync(fontPath) ? sha256File(fontPath) : null;
  const frameEvidence = framePaths.map((frame) => ({
    path: path.relative(root, frame).split(path.sep).join("/"),
    exists: existsSync(frame),
    bytes: existsSync(frame) ? statSync(frame).size : 0
  }));

  const pass =
    html.includes("@font-face") &&
    html.includes("Pretendard") &&
    html.includes("PretendardVariable.woff2") &&
    integrityResult.ok &&
    integrityResult.value.sha256 === actualFontHash &&
    existsSync(mp4Path) &&
    statSync(mp4Path).size > 0 &&
    frameEvidence.every((frame) => frame.exists && frame.bytes > 0);

  return {
    id: "font-embedded-render",
    pass,
    measured: {
      fontPath: "fixtures/p0c/fonts/PretendardVariable.woff2",
      fontBytes: existsSync(fontPath) ? statSync(fontPath).size : 0,
      expectedSha256: integrityResult.ok ? integrityResult.value.sha256 : null,
      actualSha256: actualFontHash,
      sourceUrl: integrityResult.ok ? integrityResult.value.sourceUrl : null,
      htmlReferencesFont: html.includes("PretendardVariable.woff2"),
      mp4Bytes: existsSync(mp4Path) ? statSync(mp4Path).size : 0,
      frameEvidence
    }
  };
}

function checkOcrPositive() {
  const result = readJson("reports/p0c-ocr.json");
  if (!result.ok) {
    return { id: "ocr-positive", pass: false, measured: { error: result.error } };
  }

  const report = result.value;
  return {
    id: "ocr-positive",
    pass: report.pass === true,
    measured: {
      method: report.method ?? null,
      note: report.measured?.note ?? null,
      frames: report.measured?.frames ?? []
    }
  };
}

function probeMp4() {
  const mp4Path = path.join(root, "out", "p0c.mp4");
  if (!existsSync(mp4Path) || statSync(mp4Path).size === 0) {
    return { id: "av-duration-match", pass: false, measured: { error: "out/p0c.mp4 missing or empty" } };
  }

  const metaResult = readJson("fixtures/p0c/audio_meta.json");
  const expectedDuration = metaResult.ok ? metaResult.value.scenes?.[0]?.audioDurationSec : null;
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "stream=index,codec_type,codec_name",
      "-show_entries",
      "format=duration",
      "-of",
      "json",
      mp4Path
    ],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    return {
      id: "av-duration-match",
      pass: false,
      measured: { error: "ffprobe failed", status: result.status, stderr: result.stderr.trim() }
    };
  }

  let probe;
  try {
    probe = JSON.parse(result.stdout);
  } catch (error) {
    return {
      id: "av-duration-match",
      pass: false,
      measured: { error: `ffprobe JSON parse failed: ${error.message}`, stdout: result.stdout }
    };
  }

  const streams = Array.isArray(probe.streams) ? probe.streams : [];
  const audioTracks = streams.filter((stream) => stream.codec_type === "audio");
  const videoTracks = streams.filter((stream) => stream.codec_type === "video");
  const duration = Number.parseFloat(probe.format?.duration ?? "NaN");
  const delta = finiteNumber(duration) && finiteNumber(expectedDuration) ? Math.abs(duration - expectedDuration) : null;
  const pass = audioTracks.length > 0 && videoTracks.length > 0 && delta !== null && delta <= 0.3;

  return {
    id: "av-duration-match",
    pass,
    measured: {
      path: "out/p0c.mp4",
      expectedAudioDurationSec: expectedDuration,
      containerDurationSec: Number.isFinite(duration) ? duration : null,
      deltaSec: delta,
      durationToleranceSec: 0.3,
      hasAudioTrack: audioTracks.length > 0,
      audioTrackCount: audioTracks.length,
      videoTrackCount: videoTracks.length,
      streams
    }
  };
}

function checkStress() {
  const result = readJson("reports/p0c-stress.json");
  if (!result.ok) {
    return { id: "stress-20-lines", pass: false, measured: { error: result.error } };
  }

  const report = result.value;
  const httpFailures = Array.isArray(report.http429or403) ? report.http429or403 : [];
  const pass =
    report.pass === true &&
    report.total === 20 &&
    report.successes === 20 &&
    report.failures === 0 &&
    report.concurrency === 4 &&
    httpFailures.length === 0 &&
    finiteNumber(report.elapsedSec) &&
    Number.isInteger(report.peakRssBytes) &&
    report.peakRssBytes > 0;

  return {
    id: "stress-20-lines",
    pass,
    measured: {
      provider: report.provider ?? null,
      voice: report.voice ?? null,
      boundary: report.boundary ?? null,
      concurrency: report.concurrency ?? null,
      total: report.total ?? null,
      successes: report.successes ?? null,
      failures: report.failures ?? null,
      http429or403: httpFailures,
      elapsedSec: report.elapsedSec ?? null,
      peakRssBytes: report.peakRssBytes ?? null
    }
  };
}

function evidence(paths) {
  const entries = [];
  for (const entryPath of paths) {
    const fullPath = path.join(root, entryPath);
    if (!existsSync(fullPath)) continue;
    if (statSync(fullPath).isDirectory()) {
      for (const file of listFilesRecursive(fullPath)) {
        entries.push({
          path: path.relative(root, file).split(path.sep).join("/"),
          sha256: sha256File(file)
        });
      }
    } else {
      entries.push({ path: entryPath, sha256: sha256File(fullPath) });
    }
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

let checks = [];
let exitCode = 1;
try {
  checks = [checkTtsWords(), checkFontEmbeddedRender(), checkOcrPositive(), probeMp4(), checkStress()];
  const pass = checks.every((check) => check.pass === true);
  exitCode = pass ? 0 : 1;

  const report = {
    gate: "P0c",
    pass,
    checks,
    inputHash: existsSync(fixtureDir) ? hashInputDir(fixtureDir) : null,
    evidence: evidence([
      "fixtures/p0c",
      "out/p0c.mp4",
      "out/p0c-frames",
      "reports/p0c-ocr.json",
      "reports/p0c-stress.json",
      "scripts/gate-p0c.mjs",
      "package.json",
      "package-lock.json"
    ]),
    command,
    exitCode,
    startedAt,
    finishedAt: new Date().toISOString()
  };

  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  const failedReport = {
    gate: "P0c",
    pass: false,
    checks: [
      ...checks,
      {
        id: "gate-runner-error",
        pass: false,
        measured: { error: error instanceof Error ? error.message : String(error) }
      }
    ],
    inputHash: existsSync(fixtureDir) ? hashInputDir(fixtureDir) : null,
    evidence: evidence(["fixtures/p0c", "out/p0c.mp4", "reports/p0c-ocr.json", "reports/p0c-stress.json", "scripts/gate-p0c.mjs"]),
    command,
    exitCode,
    startedAt,
    finishedAt: new Date().toISOString()
  };
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(failedReport, null, 2)}\n`);
}

process.exitCode = exitCode;

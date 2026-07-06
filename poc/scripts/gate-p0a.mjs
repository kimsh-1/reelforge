#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const reportPath = path.join(root, "reports", "P0a-report.json");
const startedAt = new Date().toISOString();
const command = ["node", ...process.argv.slice(1)].join(" ");

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
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

function readDoctor(filePath) {
  if (!existsSync(filePath)) {
    return {
      pass: false,
      measured: { error: "reports/doctor.json not found" }
    };
  }
  let doctor;
  try {
    doctor = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    return {
      pass: false,
      measured: { error: `doctor JSON parse failed: ${error.message}` }
    };
  }

  const checks = Array.isArray(doctor.checks) ? doctor.checks : [];
  const required = new Set(["Node.js", "CPU", "Memory", "Disk", "/dev/shm", "Environment", "FFmpeg", "FFprobe", "Chrome"]);
  const byName = new Map(checks.map((check) => [check.name, check]));
  const missingRequired = [...required].filter((name) => !byName.has(name));
  const fatalFailures = checks
    .filter((check) => required.has(check.name) && check.ok !== true)
    .map((check) => ({ name: check.name, detail: check.detail ?? null, hint: check.hint ?? null }));
  const nonFatalFailures = checks
    .filter((check) => !required.has(check.name) && check.ok !== true)
    .map((check) => ({ name: check.name, detail: check.detail ?? null, hint: check.hint ?? null }));

  return {
    pass: missingRequired.length === 0 && fatalFailures.length === 0,
    measured: {
      doctorOk: doctor.ok === true,
      required: [...required],
      missingRequired,
      fatalFailures,
      nonFatalFailures
    }
  };
}

function probeMp4(filePath) {
  if (!existsSync(filePath) || statSync(filePath).size === 0) {
    return {
      pass: false,
      measured: { error: "out/p0a.mp4 missing or empty" }
    };
  }

  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "stream=index,codec_type,codec_name,pix_fmt",
      "-show_entries",
      "format=duration",
      "-of",
      "json",
      filePath
    ],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    return {
      pass: false,
      measured: {
        error: "ffprobe failed",
        status: result.status,
        stderr: result.stderr.trim()
      }
    };
  }

  let probe;
  try {
    probe = JSON.parse(result.stdout);
  } catch (error) {
    return {
      pass: false,
      measured: { error: `ffprobe JSON parse failed: ${error.message}`, stdout: result.stdout }
    };
  }

  const streams = Array.isArray(probe.streams) ? probe.streams : [];
  const video = streams.find((stream) => stream.codec_type === "video") ?? null;
  const audioTracks = streams.filter((stream) => stream.codec_type === "audio");
  const duration = Number.parseFloat(probe.format?.duration ?? "NaN");
  const pass =
    video?.codec_name === "h264" &&
    video?.pix_fmt === "yuv420p" &&
    Number.isFinite(duration) &&
    Math.abs(duration - 5.0) <= 0.3;

  return {
    pass,
    measured: {
      codec: video?.codec_name ?? null,
      pix_fmt: video?.pix_fmt ?? null,
      duration,
      durationToleranceSec: 0.3,
      audioTrackCount: audioTracks.length,
      hasAudioTrack: audioTracks.length > 0,
      streams
    }
  };
}

function readAtomHeader(buffer, offset) {
  if (offset + 8 > buffer.length) return null;
  let size = buffer.readUInt32BE(offset);
  const type = buffer.toString("ascii", offset + 4, offset + 8);
  let headerSize = 8;
  if (size === 1) {
    if (offset + 16 > buffer.length) return null;
    const extended = buffer.readBigUInt64BE(offset + 8);
    if (extended > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    size = Number(extended);
    headerSize = 16;
  } else if (size === 0) {
    size = buffer.length - offset;
  }
  if (size < headerSize || offset + size > buffer.length) return null;
  return { type, offset, size };
}

function inspectFaststart(filePath) {
  if (!existsSync(filePath)) {
    return { pass: false, measured: { error: "out/p0a.mp4 not found" } };
  }
  const buffer = readFileSync(filePath);
  let offset = 0;
  let moov = null;
  let mdat = null;
  while (offset + 8 <= buffer.length) {
    const atom = readAtomHeader(buffer, offset);
    if (!atom) break;
    if (atom.type === "moov" && moov === null) moov = atom;
    if (atom.type === "mdat" && mdat === null) mdat = atom;
    offset += atom.size;
  }
  const pass = moov !== null && mdat !== null && moov.offset < mdat.offset;
  return {
    pass,
    measured: {
      moovOffset: moov?.offset ?? null,
      mdatOffset: mdat?.offset ?? null,
      fileSize: buffer.length,
      method: "top-level MP4 atom scan"
    }
  };
}

function evidence(paths) {
  return paths
    .filter((entryPath) => existsSync(path.join(root, entryPath)))
    .map((entryPath) => ({
      path: entryPath,
      sha256: sha256File(path.join(root, entryPath))
    }));
}

let checks = [];
let exitCode = 1;
try {
  const doctor = readDoctor(path.join(root, "reports", "doctor.json"));
  const mp4Path = path.join(root, "out", "p0a.mp4");
  const mp4Exists = existsSync(mp4Path) && statSync(mp4Path).size > 0;
  const ffprobe = probeMp4(mp4Path);
  const faststart = inspectFaststart(mp4Path);

  checks = [
    { id: "doctor-critical", pass: doctor.pass, measured: doctor.measured },
    {
      id: "mp4-exists",
      pass: mp4Exists,
      measured: {
        path: "out/p0a.mp4",
        bytes: mp4Exists ? statSync(mp4Path).size : 0
      }
    },
    { id: "ffprobe-profile", pass: ffprobe.pass, measured: ffprobe.measured },
    { id: "faststart", pass: faststart.pass, measured: faststart.measured }
  ];
  const pass = checks.every((check) => check.pass === true);
  exitCode = pass ? 0 : 1;

  const report = {
    gate: "P0a",
    pass,
    checks,
    inputHash: hashInputDir(path.join(root, "fixtures", "p0a")),
    evidence: evidence([
      "fixtures/p0a/index.html",
      "reports/doctor.json",
      "out/p0a.mp4",
      "scripts/gate-p0a.mjs",
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
    gate: "P0a",
    pass: false,
    checks: [
      ...checks,
      {
        id: "gate-runner-error",
        pass: false,
        measured: { error: error instanceof Error ? error.message : String(error) }
      }
    ],
    inputHash: existsSync(path.join(root, "fixtures", "p0a")) ? hashInputDir(path.join(root, "fixtures", "p0a")) : null,
    evidence: evidence(["reports/doctor.json", "out/p0a.mp4", "scripts/gate-p0a.mjs"]),
    command,
    exitCode,
    startedAt,
    finishedAt: new Date().toISOString()
  };
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(failedReport, null, 2)}\n`);
}

process.exitCode = exitCode;

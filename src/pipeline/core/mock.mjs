import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { ensureDir, normalizeRelPath, readJsonFile, writeJsonViaVf } from "./io.mjs";

function sha256Text(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function splitWords(text) {
  const words = String(text ?? "")
    .trim()
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  return words.length > 0 ? words : ["silence"];
}

function estimatedDuration(words) {
  const weighted = words.reduce((sum, word) => sum + Math.max(0.24, Math.min(0.58, word.length * 0.055 + 0.18)), 0);
  return Math.max(1.2, Math.min(12, weighted + Math.max(0.35, words.length * 0.08)));
}

function runFfmpeg(args) {
  const result = spawnSync("ffmpeg", args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed\n${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim());
  }
}

function probeDuration(filePath) {
  const result = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", filePath],
    { encoding: "utf8" }
  );
  if (result.status !== 0) return null;
  const value = Number(result.stdout.trim());
  return Number.isFinite(value) && value > 0 ? value : null;
}

function writeSilentMp3(filePath, durationSec) {
  ensureDir(path.dirname(filePath));
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp.mp3`;
  runFfmpeg([
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=r=24000:cl=mono",
    "-t",
    String(durationSec),
    "-codec:a",
    "libmp3lame",
    "-b:a",
    "64k",
    "-y",
    tmpPath
  ]);
  renameSync(tmpPath, filePath);
}

function syntheticWords(words, durationSec) {
  const usableStart = Math.min(0.16, Math.max(0, durationSec * 0.08));
  const usableEnd = Math.max(usableStart + 0.1, durationSec - 0.28);
  const totalWeight = words.reduce((sum, word) => sum + Math.max(1, word.length), 0);
  const totalGap = Math.min(0.08, (usableEnd - usableStart) / Math.max(1, words.length * 5));
  const speechSpan = Math.max(0.1, usableEnd - usableStart - totalGap * Math.max(0, words.length - 1));
  let cursor = usableStart;
  return words.map((word, index) => {
    const weight = Math.max(1, word.length);
    const rawDuration = speechSpan * (weight / totalWeight);
    const end = index === words.length - 1 ? usableEnd : Math.min(usableEnd, cursor + Math.max(0.18, rawDuration));
    const item = {
      word,
      start: Number(cursor.toFixed(3)),
      end: Number(Math.max(cursor, end).toFixed(3))
    };
    cursor = end + totalGap;
    return item;
  });
}

export function runMockTtsStep(ctx) {
  const specs = readJsonFile(path.join(ctx.projectDir, "scene_specs.json"));
  const audioDir = path.join(ctx.projectDir, "assets", "audio");
  ensureDir(audioDir);

  const scenes = (specs.scenes ?? []).map((scene) => {
    const words = splitWords(scene.narration_tts);
    const targetDuration = estimatedDuration(words);
    const fileName = `${scene.sceneId}.mock.mp3`;
    const audioPath = path.join(audioDir, fileName);
    writeSilentMp3(audioPath, targetDuration);
    const actualDuration = Number((probeDuration(audioPath) ?? targetDuration).toFixed(3));
    return {
      sceneId: scene.sceneId,
      audioPath: `./assets/audio/${fileName}`,
      audioDurationSec: actualDuration,
      words: syntheticWords(words, actualDuration),
      sourceHash: sha256Text(scene.narration_tts),
      provider: "mock-tts:ffmpeg-anullsrc",
      voice: "ko-KR-mock-neutral"
    };
  });

  const audioMeta = { scenes };
  writeJsonViaVf({
    repoRoot: ctx.repoRoot,
    projectDir: ctx.projectDir,
    filePath: path.join(ctx.projectDir, "audio_meta.json"),
    schemaName: "audio-meta",
    data: audioMeta
  });

  return {
    provider: "mock-tts",
    scenes: scenes.length,
    files: scenes.map((scene) => scene.audioPath)
  };
}

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function writeSolidPng(filePath, { width = 640, height = 360, rgb }) {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const row = Buffer.alloc(1 + width * 3);
  row[0] = 0;
  for (let index = 0; index < width; index += 1) {
    row[1 + index * 3] = rgb[0];
    row[2 + index * 3] = rgb[1];
    row[3 + index * 3] = rgb[2];
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const idat = zlib.deflateSync(raw, { level: 9 });
  const png = Buffer.concat([
    header,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0))
  ]);

  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, png);
}

function sceneColor(sceneId, index) {
  const digest = createHash("sha256").update(`${sceneId}:${index}`).digest();
  return [64 + (digest[0] % 128), 64 + (digest[1] % 128), 64 + (digest[2] % 128)];
}

function nextGen(entries) {
  const max = entries.reduce((value, entry) => {
    const match = /^gen_(\d+)$/.exec(entry?.gen ?? "");
    return match ? Math.max(value, Number(match[1])) : value;
  }, 0);
  return `gen_${String(max + 1).padStart(2, "0")}`;
}

export function runMockImagesStep(ctx) {
  const specs = readJsonFile(path.join(ctx.projectDir, "scene_specs.json"));
  const versionsPath = path.join(ctx.projectDir, "versions.json");
  const versions = existsSync(versionsPath)
    ? readJsonFile(versionsPath)
    : { resources: {}, editLock: null, dirty: false };
  versions.resources = versions.resources ?? {};
  versions.editLock = versions.editLock ?? null;
  versions.dirty = Boolean(versions.dirty);

  const imageDir = path.join(ctx.projectDir, "assets", "images");
  ensureDir(imageDir);
  const now = new Date().toISOString();
  const files = [];

  (specs.scenes ?? []).forEach((scene, index) => {
    const fileName = `${scene.sceneId}.mock.png`;
    const relPath = `./assets/images/${fileName}`;
    const absPath = path.join(imageDir, fileName);
    writeSolidPng(absPath, { rgb: sceneColor(scene.sceneId, index) });
    files.push(relPath);

    const resourceType = `image_${scene.sceneId}`;
    const history = versions.resources[resourceType] ?? { entries: [], selected: null };
    const entries = Array.isArray(history.entries) ? history.entries : [];
    const existing = entries.find((entry) => entry.path === relPath);
    const gen = existing?.gen ?? nextGen(entries);
    if (!existing) {
      entries.push({
        gen,
        path: relPath,
        createdAt: now,
        note: "mock image profile solid PNG"
      });
    }
    versions.resources[resourceType] = {
      entries,
      selected: gen
    };
  });

  writeJsonViaVf({
    repoRoot: ctx.repoRoot,
    projectDir: ctx.projectDir,
    filePath: versionsPath,
    schemaName: "versions",
    data: versions
  });

  return {
    provider: "mock-images",
    scenes: specs.scenes?.length ?? 0,
    files: files.map((file) => normalizeRelPath(file))
  };
}

export function runRealPassthroughStep(ctx, label, requiredFile) {
  const abs = path.join(ctx.projectDir, requiredFile);
  if (!existsSync(abs)) {
    throw new Error(`${label} real profile adapter is not registered and ${requiredFile} does not exist`);
  }
  return {
    provider: "real-passthrough",
    file: requiredFile,
    bytes: readFileSync(abs).length
  };
}

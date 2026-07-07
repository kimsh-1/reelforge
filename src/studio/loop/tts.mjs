import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, renameSync } from "node:fs";
import path from "node:path";
import {
  ensureDir,
  readJsonFile,
  writeJsonViaVf
} from "../../pipeline/core/io.mjs";

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

function assertSceneIds(specs, sceneIds) {
  if (!Array.isArray(sceneIds) || sceneIds.length === 0) {
    throw new Error("sceneIds must contain at least one sceneId");
  }
  const known = new Set((specs.scenes ?? []).map((scene) => scene.sceneId));
  const invalid = sceneIds.filter((sceneId) => !known.has(sceneId));
  if (invalid.length > 0) throw new Error(`unknown sceneIds: ${invalid.join(", ")}`);
  return [...new Set(sceneIds)];
}

function mockSceneAudio(projectDir, scene) {
  if (!/^[A-Za-z0-9_-]+$/.test(scene.sceneId)) {
    throw new Error(`unsupported sceneId for audio filename: ${scene.sceneId}`);
  }
  const words = splitWords(scene.narration_tts);
  const targetDuration = estimatedDuration(words);
  const fileName = `${scene.sceneId}.mock.mp3`;
  const audioPath = path.join(projectDir, "assets", "audio", fileName);
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
}

export function runStudioTtsStep({ repoRoot, projectDir, profile = "mock", sceneIds }) {
  if (profile !== "mock") {
    throw new Error("studio selective TTS currently supports profile=mock");
  }

  const specs = readJsonFile(path.join(projectDir, "scene_specs.json"));
  const selectedSceneIds = assertSceneIds(specs, sceneIds);
  const selected = new Set(selectedSceneIds);
  const audioMetaPath = path.join(projectDir, "audio_meta.json");
  const existingMeta = existsSync(audioMetaPath) ? readJsonFile(audioMetaPath) : { scenes: [] };
  const existingById = new Map((existingMeta.scenes ?? []).map((scene) => [scene.sceneId, scene]));
  const generated = [];

  const scenes = (specs.scenes ?? []).map((scene) => {
    if (!selected.has(scene.sceneId) && existingById.has(scene.sceneId)) return existingById.get(scene.sceneId);
    const next = mockSceneAudio(projectDir, scene);
    generated.push(scene.sceneId);
    return next;
  });

  const audioMeta = { scenes };
  writeJsonViaVf({
    repoRoot,
    projectDir,
    filePath: audioMetaPath,
    schemaName: "audio-meta",
    data: audioMeta
  });

  return {
    provider: "mock-tts",
    scenes: scenes.length,
    generated,
    reused: scenes.length - generated.length,
    files: scenes.filter((scene) => selected.has(scene.sceneId)).map((scene) => scene.audioPath)
  };
}

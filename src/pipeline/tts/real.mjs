import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { ensureDir, normalizeRelPath, readJsonFile, writeJsonViaVf } from "../core/io.mjs";
import { loadTtsConfig } from "./config.mjs";
import { createDefaultProviders, isRetryableTtsError, TtsProviderError } from "./providers.mjs";

const ttsDir = path.dirname(fileURLToPath(import.meta.url));

function sha256Text(value) {
  return createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

function safeSceneId(sceneId) {
  return String(sceneId).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function projectPath(projectDir, relOrAbs) {
  if (path.isAbsolute(relOrAbs)) return relOrAbs;
  return path.resolve(projectDir, relOrAbs);
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function existingAudioFile(projectDir, audioPath) {
  if (typeof audioPath !== "string" || audioPath.length === 0) return null;
  const absolute = projectPath(projectDir, audioPath);
  if (!isInside(projectDir, absolute)) return null;
  if (!existsSync(absolute)) return null;
  const stats = statSync(absolute);
  return stats.isFile() && stats.size > 0 ? absolute : null;
}

function wordsAreMonotonic(words, durationSec) {
  if (!Array.isArray(words) || words.length === 0) return false;
  let previousEnd = 0;
  for (const word of words) {
    if (!word || typeof word.word !== "string" || word.word.length === 0) return false;
    if (typeof word.start !== "number" || typeof word.end !== "number") return false;
    if (!Number.isFinite(word.start) || !Number.isFinite(word.end)) return false;
    if (word.start < previousEnd || word.end < word.start) return false;
    if (Number.isFinite(durationSec) && word.end > durationSec + 0.001) return false;
    previousEnd = word.end;
  }
  return true;
}

function reusableScene(existingById, scene, sourceHash, projectDir) {
  const existing = existingById.get(scene.sceneId);
  if (!existing || existing.sourceHash !== sourceHash) return null;
  if (!existingAudioFile(projectDir, existing.audioPath)) return null;
  if (!wordsAreMonotonic(existing.words, existing.audioDurationSec)) return null;
  return existing;
}

function probeDuration(filePath, ffprobeBin) {
  const result = spawnSync(
    ffprobeBin,
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", filePath],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error(`ffprobe failed for ${filePath}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim());
  }
  const duration = Number(result.stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`ffprobe returned invalid duration for ${filePath}`);
  return Number(duration.toFixed(3));
}

function normalizeWords(words, durationSec) {
  let previousEnd = 0;
  const normalized = [];
  for (const item of words ?? []) {
    const word = String(item?.word ?? "").trim();
    if (!word) continue;
    let start = Number(item.start);
    let end = Number(item.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    start = Math.max(0, start);
    end = Math.max(start, end);
    if (start < previousEnd) start = previousEnd;
    if (end < start) end = start;
    if (Number.isFinite(durationSec)) {
      start = Math.min(start, durationSec);
      end = Math.min(Math.max(start, end), durationSec);
    }
    const entry = {
      word,
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3))
    };
    normalized.push(entry);
    previousEnd = entry.end;
  }
  if (!wordsAreMonotonic(normalized, durationSec)) {
    throw new Error("provider returned invalid or non-monotonic word timings");
  }
  return normalized;
}

async function mapLimit(items, limit, task) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await task(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function synthesizeWithRetry(provider, payload, config) {
  try {
    return await provider.synthesize(payload);
  } catch (error) {
    if (!isRetryableTtsError(error)) throw error;
    await sleep(config.backoffMs);
    return provider.synthesize(payload);
  }
}

async function synthesizeOne({ scene, sourceHash, audioDir, config, providers }) {
  const text = String(scene.narration_tts ?? "");
  const baseName = `${safeSceneId(scene.sceneId)}.${sourceHash.slice(0, 12)}`;

  async function runProvider(providerName) {
    const provider = providers[providerName];
    if (!provider?.synthesize) throw new Error(`TTS provider is not registered: ${providerName}`);
    const finalPath = path.join(audioDir, `${baseName}.${providerName}.mp3`);
    const tmpPath = `${finalPath}.${process.pid}.${Date.now()}.tmp.mp3`;
    try {
      const providerResult = await synthesizeWithRetry(provider, {
        scene,
        text,
        outputPath: tmpPath,
        config
      }, config);
      const durationSec = probeDuration(tmpPath, config.ffprobeBin);
      const words = normalizeWords(providerResult.words, durationSec);
      renameSync(tmpPath, finalPath);
      return {
        sceneId: scene.sceneId,
        audioPath: `./assets/audio/${path.basename(finalPath)}`,
        audioDurationSec: durationSec,
        words,
        sourceHash,
        provider: providerResult.provider ?? providerName,
        voice: providerResult.voice ?? providerName
      };
    } catch (error) {
      rmSync(tmpPath, { force: true });
      throw error;
    }
  }

  if (config.provider === "edge") return runProvider("edge");
  if (config.provider === "melo") return runProvider("melo");

  try {
    return await runProvider("edge");
  } catch (error) {
    if (!isRetryableTtsError(error)) throw error;
    try {
      return await runProvider("melo");
    } catch (fallbackError) {
      throw new TtsProviderError(
        `edge-tts failed with a retryable error and MeloTTS fallback failed: ${fallbackError.message}`,
        {
          code: "tts-chain-failed",
          retryable: false,
          stderr: `${error.stderr ?? error.message}\n${fallbackError.stderr ?? ""}`.trim()
        }
      );
    }
  }
}

export async function runRealTtsJob(ctx, options = {}) {
  const config = loadTtsConfig({
    repoRoot: ctx.repoRoot,
    projectDir: ctx.projectDir,
    env: options.env ?? process.env,
    overrides: options.config ?? options
  });
  const providers = options.providers ?? createDefaultProviders(config);
  const specs = readJsonFile(path.join(ctx.projectDir, "scene_specs.json"));
  const existingMetaPath = path.join(ctx.projectDir, "audio_meta.json");
  const existingMeta = existsSync(existingMetaPath) ? readJsonFile(existingMetaPath) : { scenes: [] };
  const existingById = new Map((existingMeta.scenes ?? []).map((scene) => [scene.sceneId, scene]));
  const audioDir = path.join(ctx.projectDir, "assets", "audio");
  ensureDir(audioDir);

  const planned = (specs.scenes ?? []).map((scene, index) => {
    const sourceHash = sha256Text(scene.narration_tts);
    const reuse = config.forceRetts ? null : reusableScene(existingById, scene, sourceHash, ctx.projectDir);
    return { scene, index, sourceHash, reuse };
  });

  const generatedItems = planned.filter((item) => !item.reuse);
  const generated = await mapLimit(generatedItems, config.concurrency, (item) =>
    synthesizeOne({ ...item, audioDir, config, providers })
  );
  const generatedBySceneId = new Map(generated.map((scene) => [scene.sceneId, scene]));

  const scenes = planned.map((item) => item.reuse ?? generatedBySceneId.get(item.scene.sceneId));
  for (const [index, scene] of scenes.entries()) {
    if (!scene) throw new Error(`missing TTS result for scene index ${index}`);
    if (scene.sourceHash !== planned[index].sourceHash) {
      throw new Error(`sourceHash mismatch for scene ${scene.sceneId}`);
    }
  }

  const audioMeta = { scenes };
  writeJsonViaVf({
    repoRoot: ctx.repoRoot,
    projectDir: ctx.projectDir,
    filePath: existingMetaPath,
    schemaName: "audio-meta",
    data: audioMeta
  });

  const providersUsed = [...new Set(scenes.map((scene) => scene.provider))].sort((a, b) => a.localeCompare(b));
  return {
    provider: providersUsed.length === 1 ? providersUsed[0] : "mixed-tts",
    scenes: scenes.length,
    generated: generated.length,
    reused: planned.length - generated.length,
    files: scenes.map((scene) => normalizeRelPath(scene.audioPath))
  };
}

export function runRealTtsStep(ctx, options = {}) {
  if (options.providers) {
    throw new Error("runRealTtsStep is a synchronous pipeline wrapper; use runRealTtsJob for injected providers");
  }
  const runnerPath = path.join(ttsDir, "runner.mjs");
  const requestDir = path.join(ctx.projectDir, ".pipeline", "tts");
  ensureDir(requestDir);
  const requestPath = path.join(requestDir, `request.${process.pid}.${Date.now()}.json`);
  writeFileSync(
    requestPath,
    `${JSON.stringify({
      ctx: {
        repoRoot: ctx.repoRoot,
        projectDir: ctx.projectDir,
        profile: ctx.profile,
        force: ctx.force,
        command: ctx.command
      },
      options
    })}\n`
  );

  const result = spawnSync(process.execPath, [runnerPath, requestPath], {
    cwd: ctx.repoRoot,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    env: process.env
  });
  rmSync(requestPath, { force: true });
  if (result.status !== 0) {
    throw new Error(`real TTS adapter failed\n${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim());
  }
  try {
    return JSON.parse(readFileSync(path.join(requestDir, "last-result.json"), "utf8"));
  } catch {
    return JSON.parse(result.stdout);
  }
}

export { isRetryableTtsError };

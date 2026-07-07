import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import {
  ensureDir,
  normalizeRelPath,
  readJsonFile,
  writeJsonViaVf
} from "../core/io.mjs";

export const IMAGE_MANIFEST_FILE = "image-manifest.json";
export const IMAGE_RUNNER_CONTRACT_VERSION = "reelforge.image-runner.v1";
export const IMAGE_MANIFEST_VERSION = "1.0.0";

export const RUNNER_CONTRACT = {
  contractVersion: IMAGE_RUNNER_CONTRACT_VERSION,
  promptFile: "./assets/images/runner/prompts.jsonl",
  resultsDir: "./assets/images/runner/results",
  resultFile: "<id>.png",
  finalPath: "./assets/images/<sceneId>_<gen>.png",
  promptLineFields: [
    "contractVersion",
    "id",
    "sceneId",
    "gen",
    "prompt",
    "width",
    "height",
    "resultPath",
    "finalPath"
  ]
};

export const OPENVERSE_PROVIDER_CONTRACT = {
  provider: "openverse",
  status: "stub",
  querySource: "compiledPrompt",
  expectedOutput: "PNG copied to ./assets/images/<sceneId>_<gen>.png",
  note: "Keyless stock fallback slot only; download/search implementation is owned by a later phase."
};

const MOCK_PROVIDER = "mock-image";
const RUNNER_PROVIDER = "codex-imagegen-runner";
const OPENVERSE_PROVIDER = "openverse";
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function sha256Text(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function readJsonIfExists(filePath, fallback) {
  return existsSync(filePath) ? readJsonFile(filePath) : fallback;
}

function writeJsonAtomic(filePath, data) {
  ensureDir(path.dirname(filePath));
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmpPath, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(tmpPath, filePath);
}

function resourceTypeForScene(sceneId) {
  return `image_${sceneId}`;
}

function assetIdFor(sceneId, gen) {
  return `${resourceTypeForScene(sceneId)}_${gen}`;
}

function nextGen(entries) {
  const max = entries.reduce((value, entry) => {
    const match = /^gen_(\d+)$/.exec(entry?.gen ?? "");
    return match ? Math.max(value, Number(match[1])) : value;
  }, 0);
  return `gen_${String(max + 1).padStart(2, "0")}`;
}

function normalizeProjectPath(projectDir, relPath) {
  return `./${normalizeRelPath(path.relative(projectDir, path.join(projectDir, relPath)))}`;
}

function absFromProject(projectDir, relPath) {
  const clean = relPath.startsWith("./") ? relPath.slice(2) : relPath;
  return path.join(projectDir, clean);
}

function fileExists(projectDir, relPath) {
  const abs = absFromProject(projectDir, relPath);
  return pngStatus(abs).pass;
}

function pngStatus(filePath) {
  if (!existsSync(filePath)) return { pass: false, reason: "missing", bytes: 0 };
  const stats = statSync(filePath);
  if (!stats.isFile()) return { pass: false, reason: "not-file", bytes: 0 };
  if (stats.size <= 0) return { pass: false, reason: "empty", bytes: stats.size };
  const signature = readFileSync(filePath).subarray(0, PNG_SIGNATURE.length);
  if (!signature.equals(PNG_SIGNATURE)) {
    return { pass: false, reason: "invalid-png-signature", bytes: stats.size };
  }
  return { pass: true, reason: "ok", bytes: stats.size };
}

export function isNonEmptyPngFile(filePath) {
  return pngStatus(filePath).pass;
}

function dimensionsForPlacement(placement) {
  if (placement === "fullscreen" || placement === "background") return { width: 1280, height: 720 };
  if (placement === "left" || placement === "right") return { width: 768, height: 1024 };
  return { width: 1024, height: 1024 };
}

function loadDesignTokens(projectDir) {
  const tokenPath = path.join(projectDir, "design-tokens.json");
  return existsSync(tokenPath) ? readJsonFile(tokenPath) : null;
}

export function defaultPromptCompiler({ scene, imageAsset, moodTokens }) {
  const segments = [
    imageAsset.prompt,
    `Scene mood: ${scene.mood}.`,
    `Placement: ${imageAsset.placement}.`,
    scene.headline ? `Headline context: ${scene.headline}.` : null,
    scene.altText ? `Accessibility intent: ${scene.altText}.` : null,
    moodTokens?.accent ? `Mood accent token: ${moodTokens.accent}.` : null,
    moodTokens?.speed ? `Mood pacing token: ${moodTokens.speed}.` : null,
    "Do not add visible text unless the prompt explicitly asks for typography."
  ].filter(Boolean);
  return segments.join(" ");
}

export function imageRequirementsFromSceneSpecs(sceneSpecs, options = {}) {
  const designTokens = options.designTokens ?? null;
  const promptCompiler = options.promptCompiler ?? defaultPromptCompiler;
  return (sceneSpecs.scenes ?? [])
    .filter((scene) => scene?.visual_kind === "generate_image")
    .map((scene) => {
      const imageAsset = scene.imageAsset;
      if (!imageAsset?.prompt || !imageAsset?.placement) {
        throw new Error(`scene ${scene.sceneId} has visual_kind=generate_image but no complete imageAsset`);
      }
      const moodTokens = designTokens?.moods?.[scene.mood] ?? null;
      const prompt = promptCompiler({
        scene,
        imageAsset,
        moodTokens,
        designTokens,
        defaultPromptCompiler
      });
      if (typeof prompt !== "string" || prompt.trim().length === 0) {
        throw new Error(`image prompt compiler returned an empty prompt for scene ${scene.sceneId}`);
      }
      return {
        sceneId: scene.sceneId,
        resourceType: resourceTypeForScene(scene.sceneId),
        prompt: prompt.trim(),
        promptHash: sha256Text(prompt.trim()),
        placement: imageAsset.placement,
        dimensions: dimensionsForPlacement(imageAsset.placement)
      };
    });
}

function loadVersions(projectDir) {
  const versionsPath = path.join(projectDir, "versions.json");
  const versions = readJsonIfExists(versionsPath, {
    resources: {},
    editLock: null,
    dirty: false
  });
  versions.resources = versions.resources ?? {};
  versions.editLock = versions.editLock ?? null;
  versions.dirty = Boolean(versions.dirty);
  return versions;
}

function assertVersionsWritable(versions) {
  if (versions.dirty === true) {
    throw new Error("versions.json dirty=true; images step refuses blind overwrite");
  }
  if (versions.editLock && versions.editLock.owner !== "pipeline:images") {
    throw new Error(`versions.json editLock is held by ${versions.editLock.owner}`);
  }
}

function selectedEntryFor(versions, resourceType) {
  const history = versions.resources?.[resourceType];
  const entries = Array.isArray(history?.entries) ? history.entries : [];
  const selected = history?.selected ?? null;
  return selected ? entries.find((entry) => entry?.gen === selected) ?? null : null;
}

function manifestAssetFor(manifest, sceneId, gen) {
  return (manifest?.assets ?? []).find((asset) => asset?.sceneId === sceneId && asset?.gen === gen) ?? null;
}

function reusableAsset({ projectDir, manifest, provider, requirement, versions }) {
  const selected = selectedEntryFor(versions, requirement.resourceType);
  if (!selected?.path || !fileExists(projectDir, selected.path)) return null;
  const asset = manifestAssetFor(manifest, requirement.sceneId, selected.gen);
  if (!asset) return null;
  if (asset.provider !== provider) return null;
  if (asset.prompt !== requirement.prompt) return null;
  if (asset.width !== requirement.dimensions.width || asset.height !== requirement.dimensions.height) return null;
  return {
    id: asset.id,
    sceneId: requirement.sceneId,
    path: normalizeRelPath(selected.path),
    gen: selected.gen,
    provider,
    prompt: requirement.prompt,
    width: requirement.dimensions.width,
    height: requirement.dimensions.height
  };
}

function ensureHistory(versions, resourceType) {
  const history = versions.resources[resourceType] ?? { entries: [], selected: null };
  history.entries = Array.isArray(history.entries) ? history.entries : [];
  history.selected = history.selected ?? null;
  versions.resources[resourceType] = history;
  return history;
}

function ensureVersionsWritableShape(versions) {
  if (Object.keys(versions.resources).length === 0) {
    versions.resources.images = { entries: [], selected: null };
  }
}

function upsertGeneratedVersion({ versions, requirement, gen, relPath, now, provider }) {
  const history = ensureHistory(versions, requirement.resourceType);
  if (!history.entries.some((entry) => entry.gen === gen)) {
    history.entries.push({
      gen,
      path: relPath,
      createdAt: now,
      note: `${provider} prompt=${requirement.promptHash.slice(0, 12)}`
    });
  }
  history.selected = gen;
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

const glyphs = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  a: ["111", "101", "111", "101", "101"],
  b: ["110", "101", "110", "101", "110"],
  c: ["111", "100", "100", "100", "111"],
  d: ["110", "101", "101", "101", "110"],
  e: ["111", "100", "111", "100", "111"],
  f: ["111", "100", "111", "100", "100"]
};

function setPixel(buffer, width, x, y, rgb) {
  if (x < 0 || y < 0 || x >= width) return;
  const offset = y * (1 + width * 3) + 1 + x * 3;
  if (offset < 0 || offset + 2 >= buffer.length) return;
  buffer[offset] = rgb[0];
  buffer[offset + 1] = rgb[1];
  buffer[offset + 2] = rgb[2];
}

function drawGlyph(buffer, width, char, x, y, scale, rgb) {
  const rows = glyphs[char];
  if (!rows) return;
  rows.forEach((row, rowIndex) => {
    [...row].forEach((bit, colIndex) => {
      if (bit !== "1") return;
      for (let yy = 0; yy < scale; yy += 1) {
        for (let xx = 0; xx < scale; xx += 1) {
          setPixel(buffer, width, x + colIndex * scale + xx, y + rowIndex * scale + yy, rgb);
        }
      }
    });
  });
}

function writePromptHashPng(filePath, { width, height, rgb, text }) {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowLength = 1 + width * 3;
  const raw = Buffer.alloc(rowLength * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * rowLength;
    raw[rowStart] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = rowStart + 1 + x * 3;
      raw[offset] = rgb[0];
      raw[offset + 1] = rgb[1];
      raw[offset + 2] = rgb[2];
    }
  }

  const scale = Math.max(6, Math.floor(Math.min(width, height) / 80));
  const chars = text.slice(0, 16).toLowerCase();
  const glyphWidth = 3 * scale;
  const gap = scale;
  const textWidth = chars.length * glyphWidth + Math.max(0, chars.length - 1) * gap;
  const x0 = Math.floor((width - textWidth) / 2);
  const y0 = Math.floor((height - 5 * scale) / 2);
  const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  const ink = luminance > 128 ? [16, 24, 39] : [248, 250, 252];
  [...chars].forEach((char, index) => {
    drawGlyph(raw, width, char, x0 + index * (glyphWidth + gap), y0, scale, ink);
  });

  const png = Buffer.concat([
    header,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
  ensureDir(path.dirname(filePath));
  writeFileSync(filePath, png);
}

function mockColorFor(requirement) {
  const digest = Buffer.from(requirement.promptHash, "hex");
  return [64 + (digest[0] % 144), 64 + (digest[1] % 144), 64 + (digest[2] % 144)];
}

function createAssetRecord({ requirement, gen, relPath, provider }) {
  return {
    id: assetIdFor(requirement.sceneId, gen),
    sceneId: requirement.sceneId,
    path: relPath,
    gen,
    provider,
    prompt: requirement.prompt,
    width: requirement.dimensions.width,
    height: requirement.dimensions.height
  };
}

function filterLogs(assets) {
  return {
    ocr: assets.map((asset) => ({
      sceneId: asset.sceneId,
      pass: true,
      status: "stub",
      message: "ocr-stub-pass"
    })),
    composition: assets.map((asset) => ({
      sceneId: asset.sceneId,
      pass: true,
      status: "stub",
      message: "composition-stub-pass"
    }))
  };
}

function imageManifest({ status, provider, assets, pending = [], runner = null }) {
  return {
    version: IMAGE_MANIFEST_VERSION,
    status,
    provider,
    generatedAt: new Date().toISOString(),
    runner,
    assets,
    pending,
    filters: filterLogs(assets)
  };
}

function writeVersions({ repoRoot, projectDir, versions }) {
  ensureVersionsWritableShape(versions);
  writeJsonViaVf({
    repoRoot,
    projectDir,
    filePath: path.join(projectDir, "versions.json"),
    schemaName: "versions",
    data: versions
  });
}

function plannedGeneration(versions, requirement) {
  const history = ensureHistory(versions, requirement.resourceType);
  const gen = nextGen(history.entries);
  const fileName = `${requirement.sceneId}_${gen}.png`;
  const relPath = `./assets/images/${fileName}`;
  return { gen, fileName, relPath };
}

function writeRunnerFiles(projectDir, lines, missing) {
  const runnerDir = path.join(projectDir, "assets", "images", "runner");
  const resultsDir = path.join(runnerDir, "results");
  ensureDir(resultsDir);
  const promptsPath = path.join(runnerDir, "prompts.jsonl");
  const statusPath = path.join(runnerDir, "status.json");
  writeFileSync(promptsPath, `${lines.map((line) => JSON.stringify(line)).join("\n")}${lines.length ? "\n" : ""}`);
  writeJsonAtomic(statusPath, {
    contractVersion: IMAGE_RUNNER_CONTRACT_VERSION,
    status: missing.length === 0 ? "complete" : "pending",
    prompts: normalizeProjectPath(projectDir, "./assets/images/runner/prompts.jsonl"),
    resultsDir: normalizeProjectPath(projectDir, "./assets/images/runner/results"),
    missing
  });
  return { runnerDir, promptsPath, statusPath, resultsDir };
}

export class ImagePipelinePendingError extends Error {
  constructor({ promptsPath, resultsDir, missing, warnings = [] }) {
    super(`image runner pending: write ${missing.length} PNG result(s) under ${normalizeRelPath(resultsDir)}`);
    this.name = "ImagePipelinePendingError";
    this.promptsPath = promptsPath;
    this.resultsDir = resultsDir;
    this.missing = missing;
    this.warnings = warnings;
    this.pending = true;
  }
}

function runMockProvider({ projectDir, requirement, gen, relPath }) {
  const absPath = absFromProject(projectDir, relPath);
  writePromptHashPng(absPath, {
    width: requirement.dimensions.width,
    height: requirement.dimensions.height,
    rgb: mockColorFor(requirement),
    text: requirement.promptHash
  });
}

function runOpenverseStub() {
  throw new Error("Openverse provider is a contract stub only; use mock or runner provider");
}

function runProvider({
  provider,
  projectDir,
  requirements,
  reusableAssets,
  plans,
  versions,
  now
}) {
  const generatedAssets = [];
  const pending = [];
  const warnings = [];
  const runnerLines = [];

  if (provider === OPENVERSE_PROVIDER) runOpenverseStub();

  for (const requirement of requirements) {
    if (reusableAssets.has(requirement.sceneId)) continue;

    const plan = plans.get(requirement.sceneId);
    if (provider === MOCK_PROVIDER) {
      runMockProvider({ projectDir, requirement, gen: plan.gen, relPath: plan.relPath });
      upsertGeneratedVersion({ versions, requirement, gen: plan.gen, relPath: plan.relPath, now, provider });
      generatedAssets.push(createAssetRecord({ requirement, gen: plan.gen, relPath: plan.relPath, provider }));
      continue;
    }

    if (provider !== RUNNER_PROVIDER) {
      throw new Error(`unknown image provider: ${provider}`);
    }

    const id = assetIdFor(requirement.sceneId, plan.gen);
    const resultPath = `./assets/images/runner/results/${id}.png`;
    const resultAbs = absFromProject(projectDir, resultPath);
    runnerLines.push({
      contractVersion: IMAGE_RUNNER_CONTRACT_VERSION,
      id,
      sceneId: requirement.sceneId,
      gen: plan.gen,
      prompt: requirement.prompt,
      width: requirement.dimensions.width,
      height: requirement.dimensions.height,
      resultPath,
      finalPath: plan.relPath
    });

    const resultStatus = pngStatus(resultAbs);
    if (!resultStatus.pass) {
      pending.push({
        id,
        sceneId: requirement.sceneId,
        gen: plan.gen,
        resultPath,
        reason: resultStatus.reason,
        bytes: resultStatus.bytes
      });
      if (resultStatus.reason !== "missing") {
        warnings.push(
          `runner result ${resultPath} for scene ${requirement.sceneId} is not a non-empty PNG (${resultStatus.reason}, bytes=${resultStatus.bytes}); keeping scene pending`
        );
      }
      continue;
    }

    copyFileSync(resultAbs, absFromProject(projectDir, plan.relPath));
    upsertGeneratedVersion({ versions, requirement, gen: plan.gen, relPath: plan.relPath, now, provider });
    generatedAssets.push(createAssetRecord({ requirement, gen: plan.gen, relPath: plan.relPath, provider }));
  }

  const runner = provider === RUNNER_PROVIDER ? writeRunnerFiles(projectDir, runnerLines, pending) : null;
  return { generatedAssets, pending, runner, warnings };
}

export function validateImageManifestContract(manifest, expectedSceneIds = null) {
  const errors = [];
  const requiredAssetFields = ["id", "sceneId", "path", "gen", "provider", "prompt", "width", "height"];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return { pass: false, errors: ["manifest must be an object"] };
  }
  if (manifest.version !== IMAGE_MANIFEST_VERSION) errors.push("version must be 1.0.0");
  if (!["complete", "pending"].includes(manifest.status)) errors.push("status must be complete or pending");
  if (!Array.isArray(manifest.assets)) errors.push("assets must be an array");

  const sceneIds = [];
  for (const [index, asset] of (manifest.assets ?? []).entries()) {
    for (const field of requiredAssetFields) {
      if (!Object.hasOwn(asset, field)) errors.push(`assets[${index}] missing ${field}`);
    }
    if (typeof asset.id !== "string" || asset.id.length === 0) errors.push(`assets[${index}].id invalid`);
    if (typeof asset.sceneId !== "string" || asset.sceneId.length === 0) errors.push(`assets[${index}].sceneId invalid`);
    if (typeof asset.path !== "string" || !asset.path.startsWith("./assets/images/")) {
      errors.push(`assets[${index}].path invalid`);
    }
    if (typeof asset.gen !== "string" || !/^gen_\d{2,}$/.test(asset.gen)) errors.push(`assets[${index}].gen invalid`);
    if (typeof asset.provider !== "string" || asset.provider.length === 0) errors.push(`assets[${index}].provider invalid`);
    if (typeof asset.prompt !== "string" || asset.prompt.length === 0) errors.push(`assets[${index}].prompt invalid`);
    if (!Number.isInteger(asset.width) || asset.width <= 0) errors.push(`assets[${index}].width invalid`);
    if (!Number.isInteger(asset.height) || asset.height <= 0) errors.push(`assets[${index}].height invalid`);
    sceneIds.push(asset.sceneId);
  }

  const duplicates = sceneIds.filter((sceneId, index) => sceneIds.indexOf(sceneId) !== index);
  if (duplicates.length > 0) errors.push(`duplicate manifest sceneId(s): ${[...new Set(duplicates)].join(",")}`);

  if (expectedSceneIds) {
    const actual = [...new Set(sceneIds)].sort((a, b) => a.localeCompare(b));
    const expected = [...new Set(expectedSceneIds)].sort((a, b) => a.localeCompare(b));
    if (actual.length !== expected.length || actual.some((sceneId, index) => sceneId !== expected[index])) {
      errors.push(`manifest scene mapping mismatch expected=${expected.join(",")} actual=${actual.join(",")}`);
    }
  }

  return { pass: errors.length === 0, errors };
}

export function runImagesStep(ctx, options = {}) {
  const provider =
    options.provider ??
    (ctx.profile === "mock" ? MOCK_PROVIDER : RUNNER_PROVIDER);
  const sceneSpecs = readJsonFile(path.join(ctx.projectDir, "scene_specs.json"));
  const designTokens = options.designTokens ?? loadDesignTokens(ctx.projectDir);
  const requirements = imageRequirementsFromSceneSpecs(sceneSpecs, {
    designTokens,
    promptCompiler: options.promptCompiler
  });
  const versions = loadVersions(ctx.projectDir);
  assertVersionsWritable(versions);

  const previousManifest = readJsonIfExists(path.join(ctx.projectDir, IMAGE_MANIFEST_FILE), null);
  const now = new Date().toISOString();
  const reusableAssets = new Map();
  const plans = new Map();

  for (const requirement of requirements) {
    const reusable = ctx.force
      ? null
      : reusableAsset({ projectDir: ctx.projectDir, manifest: previousManifest, provider, requirement, versions });
    if (reusable) {
      reusableAssets.set(requirement.sceneId, reusable);
    } else {
      plans.set(requirement.sceneId, plannedGeneration(versions, requirement));
    }
  }

  const { generatedAssets, pending, runner, warnings } = runProvider({
    provider,
    projectDir: ctx.projectDir,
    requirements,
    reusableAssets,
    plans,
    versions,
    now
  });

  const assets = [...reusableAssets.values(), ...generatedAssets].sort((a, b) => a.sceneId.localeCompare(b.sceneId));
  const manifest = imageManifest({
    status: pending.length > 0 ? "pending" : "complete",
    provider,
    assets,
    pending,
    runner: runner
      ? {
          contractVersion: IMAGE_RUNNER_CONTRACT_VERSION,
          prompts: "./assets/images/runner/prompts.jsonl",
          resultsDir: "./assets/images/runner/results"
        }
      : null
  });
  writeJsonAtomic(path.join(ctx.projectDir, IMAGE_MANIFEST_FILE), manifest);

  if (pending.length > 0) {
    throw new ImagePipelinePendingError({
      promptsPath: runner.promptsPath,
      resultsDir: runner.resultsDir,
      missing: pending,
      warnings
    });
  }

  writeVersions({ repoRoot: ctx.repoRoot, projectDir: ctx.projectDir, versions });

  return {
    provider,
    scenes: requirements.length,
    generated: generatedAssets.length,
    reused: reusableAssets.size,
    manifest: IMAGE_MANIFEST_FILE,
    assets: assets.map((asset) => asset.path)
  };
}

export function runMockImagesStep(ctx, options = {}) {
  return runImagesStep(ctx, { ...options, provider: MOCK_PROVIDER });
}

export function runRealImagesStep(ctx, options = {}) {
  return runImagesStep(ctx, { ...options, provider: RUNNER_PROVIDER });
}

export function imageStepDefinition() {
  return {
    id: "images",
    inputs: ["scene_specs.json"],
    outputs: ["versions.json", "image-manifest.json", "assets/images/*.png"],
    run: runImagesStep
  };
}

export function readImageManifest(projectDir) {
  return JSON.parse(readFileSync(path.join(projectDir, IMAGE_MANIFEST_FILE), "utf8"));
}

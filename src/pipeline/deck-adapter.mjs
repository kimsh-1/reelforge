#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const DECK_MOTION_ENGINE = "hyperframes";
export const DECK_MOTION_KIND = "motion";

const SHORT_HEX_COLOR = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/;
const DECK_HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const LONG_HEX_WITH_ALPHA = /^(#[0-9a-fA-F]{6})[0-9a-fA-F]{2}$/;
const BACKGROUND_COLOR_KEYS = ["background", "canvas", "bg", "surface", "base"];
const PALETTE_ROLE_ALIASES = new Map([
  ["background", "canvas"],
  ["canvas", "canvas"],
  ["bg", "canvas"],
  ["surface", "surface"],
  ["base", "base"],
  ["accent", "accent"],
  ["primary", "primary"],
  ["secondary", "secondary"],
  ["text", "text"],
  ["foreground", "text"],
  ["muted", "muted"]
]);

function assertObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertPositiveNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number`);
  }
}

function assertPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function normalizeHexColor(value, label) {
  if (typeof value !== "string") throw new Error(`${label} must be a color string`);
  const shortMatch = value.match(SHORT_HEX_COLOR);
  if (shortMatch) {
    const [, r, g, b] = shortMatch;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const alphaMatch = value.match(LONG_HEX_WITH_ALPHA);
  if (alphaMatch) return alphaMatch[1].toLowerCase();
  if (DECK_HEX_COLOR.test(value)) return value.toLowerCase();
  throw new Error(`${label} must be #RGB, #RRGGBB, or #RRGGBBAA`);
}

function readSceneSpecsAltText(sceneSpecs) {
  assertObject(sceneSpecs, "scene_specs");
  if (!Array.isArray(sceneSpecs.scenes)) throw new Error("scene_specs.scenes must be an array");

  const bySceneId = new Map();
  for (const [index, scene] of sceneSpecs.scenes.entries()) {
    assertObject(scene, `scene_specs.scenes[${index}]`);
    assertNonEmptyString(scene.sceneId, `scene_specs.scenes[${index}].sceneId`);
    assertNonEmptyString(scene.altText, `scene_specs.scenes[${index}].altText`);
    if (bySceneId.has(scene.sceneId)) {
      throw new Error(`duplicate scene_specs sceneId: ${scene.sceneId}`);
    }
    bySceneId.set(scene.sceneId, scene.altText);
  }
  return bySceneId;
}

function assertRenderSceneIds(renderScenes, sceneSpecsById) {
  const seen = new Set();
  const renderIds = [];
  for (const [index, scene] of renderScenes.entries()) {
    assertObject(scene, `render-manifest.scenes[${index}]`);
    assertNonEmptyString(scene.sceneId, `render-manifest.scenes[${index}].sceneId`);
    if (seen.has(scene.sceneId)) throw new Error(`duplicate render-manifest sceneId: ${scene.sceneId}`);
    seen.add(scene.sceneId);
    renderIds.push(scene.sceneId);
  }

  const sceneSpecIds = [...sceneSpecsById.keys()];
  const missingInSpecs = renderIds.filter((sceneId) => !sceneSpecsById.has(sceneId));
  const unusedSceneSpecs = sceneSpecIds.filter((sceneId) => !seen.has(sceneId));
  if (missingInSpecs.length > 0 || unusedSceneSpecs.length > 0) {
    throw new Error(
      `sceneId coverage mismatch: missing scene_specs=${missingInSpecs.join(",") || "none"} unused scene_specs=${
        unusedSceneSpecs.join(",") || "none"
      }`
    );
  }
}

export function durationFramesToMs(durationFrames, fps) {
  assertPositiveInteger(durationFrames, "durationFrames");
  assertPositiveNumber(fps, "fps");

  const durationMs = Math.round((durationFrames * 1000) / fps);
  const recoveredFrames = Math.round((durationMs * fps) / 1000);
  if (recoveredFrames !== durationFrames) {
    throw new Error(
      `duration round-trip failed: ${durationFrames} frames at ${fps} fps became ${durationMs}ms -> ${recoveredFrames} frames`
    );
  }
  return durationMs;
}

export function resolveBackgroundHex(designTokens) {
  assertObject(designTokens, "render-manifest.meta.designTokens");
  assertObject(designTokens.colors, "render-manifest.meta.designTokens.colors");

  for (const key of BACKGROUND_COLOR_KEYS) {
    const value = designTokens.colors[key];
    if (typeof value !== "string") continue;
    return normalizeHexColor(value, `render-manifest.meta.designTokens.colors.${key}`);
  }

  throw new Error(
    `render-manifest.meta.designTokens.colors must include one of ${BACKGROUND_COLOR_KEYS.join(
      ", "
    )} as #RGB or #RRGGBB`
  );
}

function mapPaletteRoles(designTokens, backgroundHex) {
  assertObject(designTokens.colors, "render-manifest.meta.designTokens.colors");
  const roles = { canvas: backgroundHex };
  for (const [key, value] of Object.entries(designTokens.colors)) {
    const role = PALETTE_ROLE_ALIASES.get(key) ?? key;
    roles[role] = normalizeHexColor(value, `render-manifest.meta.designTokens.colors.${key}`);
  }
  roles.canvas = backgroundHex;
  return roles;
}

function mapFontRole(fonts, sourceRole, deckRole) {
  const role = fonts?.[sourceRole];
  assertObject(role, `render-manifest.meta.designTokens.fonts.${sourceRole}`);
  assertNonEmptyString(role.family, `render-manifest.meta.designTokens.fonts.${sourceRole}.family`);
  if (!Array.isArray(role.files)) {
    throw new Error(`render-manifest.meta.designTokens.fonts.${sourceRole}.files must be an array`);
  }

  return {
    family: role.family,
    files: role.files.map((file, index) => {
      assertObject(file, `render-manifest.meta.designTokens.fonts.${sourceRole}.files[${index}]`);
      assertNonEmptyString(file.path, `render-manifest.meta.designTokens.fonts.${sourceRole}.files[${index}].path`);
      return {
        path: file.path,
        ...(file.weight !== undefined ? { weight: file.weight } : {}),
        ...(file.style !== undefined ? { style: file.style } : {})
      };
    }),
    sourceRole,
    deckRole
  };
}

export function mapDesignTokensToDeckTokens(designTokens) {
  const backgroundHex = resolveBackgroundHex(designTokens);
  assertObject(designTokens.fonts, "render-manifest.meta.designTokens.fonts");
  return {
    palette: {
      backgroundHex,
      roles: mapPaletteRoles(designTokens, backgroundHex)
    },
    fonts: {
      pair: {
        display: mapFontRole(designTokens.fonts, "headline", "display"),
        body: mapFontRole(designTokens.fonts, "body", "body"),
        mono: mapFontRole(designTokens.fonts, "mono", "mono")
      }
    }
  };
}

export function mapDesignTokensToDeckTokensRef(designTokens) {
  const deckTokens = mapDesignTokensToDeckTokens(designTokens);
  const digest = createHash("sha256").update(JSON.stringify(deckTokens)).digest("hex").slice(0, 16);
  return {
    tokensRef: `deck-tokens:inline:${deckTokens.palette.backgroundHex.slice(1)}:${digest}`,
    tokens: deckTokens
  };
}

export function renderManifestToMotionManifest(renderManifest, sceneSpecs) {
  assertObject(renderManifest, "render-manifest");
  assertObject(renderManifest.meta, "render-manifest.meta");
  assertObject(renderManifest.meta.resolution, "render-manifest.meta.resolution");
  assertPositiveInteger(renderManifest.meta.resolution.width, "render-manifest.meta.resolution.width");
  assertPositiveInteger(renderManifest.meta.resolution.height, "render-manifest.meta.resolution.height");
  assertPositiveNumber(renderManifest.meta.fps, "render-manifest.meta.fps");
  if (!Array.isArray(renderManifest.scenes) || renderManifest.scenes.length === 0) {
    throw new Error("render-manifest.scenes must be a non-empty array");
  }

  const altTextBySceneId = readSceneSpecsAltText(sceneSpecs);
  assertRenderSceneIds(renderManifest.scenes, altTextBySceneId);
  const { tokensRef, tokens } = mapDesignTokensToDeckTokensRef(renderManifest.meta.designTokens);
  const { width, height } = renderManifest.meta.resolution;
  const fps = renderManifest.meta.fps;

  const assets = renderManifest.scenes.map((scene, index) => {
    assertObject(scene, `render-manifest.scenes[${index}]`);
    assertNonEmptyString(scene.sceneId, `render-manifest.scenes[${index}].sceneId`);
    assertNonEmptyString(scene.path, `render-manifest.scenes[${index}].path`);
    assertPositiveInteger(scene.durationFrames, `render-manifest.scenes[${index}].durationFrames`);

    const altText = altTextBySceneId.get(scene.sceneId);
    if (!altText) throw new Error(`missing altText for sceneId ${scene.sceneId}`);

    return {
      id: scene.sceneId,
      path: scene.path,
      kind: DECK_MOTION_KIND,
      engine: DECK_MOTION_ENGINE,
      width,
      height,
      durationMs: durationFramesToMs(scene.durationFrames, fps),
      durationFrames: scene.durationFrames,
      fps,
      tokensRef,
      altText
    };
  });

  return { tokens: { [tokensRef]: tokens }, assets };
}

export async function readJsonFile(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to read JSON ${filePath}: ${message}`);
  }
}

export async function writeMotionManifest({ renderManifestPath, sceneSpecsPath, outputPath }) {
  const [renderManifest, sceneSpecs] = await Promise.all([
    readJsonFile(renderManifestPath),
    readJsonFile(sceneSpecsPath)
  ]);
  const motionManifest = renderManifestToMotionManifest(renderManifest, sceneSpecs);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(motionManifest, null, 2)}\n`);
  return motionManifest;
}

function parseCliArgs(argv) {
  if (argv.length === 3 && !argv.some((arg) => arg.startsWith("--"))) {
    return {
      renderManifestPath: argv[0],
      sceneSpecsPath: argv[1],
      outputPath: argv[2]
    };
  }

  const args = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) throw new Error("invalid arguments");
    args.set(key, value);
  }

  return {
    renderManifestPath: args.get("--render-manifest"),
    sceneSpecsPath: args.get("--scene-specs"),
    outputPath: args.get("--output")
  };
}

function usage() {
  return `deck-adapter

Usage:
  node src/pipeline/deck-adapter.mjs --render-manifest <render-manifest.json> --scene-specs <scene_specs.json> --output <motion-manifest.json>
  node src/pipeline/deck-adapter.mjs <render-manifest.json> <scene_specs.json> <motion-manifest.json>`;
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  if (!options.renderManifestPath || !options.sceneSpecsPath || !options.outputPath) {
    throw new Error(usage());
  }

  const outputPath = path.resolve(options.outputPath);
  const motionManifest = await writeMotionManifest({
    renderManifestPath: path.resolve(options.renderManifestPath),
    sceneSpecsPath: path.resolve(options.sceneSpecsPath),
    outputPath
  });
  console.log(JSON.stringify({ output: outputPath, assets: motionManifest.assets.length }, null, 2));
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

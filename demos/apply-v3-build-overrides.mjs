#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyKenBurnsToSceneHtml } from "../src/compiler/motion.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const demos = ["demos/d1-usage", "demos/d2-engine", "demos/d3-intro"];

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJsonAtomic(filePath, data) {
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(tmp, filePath);
}

function cssVarBlock(vars) {
  return Object.entries(vars)
    .filter(([, value]) => typeof value === "string" && value.length > 0)
    .map(([key, value]) => `${key}: ${value};`)
    .join(" ");
}

function patchBlockVars(html, scene, tokens) {
  const mood = tokens.moods?.[scene.mood] ?? {};
  const vars = cssVarBlock({
    "--rf-text": tokens.colors?.text,
    "--rf-muted-text": tokens.colors?.mutedText,
    "--rf-surface": tokens.colors?.surface,
    "--rf-panel": tokens.colors?.panel,
    "--rf-accent": mood.accent ?? tokens.colors?.accent,
    "--rf-shadow": tokens.colors?.shadow
  });
  if (!vars) return html;

  const id = `${scene.sceneId}-block-frame`;
  const pattern = new RegExp(`(<div\\b[^>]*\\bid=["']${id}["'][^>]*)(>)`);
  return html.replace(pattern, (match, open, close) => {
    if (/\bstyle=/.test(open)) {
      return `${open.replace(/\bstyle=(["'])(.*?)\1/, (styleMatch, quote, value) => `style=${quote}${value} ${vars}${quote}`)}${close}`;
    }
    return `${open} style="${vars}"${close}`;
  });
}

function uniqueQuoteBlockHtml(html, uniqueId) {
  return html
    .replaceAll('data-composition-id="quote"', `data-composition-id="${uniqueId}"`)
    .replaceAll('data-composition-id=\\"quote\\"', `data-composition-id=\\"${uniqueId}\\"`)
    .replaceAll('data-hf-original-composition-id="quote"', `data-hf-original-composition-id="${uniqueId}"`)
    .replaceAll('data-hf-original-composition-id=\\"quote\\"', `data-hf-original-composition-id=\\"${uniqueId}\\"`)
    .replace('|| "quote";', `|| "${uniqueId}";`)
    .replace("globalThis.__hfVariablesByComp?.quote || {}", `globalThis.__hfVariablesByComp?.[${JSON.stringify(uniqueId)}] || {}`)
    .replace('              "quote"', `              "${uniqueId}"`);
}

function patchQuoteBlockInstance({ html, scene, buildDir }) {
  if (scene.layout !== "quote") return html;
  const uniqueId = `quote-${scene.sceneId}`;
  const sourceRel = "blocks/quote/block.html";
  const targetRel = `blocks/quote/block-${scene.sceneId}.html`;
  const sourcePath = path.join(buildDir, sourceRel);
  const targetPath = path.join(buildDir, targetRel);
  if (!existsSync(sourcePath)) throw new Error(`${scene.sceneId}: missing quote block source`);
  mkdirSync(path.dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, uniqueQuoteBlockHtml(readFileSync(sourcePath, "utf8"), uniqueId));
  return html
    .replace('data-composition-id="quote"', `data-composition-id="${uniqueId}"`)
    .replace(`data-composition-src="${sourceRel}"`, `data-composition-src="${targetRel}"`);
}

function patchImageLayer({ html, scene, asset, sceneTiming, renderFormat }) {
  if (!asset) return html;
  const fileName = path.basename(asset.path);
  const imageSrc = `../assets/images/${fileName}`;
  const imageId = `${scene.sceneId}-image`;
  let next = html;

  if (!next.includes(`id="${imageId}"`)) {
    const openSection = new RegExp(`(<section\\b[^>]*\\bid=["']${scene.sceneId}-bg["'][^>]*>)`);
    next = next.replace(
      openSection,
      `$1\n          <img id="${imageId}" class="rf-scene-image" src="${imageSrc}" alt="" aria-hidden="true" />`
    );
  }

  if (!next.includes(`data-rf-image-layer="${scene.sceneId}"`)) {
    const css = `        /* data-rf-image-layer="${scene.sceneId}" */
        #${imageId} {
          position: absolute;
          inset: -4%;
          width: 108%;
          height: 108%;
          object-fit: cover;
          object-position: center;
          z-index: 0;
          opacity: 1;
          pointer-events: none;
          will-change: transform;
        }
        #${scene.sceneId}-bg .rf-bg-living {
          z-index: 1;
          opacity: 0.26;
          mix-blend-mode: soft-light;
        }`;
    next = next.replace("</style>", `${css}\n      </style>`);
  }

  return applyKenBurnsToSceneHtml({
    html: next,
    scene,
    durationSec: sceneTiming.durationFrames / renderFormat.fps,
    hasImage: true,
    width: renderFormat.width,
    height: renderFormat.height
  });
}

function patchGeneratedBarBlock(buildDir) {
  const barPath = path.join(buildDir, "blocks/bar/block.html");
  if (!existsSync(barPath)) return;
  const html = readFileSync(barPath, "utf8");
  const next = html.replace(/rows\.forEach\(\(row\) => \{(\s+const item = document\.createElement\("div"\);)/, "rows.forEach((row, index) => {$1");
  if (next === html) return;
  writeFileSync(barPath, next);
}

for (const demo of demos) {
  const projectDir = path.join(repoRoot, demo);
  const buildDir = path.join(projectDir, "build");
  const specs = readJson(path.join(projectDir, "scene_specs.json"));
  const imageManifest = readJson(path.join(projectDir, "image-manifest.json"));
  const renderManifestPath = path.join(buildDir, "render-manifest.json");
  const renderManifest = readJson(renderManifestPath);
  const tokens = renderManifest.meta?.designTokens ?? {};
  const renderFormat = {
    width: renderManifest.meta?.resolution?.width ?? 1920,
    height: renderManifest.meta?.resolution?.height ?? 1080,
    fps: renderManifest.meta?.fps ?? 30
  };
  const specByScene = new Map((specs.scenes ?? []).map((scene) => [scene.sceneId, scene]));
  const assetByScene = new Map((imageManifest.assets ?? []).map((asset) => [asset.sceneId, asset]));

  for (const asset of imageManifest.assets ?? []) {
    const sourcePath = path.join(projectDir, asset.path.replace(/^\.\//, ""));
    if (!existsSync(sourcePath)) throw new Error(`${demo} ${asset.sceneId}: missing image asset ${asset.path}`);
    const targetPath = path.join(buildDir, asset.path.replace(/^\.\//, ""));
    mkdirSync(path.dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
  }

  patchGeneratedBarBlock(buildDir);

  for (const renderScene of renderManifest.scenes ?? []) {
    const specScene = specByScene.get(renderScene.sceneId);
    if (!specScene) throw new Error(`${demo}: missing scene spec for ${renderScene.sceneId}`);
    const scenePath = path.join(buildDir, renderScene.path);
    let html = readFileSync(scenePath, "utf8");
    html = patchQuoteBlockInstance({ html, scene: specScene, buildDir });
    html = patchBlockVars(html, specScene, tokens);

    const asset = assetByScene.get(renderScene.sceneId);
    if (asset) {
      html = patchImageLayer({
        html,
        scene: specScene,
        asset,
        sceneTiming: renderScene,
        renderFormat
      });
      renderScene.imagePath = asset.path;
    }

    writeFileSync(scenePath, html);
  }

  writeJsonAtomic(renderManifestPath, renderManifest);
  console.log(`v3 build overrides: ${demo}`);
}

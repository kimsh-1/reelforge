import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import {
  formatAjvErrors,
  schemaPathForName,
  validateJsonForSchema
} from "../gates/registry.mjs";
import {
  formatSemanticViolations,
  validateSemanticsForWrite
} from "../gates/semantic.mjs";
import { hashPatterns } from "../pipeline/core/globs.mjs";
import {
  DEFAULT_BGM_VOLUME,
  DEFAULT_SPEECH_VOLUME,
  buildDuckingFromAudioMeta,
  emitDuckingTimeline
} from "./audio-duck.mjs";
import { blockHostHtml, blockVariablesForScene, resolveBlock } from "./blocks.mjs";
import {
  blockFrameHtml,
  canvasOverrideCss,
  classForCanvasOverrides,
  cssVarsForFormat,
  formatOverridesForManifest,
  formatSpec,
  patchSubtitleCssForFormat,
  resolveCanvasOverrides,
  resolveCompileFormat,
  tokensForFormat
} from "./formats.mjs";
import { runRenderLint } from "./render-lint.mjs";
import { staticSubtitleForScene, subtitleHookData } from "./subtitles.mjs";
import { buildTiming } from "./timing.mjs";
import {
  emitTransition,
  resolvedTransitionsForManifest,
  transitionHookSignature
} from "./transitions.mjs";
import {
  DEFAULT_FPS,
  GENERATED_COMMENT,
  GSAP_CDN,
  asArray,
  atomicReplaceDir,
  colorLuminance,
  copyAssetToBuild,
  cssString,
  cssUrl,
  ensureDir,
  htmlAttr,
  htmlEscape,
  jsonAttr,
  normalizeRelPath,
  readJsonFile,
  requireRelativeAsset,
  resetDir,
  secondsFromFrames,
  sha256Text,
  writeFileEnsured,
  writeSilentWav
} from "./utils.mjs";
import { emitKenBurnsTimeline, kenBurnsCss } from "./motion.mjs";

const DEFAULT_PRESET = "fixtures/presets/light.json";
const COMPILER_STAMP_INPUTS = ["repo:src/compiler/**", "repo:blocks/**", "repo:package.json"];

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function validationError(schemaName, validation) {
  const violations = formatAjvErrors(validation.errors).map((message) => `- ${message}`).join("\n");
  return new Error(`schema validation failed: ${schemaName} (${validation.schemaPath})\n${violations}`);
}

function validateInput({ repoRoot, filePath, schemaName }) {
  const data = readJsonFile(filePath);
  const validation = validateJsonForSchema(repoRoot, data, schemaName);
  if (!validation.pass) throw validationError(schemaName, validation);

  const semantic = validateSemanticsForWrite({ repoRoot, schemaName, data, targetPath: filePath });
  if (!semantic.pass) {
    const violations = formatSemanticViolations(semantic.violations).map((message) => `- ${message}`).join("\n");
    throw new Error(`semantic validation failed: ${schemaName}\n${violations}`);
  }

  return data;
}

function resolveProjectFile(projectDir, name) {
  const filePath = path.join(projectDir, name);
  if (!existsSync(filePath)) throw new Error(`missing required compiler input: ${filePath}`);
  return filePath;
}

function resolvePresetPath(repoRoot, value) {
  const raw = value ?? DEFAULT_PRESET;
  return path.isAbsolute(raw) ? raw : path.resolve(repoRoot, raw);
}

function isPathInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function compilerVersionStamp({ repoRoot, presetPath }) {
  const packageJson = readJsonFile(path.join(repoRoot, "package.json"));
  const presetRel = normalizeRelPath(path.relative(repoRoot, presetPath));
  const presetInsideRepo = isPathInside(repoRoot, presetPath);
  const repoInputs = [
    ...COMPILER_STAMP_INPUTS,
    ...(presetInsideRepo ? [`repo:${presetRel}`] : [])
  ];
  const input = hashPatterns({ repoRoot, projectDir: repoRoot, patterns: repoInputs });
  const externalPreset = presetInsideRepo
    ? null
    : {
        path: normalizeRelPath(presetPath),
        bytes: readFileSync(presetPath).length,
        sha256: sha256Bytes(readFileSync(presetPath))
      };

  return {
    name: "reelforge-compiler",
    version: packageJson.version ?? null,
    sourceHash: input.hash,
    inputSet: input.entries.map((entry) => entry.path),
    presetPath: presetInsideRepo ? presetRel : normalizeRelPath(presetPath),
    externalPreset
  };
}

function sceneMapById(list, label) {
  const map = new Map();
  for (const item of list) {
    if (map.has(item.sceneId)) throw new Error(`${label} contains duplicate sceneId: ${item.sceneId}`);
    map.set(item.sceneId, item);
  }
  return map;
}

function assertSourceHashes({ scenes, audioByScene }) {
  for (const scene of scenes) {
    const audio = audioByScene.get(scene.sceneId);
    const expected = sha256Text(scene.narration_tts);
    if (audio.sourceHash !== expected) {
      throw new Error(
        `audio_meta sourceHash mismatch for ${scene.sceneId}: expected SHA-256(narration_tts) ${expected}, got ${audio.sourceHash}`
      );
    }
  }
}

function copiedAudioAssets({ projectDir, buildDir, audioScenes }) {
  const out = new Map();
  for (const audio of audioScenes) {
    const sourcePath = requireRelativeAsset(projectDir, audio.audioPath, `audio_meta.scenes[${audio.sceneId}].audioPath`);
    const ext = path.extname(sourcePath) || ".audio";
    const targetRel = normalizeRelPath(path.join("assets", "audio", `${audio.sceneId}${ext}`));
    copyAssetToBuild({ sourcePath, buildDir, targetRelPath: targetRel });
    out.set(audio.sceneId, {
      manifestPath: `./${targetRel}`,
      htmlPath: targetRel
    });
  }
  return out;
}

function readJsonIfExists(filePath, fallback = null) {
  return existsSync(filePath) ? readJsonFile(filePath) : fallback;
}

function imageResourceType(sceneId) {
  return `image_${sceneId}`;
}

function manifestAssetsForScene(imageManifest, sceneId) {
  return (imageManifest?.assets ?? []).filter((asset) => asset?.sceneId === sceneId && typeof asset?.path === "string");
}

function selectedVersionEntry(versions, sceneId) {
  const history = versions?.resources?.[imageResourceType(sceneId)];
  const selected = history?.selected;
  if (typeof selected !== "string") return null;
  const entries = Array.isArray(history?.entries) ? history.entries : [];
  const entry = entries.find((candidate) => candidate?.gen === selected);
  return entry?.path ? entry : null;
}

function imageTargetRelPath({ sceneId, assetPath, gen }) {
  const rel = String(assetPath).replace(/^\.\//, "");
  if (rel.startsWith("assets/images/")) return normalizeRelPath(rel);
  const ext = path.extname(rel) || ".png";
  const base = path.basename(rel, ext).replace(/[^A-Za-z0-9._-]+/g, "-") || "image";
  const genPart = gen ? `${gen}_` : "";
  return normalizeRelPath(path.join("assets", "images", `${sceneId}_${genPart}${base}${ext}`));
}

function resolveImageAssetForScene({ imageManifest, versions, scene }) {
  if (scene.visual_kind !== "generate_image") return null;

  const assets = manifestAssetsForScene(imageManifest, scene.sceneId);
  const selected = selectedVersionEntry(versions, scene.sceneId);
  if (selected) {
    const matched = assets.find((asset) => asset.gen === selected.gen);
    if (!matched) {
      throw new Error(
        `image-manifest.json missing selected asset for ${imageResourceType(scene.sceneId)} ${selected.gen}`
      );
    }
    return { ...matched, path: selected.path, selectedGen: selected.gen, source: "versions" };
  }

  const fallback = assets[0] ?? null;
  return fallback ? { ...fallback, selectedGen: fallback.gen ?? null, source: "image-manifest" } : null;
}

function copiedImageAssets({ projectDir, buildDir, scenes }) {
  const imageManifestPath = path.join(projectDir, "image-manifest.json");
  const imageManifest = readJsonIfExists(imageManifestPath);
  if (!imageManifest) return new Map();

  const versions = readJsonIfExists(path.join(projectDir, "versions.json"));
  const out = new Map();
  for (const scene of scenes) {
    const asset = resolveImageAssetForScene({ imageManifest, versions, scene });
    if (!asset) continue;

    const sourcePath = requireRelativeAsset(
      projectDir,
      asset.path,
      `image-manifest.assets[${asset.sceneId}].path`
    );
    const targetRel = imageTargetRelPath({
      sceneId: scene.sceneId,
      assetPath: asset.path,
      gen: asset.selectedGen
    });
    copyAssetToBuild({ sourcePath, buildDir, targetRelPath: targetRel });
    out.set(scene.sceneId, {
      ...asset,
      manifestPath: `./${targetRel}`,
      htmlPath: targetRel
    });
  }
  return out;
}

function resolveFontSource({ repoRoot, presetDir, tokenPath }) {
  const candidates = [
    path.resolve(repoRoot, tokenPath),
    path.resolve(presetDir, tokenPath),
    path.resolve(repoRoot, tokenPath.replace(/^\.\//, ""))
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error(`design token font file missing: ${tokenPath}`);
  return found;
}

function copiedDesignTokens({ repoRoot, buildDir, presetPath, tokens }) {
  const next = structuredClone(tokens);
  const presetDir = path.dirname(presetPath);
  for (const [role, roleConfig] of Object.entries(next.fonts ?? {})) {
    const files = asArray(roleConfig.files);
    files.forEach((font, index) => {
      const sourcePath = resolveFontSource({ repoRoot, presetDir, tokenPath: font.path });
      const targetRel = normalizeRelPath(
        path.join("assets", "fonts", `${role}-${index}-${path.basename(sourcePath)}`)
      );
      copyAssetToBuild({ sourcePath, buildDir, targetRelPath: targetRel });
      font.path = `./${targetRel}`;
    });
  }
  return next;
}

function fontFaceCss(tokens) {
  const blocks = [];
  for (const roleConfig of Object.values(tokens.fonts ?? {})) {
    const family = roleConfig.family;
    for (const file of asArray(roleConfig.files)) {
      const href = `../${String(file.path).replace(/^\.\//, "")}`;
      blocks.push(`@font-face {
  font-family: ${cssString(family)};
  src: ${cssUrl(href)} format("woff2");
  font-weight: ${file.weight ?? 400};
  font-style: ${file.style ?? "normal"};
}`);
    }
  }
  return blocks.join("\n");
}

function videoTheme(tokens) {
  return colorLuminance(tokens.colors?.background) > 0.5 ? "white" : "dark";
}

function contrastRatio(foreground, background) {
  const fg = colorLuminance(foreground);
  const bg = colorLuminance(background);
  const light = Math.max(fg, bg);
  const dark = Math.min(fg, bg);
  return (light + 0.05) / (dark + 0.05);
}

function isHexColor(value) {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(String(value ?? ""));
}

function minimumContrast(candidate, backgrounds) {
  if (!isHexColor(candidate) || backgrounds.length === 0) return 0;
  return Math.min(...backgrounds.map((background) => contrastRatio(candidate, background)));
}

function highContrastText(candidate, backgrounds) {
  const candidates = [candidate, "#F8FAFC", "#0F172A", "#FFFFFF", "#000000"].filter(isHexColor);
  const ranked = candidates
    .map((color) => ({ color, contrast: minimumContrast(color, backgrounds) }))
    .sort((a, b) => b.contrast - a.contrast);
  const current = ranked.find((entry) => entry.color === candidate);
  return current && current.contrast >= 4.5 ? current.color : ranked[0]?.color ?? candidate;
}

function subtitleCss(tokens) {
  const subtitle = tokens.subtitle;
  return `
        .subtitles {
          position: absolute;
          left: 50%;
          bottom: ${subtitle.bottomOffset}px;
          width: min(${subtitle.maxWidth}px, 78%);
          transform: translateX(-50%);
          box-sizing: border-box;
          padding: 18px 26px;
          border-radius: ${subtitle.borderRadius}px;
          background: ${subtitle.backgroundColor};
          color: ${subtitle.color};
          box-shadow: ${subtitle.boxShadow};
          font-family: ${cssString(subtitle.fontFamily)}, system-ui, sans-serif;
          font-size: ${subtitle.fontSize}px;
          font-weight: ${subtitle.fontWeight};
          line-height: ${subtitle.lineHeight};
          text-align: center;
          text-wrap: balance;
          overflow-wrap: anywhere;
          -webkit-text-stroke: ${subtitle.strokeWidth}px ${subtitle.strokeColor};
          paint-order: stroke fill;
          opacity: ${subtitle.visible ? 1 : 0};
	        }`;
}

function cssVarBlock(vars) {
  return Object.entries(vars)
    .filter(([, value]) => typeof value === "string" && value.length > 0)
    .map(([key, value]) => `${key}: ${value};`)
    .join(" ");
}

function blockFrameStyle({ scene, tokens }) {
  const mood = tokens.moods?.[scene.mood] ?? {};
  const imageBacked = Boolean(scene.renderImage);
  const surface = imageBacked ? "rgba(15, 23, 42, 0.78)" : tokens.colors?.surface;
  const panel = imageBacked ? "rgba(15, 23, 42, 0.68)" : tokens.colors?.panel;
  const textBackgrounds = imageBacked
    ? ["#0F172A"]
    : [tokens.colors?.panel, tokens.colors?.surface, tokens.colors?.background].filter(isHexColor);
  const text = highContrastText(tokens.colors?.text, textBackgrounds);
  return cssVarBlock({
    "--rf-text": text,
    "--rf-muted-text": text,
    "--rf-surface": surface,
    "--rf-panel": panel,
    "--rf-accent": mood.accent ?? tokens.colors?.accent,
    "--rf-shadow": tokens.colors?.shadow
  });
}

function revealTween(scene) {
  const base = {
    from: "{ opacity: 0, y: 28, scale: 1 }",
    to: "{ opacity: 1, y: 0, scale: 1, duration: 0.62, ease: \"power3.out\" }"
  };
  if (scene.reveal === "zoom_in") {
    return {
      from: "{ opacity: 0, y: 12, scale: 0.94 }",
      to: "{ opacity: 1, y: 0, scale: 1, duration: 0.68, ease: \"power3.out\" }"
    };
  }
  if (scene.reveal === "build_up" || scene.reveal === "cascade" || scene.reveal === "stagger") {
    return {
      from: "{ opacity: 0, y: 42, scale: 0.985 }",
      to: "{ opacity: 1, y: 0, scale: 1, duration: 0.78, ease: \"power4.out\" }"
    };
  }
  if (scene.reveal === "dramatic_pause" || scene.reveal === "spotlight") {
    return {
      from: "{ opacity: 0, y: 0, scale: 0.985 }",
      to: "{ opacity: 1, y: 0, scale: 1, duration: 0.9, ease: \"power2.out\" }"
    };
  }
  return base;
}

function blockRevealTween() {
  return {
    from: "{ opacity: 0, y: 10, scale: 0.996 }",
    to: "{ opacity: 1, y: 0, scale: 1, duration: 0.24, ease: \"power3.out\" }"
  };
}

function needsTitleScrim({ imageAsset, tokens }) {
  return Boolean(imageAsset) || colorLuminance(tokens.colors.background) <= 0.5;
}

function outgoingContentFadeTimeline({ scene, timing, block, fps }) {
  const outgoingFrames = timing.outgoingTransitionFrames ?? 0;
  if (outgoingFrames <= 0) return "";

  const overlapSec = secondsFromFrames(outgoingFrames, fps);
  const fadeDuration = Number(Math.max(1 / fps, Math.min(0.28, overlapSec, timing.durationSec * 0.18)).toFixed(6));
  const startSec = Number(Math.max(0, timing.durationSec - fadeDuration).toFixed(6));
  const target =
    block.kind === "block"
      ? `#${scene.sceneId}-block-frame, #${scene.sceneId}-subtitles`
      : `#${scene.sceneId}-content, #${scene.sceneId}-subtitles`;

  return `	          tl.to(${cssString(target)}, { opacity: 0, duration: ${fadeDuration}, ease: "power2.in" }, ${startSec});
	          tl.set(${cssString(target)}, { opacity: 0 }, ${timing.durationSec});`;
}

function headlineFallbackHtml({ scene, timing, canvasOverrides }) {
  const imageClass = scene.renderImage ? " has-image-asset" : "";
  return `        <main
          id="${scene.sceneId}-content"
          class="clip scene-content${classForCanvasOverrides(canvasOverrides)}${imageClass}"
          data-start="0"
          data-duration="${timing.durationSec}"
          data-track-index="2"
        >
          <div id="${scene.sceneId}-panel" class="headline-panel">
            <div class="headline-accent" aria-hidden="true"></div>
            <h1 id="${scene.sceneId}-headline">${htmlEscape(scene.headline)}</h1>
          </div>
        </main>`;
}

function sceneHtml({ scene, timing, tokens, block, renderFormat, fps, repeatIndex = 0 }) {
  const mood = tokens.moods?.[scene.mood] ?? {};
  const accent = mood.accent ?? tokens.colors.accent;
  const imageAsset = scene.renderImage ?? null;
  const foreground = imageAsset ? "#F8FAFC" : colorLuminance(tokens.colors.background) > 0.5 ? tokens.colors.text : "#F8FAFC";
  const panel = colorLuminance(tokens.colors.background) > 0.5 ? tokens.colors.surface : "rgba(15, 23, 42, 0.72)";
  const variables = blockVariablesForScene({ scene, tokens, repeatIndex });
  const rawBlockHost = blockHostHtml({ scene, timing, block, variables });
  const blockHost =
    block.kind === "block"
      ? blockFrameHtml({ sceneId: scene.sceneId, innerHtml: rawBlockHost, style: blockFrameStyle({ scene, tokens }) })
      : "";
  const canvasOverrides = resolveCanvasOverrides(scene, renderFormat.format);
  const content = block.kind === "block" ? blockHost : headlineFallbackHtml({ scene, timing, canvasOverrides });
  const subtitleData = subtitleHookData({ scene, timing });
  const hasSubtitleContent =
    Boolean(String(scene.narration ?? "").trim()) || (subtitleData?.words?.length ?? 0) > 0;
  const tween = block.kind === "block" ? blockRevealTween(scene) : revealTween(scene);
  const titleScrim = needsTitleScrim({ imageAsset, tokens });
  const outgoingFadeTimeline = outgoingContentFadeTimeline({ scene, timing, block, fps });
  const imageSrc = imageAsset ? `../${imageAsset.htmlPath}` : null;
  const imageLayer = imageAsset
    ? `          <img id="${scene.sceneId}-image" class="rf-scene-image" src="${htmlAttr(imageSrc)}" alt="" aria-hidden="true" />`
    : "";
  const imageCss = imageAsset
    ? `        .rf-scene-image {
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
${kenBurnsCss({ sceneId: scene.sceneId, hasImage: true })}`
    : "";
  const imageTimeline = imageAsset
    ? emitKenBurnsTimeline({
        sceneId: scene.sceneId,
        kenBurns: scene.kenBurns,
        durationSec: timing.durationSec,
        hasImage: true,
        width: renderFormat.width,
        height: renderFormat.height
      }).join("\n")
    : "";

  return `<!doctype html>
<!-- ${GENERATED_COMMENT} -->
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${renderFormat.width}, height=${renderFormat.height}" />
    <title>ReelForge ${htmlEscape(scene.sceneId)}</title>
      <style>
${fontFaceCss(tokens)}
        #root {
          position: absolute;
          inset: 0;
          width: ${renderFormat.width}px;
          height: ${renderFormat.height}px;
          overflow: hidden;
          isolation: isolate;
          color: ${foreground};
          font-family: ${cssString(tokens.fonts.body.family)}, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          ${cssVarsForFormat(renderFormat)}
        }
        #root[data-title-scrim="true"]::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 1;
          background:
            radial-gradient(ellipse 74% 58% at 50% 34%, rgba(2, 6, 23, 0.1), rgba(2, 6, 23, 0.42) 72%, rgba(2, 6, 23, 0.68) 100%),
            linear-gradient(0deg, rgba(2, 6, 23, 0.72) 0%, rgba(2, 6, 23, 0.38) 38%, rgba(2, 6, 23, 0.24) 100%);
          pointer-events: none;
        }
        .scene-bg {
          position: absolute;
          inset: 0;
          z-index: 0;
          box-sizing: border-box;
          background:
            linear-gradient(125deg, ${accent} 0%, transparent 34%),
            linear-gradient(315deg, ${tokens.colors.panel} 0%, transparent 28%),
            ${tokens.colors.background};
        }
        .scene-bg::after {
          content: "";
          position: absolute;
          inset: 42px;
          border: 2px solid color-mix(in srgb, ${accent} 42%, transparent);
          border-radius: 0;
          z-index: 3;
        }
        .scene-bg[data-has-image-asset="true"]::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 2;
          background:
            linear-gradient(0deg, rgba(2, 6, 23, 0.76) 0%, rgba(2, 6, 23, 0.44) 38%, rgba(2, 6, 23, 0.28) 100%),
            rgba(2, 6, 23, 0.36);
          pointer-events: none;
        }
        .scene-content,
        .block-host {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          box-sizing: border-box;
        }
        .scene-content {
          display: grid;
          place-items: center;
          padding: var(--rf-scene-padding-top) var(--rf-scene-padding-x) var(--rf-scene-padding-bottom);
          z-index: 2;
        }
        .scene-content.has-image-asset::before {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 44%;
          background: linear-gradient(0deg, rgba(2, 6, 23, 0.82) 0%, rgba(2, 6, 23, 0.54) 54%, rgba(2, 6, 23, 0) 100%);
          pointer-events: none;
        }
        .block-format-frame {
          position: absolute;
          left: var(--rf-block-left);
          top: var(--rf-block-top);
          width: var(--rf-reference-width);
          height: var(--rf-reference-height);
          transform: translate(-50%, -50%) scale(var(--rf-block-scale));
          transform-origin: center center;
          overflow: visible;
          z-index: 2;
        }
        .block-format-frame > .block-host {
          inset: 0;
          width: 100%;
          height: 100%;
        }
        .headline-panel {
          position: relative;
          z-index: 1;
          width: min(1420px, 100%);
          min-height: 360px;
          display: grid;
          align-content: center;
          gap: 28px;
          box-sizing: border-box;
          padding: 68px 78px;
          border-left: 16px solid ${accent};
          background: ${panel};
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.18);
        }
        .scene-content.has-image-asset .headline-panel {
          background: rgba(2, 6, 23, 0.78);
          box-shadow: 0 26px 82px rgba(2, 6, 23, 0.44);
        }
        .headline-accent {
          margin: 0;
          width: min(180px, 28%);
          height: 9px;
          background: ${accent};
        }
        h1 {
          margin: 0;
          max-width: 1260px;
          color: ${foreground};
          font-family: ${cssString(tokens.fonts.headline.family)}, ${cssString(tokens.fonts.body.family)}, system-ui, sans-serif;
          font-size: 96px;
          font-weight: 900;
          line-height: 1.04;
          letter-spacing: 0;
          word-break: keep-all;
          overflow-wrap: anywhere;
        }
        .scene-content.has-image-asset h1 {
          color: #F8FAFC;
          text-shadow:
            0 3px 18px rgba(0, 0, 0, 0.78),
            0 0 2px rgba(0, 0, 0, 0.92);
        }
	${subtitleCss(tokens)}
        .subtitles {
          z-index: 5;
        }
	${canvasOverrideCss({ sceneId: scene.sceneId, overrides: canvasOverrides })}
${imageCss}
      </style>
  </head>
  <body>
      <div
        id="root"
        data-composition-id="${scene.sceneId}"
        data-width="${renderFormat.width}"
        data-height="${renderFormat.height}"
        data-duration="${timing.durationSec}"
        data-title-scrim="${titleScrim ? "true" : "false"}"
      >
        <section
          id="${scene.sceneId}-bg"
          class="clip scene-bg"
          data-has-image-asset="${imageAsset ? "true" : "false"}"
          data-start="0"
          data-duration="${timing.durationSec}"
          data-track-index="1"
          aria-hidden="true"
        >
${imageLayer}
        </section>
${content}
${
  hasSubtitleContent
    ? `        <div
          id="${scene.sceneId}-subtitles"
          class="clip subtitles"
          data-start="0"
          data-duration="${timing.durationSec}"
          data-track-index="20"
          data-subtitle-mode="${htmlAttr(scene.subtitleMode)}"
          data-subtitles='${jsonAttr(subtitleData)}'
        >${htmlEscape(scene.narration)}</div>`
    : ""
}
      </div>
      <script src="${GSAP_CDN}"></script>
      <script>
        (function () {
          window.__timelines = window.__timelines || {};
          const tl = gsap.timeline({ paused: true });
          tl.fromTo("#${scene.sceneId}-bg", { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "none" }, 0);
          ${
            block.kind === "block"
              ? `tl.fromTo("#${scene.sceneId}-block-host", ${tween.from}, ${tween.to}, 0);`
              : `tl.fromTo("#${scene.sceneId}-panel", ${tween.from}, ${tween.to}, 0.1);`
          }
${
  hasSubtitleContent
    ? `	          tl.fromTo(
	            "#${scene.sceneId}-subtitles",
	            { opacity: 0, y: 18 },
	            { opacity: ${tokens.subtitle.visible ? 1 : 0}, y: 0, duration: 0.36, ease: "power2.out" },
	            0.36
	          );`
    : ""
}
${imageTimeline}
${outgoingFadeTimeline}
	          window.__timelines[${cssString(scene.sceneId)}] = tl;
        })();
      </script>
  </body>
</html>
`;
}

function indexHtml({ projectId, scenes, timing, audioAssets, bgm, transitions, tokens, renderFormat }) {
  const incomingFade = new Set(
    transitions
      .filter((transition) => transition.resolvedType === "crossfade" && transition.durationFrames > 0)
      .map((transition) => transition.to)
  );
  const slots = [];
  const audio = [];

  scenes.forEach((scene, index) => {
    const sceneTiming = timing.sceneTimings.get(scene.sceneId);
    const initialOpacity = incomingFade.has(scene.sceneId) ? 0 : 1;
    slots.push(`      <div
        id="slot-${scene.sceneId}"
        class="clip scene-slot"
        data-composition-id="${scene.sceneId}"
        data-composition-src="scenes/scene-${scene.sceneId}.html"
        data-start="${sceneTiming.startSec}"
        data-duration="${sceneTiming.slotDurationSec}"
        data-track-index="${index + 1}"
        data-width="${renderFormat.width}"
        data-height="${renderFormat.height}"
        style="opacity: ${initialOpacity}; z-index: ${index + 1}; --rf-scene-start: ${sceneTiming.startSec}s;"
      ></div>`);
    audio.push(`      <audio
        id="audio-${scene.sceneId}"
        src="${audioAssets.get(scene.sceneId).htmlPath}"
        data-start="${sceneTiming.startSec}"
        data-duration="${sceneTiming.durationSec}"
        data-track-index="${100 + index}"
        data-volume="1"
      ></audio>`);
  });

  const transitionLines = transitions.flatMap((transition) => transition.lines);
  const duckingLines = bgm ? emitDuckingTimeline({ keyframes: bgm.duckingKeyframes }) : [];
  const bgColor = tokens.colors?.background ?? "#0F172A";
  const bgmAudio = bgm
    ? `      <audio
        id="rf-bgm"
        src="${bgm.htmlPath}"
        data-start="0"
        data-duration="${timing.totalDurationSec}"
        data-track-index="900"
        data-volume="${bgm.volume}"
      ></audio>`
    : "";

  return `<!doctype html>
<!-- ${GENERATED_COMMENT} -->
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${renderFormat.width}, height=${renderFormat.height}" />
    <title>ReelForge ${htmlEscape(projectId)}</title>
    <script src="${GSAP_CDN}"></script>
    <style>
      html,
      body {
        margin: 0;
        width: ${renderFormat.width}px;
        height: ${renderFormat.height}px;
        overflow: hidden;
        background: ${bgColor};
      }
      #root {
        position: relative;
        width: ${renderFormat.width}px;
        height: ${renderFormat.height}px;
        overflow: hidden;
      }
      #root > div[data-composition-src] {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
      }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-width="${renderFormat.width}"
      data-height="${renderFormat.height}"
      data-start="0"
      data-duration="${timing.totalDurationSec}"
    >
${slots.join("\n")}
${audio.join("\n")}
${bgmAudio}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      (function () {
        const tl = gsap.timeline({ paused: true });
${transitionLines.join("\n")}
${duckingLines.join("\n")}
        window.__timelines["main"] = tl;
      })();
    </script>
  </body>
</html>
`;
}

function projectHasBgm(specs) {
  return (specs.scenes ?? []).some((scene) => scene.ost !== undefined && scene.ost !== null && scene.ost !== 0);
}

function buildBgm({ specs, projectDir, tmpDir, scenes, audioMeta, timing }) {
  if (!projectHasBgm(specs)) return null;

  const volume = DEFAULT_BGM_VOLUME;
  const ducking = buildDuckingFromAudioMeta({
    scenes,
    audioMeta,
    sceneTimings: timing.sceneTimings,
    totalDurationSec: timing.totalDurationSec,
    bgmVolume: volume,
    speechVolume: DEFAULT_SPEECH_VOLUME
  });
  const projectTrack = ["bgm.mp3", "bgm.wav", "bgm.ogg"]
    .map((name) => path.join(projectDir ?? "", "assets", "audio", name))
    .find((candidate) => existsSync(candidate));
  let manifestPath;
  let htmlPath;
  if (projectTrack) {
    htmlPath = `assets/audio/${path.basename(projectTrack)}`;
    manifestPath = `./${htmlPath}`;
    copyAssetToBuild({ sourcePath: projectTrack, buildDir: tmpDir, targetRelPath: htmlPath });
  } else {
    manifestPath = "./assets/audio/bgm-silence.wav";
    htmlPath = "assets/audio/bgm-silence.wav";
    writeSilentWav(path.join(tmpDir, htmlPath), timing.totalDurationSec);
  }

  return {
    manifestPath,
    htmlPath,
    volume,
    duckingKeyframes: ducking.keyframes,
    duckingWindows: ducking.windows
  };
}

function buildManifest({
  specs,
  scenes,
  audioByScene,
  audioAssets,
  imageAssets,
  timing,
  tokens,
  transitions,
  bgm,
  compilerVersion,
  renderFormat
}) {
  return {
    meta: {
      resolution: { width: renderFormat.width, height: renderFormat.height },
      fps: timing.fps,
      videoTheme: videoTheme(tokens),
      designTokens: tokens,
      subtitleConfig: tokens.subtitle,
      compilerVersion
    },
    scenes: scenes.map((scene) => {
      const sceneTiming = timing.sceneTimings.get(scene.sceneId);
      const subtitle = staticSubtitleForScene({ scene, timing: sceneTiming });
      return {
        sceneId: scene.sceneId,
        path: `scenes/scene-${scene.sceneId}.html`,
        audioPath: audioAssets.get(scene.sceneId).manifestPath,
        audioDurationSec: sceneTiming.audioDurationSec,
        durationFrames: sceneTiming.durationFrames,
        subtitles: [subtitle],
        vizAnimation: {
          stagger: 0.06,
          itemSyncPoints: sceneTiming.words.map((word, index) => ({
            itemIndex: index,
            label: word.word,
            startSec: word.start
          }))
        },
        imagePath: imageAssets.get(scene.sceneId)?.manifestPath ?? null,
        kenBurns: scene.kenBurns,
        startFrame: sceneTiming.startFrame
      };
    }),
    transitions: resolvedTransitionsForManifest({
      transitions: specs.transitions ?? [],
      transitionFrames: timing.transitionFrames,
      sceneTimings: timing.sceneTimings,
      fps: timing.fps
    }),
    bgm: bgm
      ? {
          path: bgm.manifestPath,
          volume: bgm.volume,
          duckingKeyframes: bgm.duckingKeyframes
        }
      : null,
    formatOverrides: formatOverridesForManifest({ scenes, timing, fps: timing.fps })
  };
}

function patchSceneSubtitleForFormat({ tmpDir, sceneId, subtitle }) {
  const scenePath = path.join(tmpDir, "scenes", `scene-${sceneId}.html`);
  const html = readFileSync(scenePath, "utf8");
  writeFileEnsured(scenePath, patchSubtitleCssForFormat(html, subtitle));
}

function writeManifestViaVf({ repoRoot, manifestPath, manifest }) {
  const result = spawnSync(process.execPath, ["bin/vf", "write", manifestPath, "--schema", "render-manifest"], {
    cwd: repoRoot,
    input: JSON.stringify(manifest),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error(`vf write render-manifest failed\n${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim());
  }
  return JSON.parse(result.stdout);
}

function renderLintError(lint) {
  const custom = lint.custom.violations
    .map((item) => `- ${item.file}: ${item.rule} ${JSON.stringify(item.measured ?? {})}`)
    .join("\n");
  return new Error(
    [
      "render lint failed",
      `hyperframes exitCode=${lint.hyperframes.exitCode}`,
      lint.hyperframes.stderr?.trim(),
      lint.hyperframes.stdout?.trim(),
      custom
    ]
      .filter(Boolean)
      .join("\n")
  );
}

export function compileProject({
  repoRoot,
  projectDir,
  presetPath = null,
  fps = DEFAULT_FPS,
  runLint = true,
  format = null
}) {
  const selectedFormat = formatSpec(resolveCompileFormat(format));
  const absoluteProjectDir = path.resolve(repoRoot, projectDir);
  const sceneSpecsPath = resolveProjectFile(absoluteProjectDir, "scene_specs.json");
  const audioMetaPath = resolveProjectFile(absoluteProjectDir, "audio_meta.json");
  const absolutePresetPath = resolvePresetPath(repoRoot, presetPath);
  if (!existsSync(absolutePresetPath)) throw new Error(`missing design token preset: ${absolutePresetPath}`);

  const specs = validateInput({ repoRoot, filePath: sceneSpecsPath, schemaName: "scene-specs" });
  const audioMeta = validateInput({ repoRoot, filePath: audioMetaPath, schemaName: "audio-meta" });
  const presetTokens = validateInput({ repoRoot, filePath: absolutePresetPath, schemaName: "design-tokens" });
  const compilerVersion = compilerVersionStamp({ repoRoot, presetPath: absolutePresetPath });

  const scenes = specs.scenes ?? [];
  const audioByScene = sceneMapById(audioMeta.scenes ?? [], "audio_meta.scenes");
  assertSourceHashes({ scenes, audioByScene });

  const buildDir = path.join(absoluteProjectDir, "build");
  const tmpDir = path.join(absoluteProjectDir, `.build-tmp-${process.pid}-${Date.now()}`);
  resetDir(tmpDir);

  try {
    const baseTokens = copiedDesignTokens({ repoRoot, buildDir: tmpDir, presetPath: absolutePresetPath, tokens: presetTokens });
    const tokens = tokensForFormat(baseTokens, selectedFormat.format);
    const audioAssets = copiedAudioAssets({ projectDir: absoluteProjectDir, buildDir: tmpDir, audioScenes: audioMeta.scenes });
    const imageAssets = copiedImageAssets({ projectDir: absoluteProjectDir, buildDir: tmpDir, scenes });
    const renderScenes = scenes.map((scene) =>
      imageAssets.has(scene.sceneId) ? { ...scene, renderImage: imageAssets.get(scene.sceneId) } : scene
    );
    const timing = buildTiming({ scenes, audioByScene, transitions: specs.transitions ?? [], fps });
    const bgm = buildBgm({ specs, projectDir: absoluteProjectDir, tmpDir, scenes, audioMeta, timing });

    const warnings = [...timing.warnings];
    const blockByScene = new Map();
    const repeatIndexByScene = new Map();
    const layoutCounts = new Map();
    for (const scene of renderScenes) {
      const count = layoutCounts.get(scene.layout) ?? 0;
      repeatIndexByScene.set(scene.sceneId, count);
      layoutCounts.set(scene.layout, count + 1);
    }
    for (const scene of renderScenes) {
      const block = resolveBlock({ repoRoot, buildDir: tmpDir, layout: scene.layout });
      warnings.push(...block.warnings.map((warning) => ({ sceneId: scene.sceneId, ...warning })));
      blockByScene.set(scene.sceneId, block);
      writeFileEnsured(
	        path.join(tmpDir, "scenes", `scene-${scene.sceneId}.html`),
	        sceneHtml({
          scene,
          timing: timing.sceneTimings.get(scene.sceneId),
          tokens,
          block,
          renderFormat: selectedFormat,
          fps,
          repeatIndex: repeatIndexByScene.get(scene.sceneId) ?? 0
        })
	      );
    }

    const transitions = (specs.transitions ?? []).map((transition) => {
      const durationFrames = timing.transitionFrames.get(`${transition.from}->${transition.to}`) ?? 0;
      const toTiming = timing.sceneTimings.get(transition.to);
      const startFrame = toTiming.startFrame;
      const emitted = emitTransition({
        transition,
        fromSlotId: `slot-${transition.from}`,
        toSlotId: `slot-${transition.to}`,
        startFrame,
        durationFrames,
        fps
      });
      warnings.push(...emitted.warnings);
      return { ...transition, startFrame, durationFrames, resolvedType: emitted.resolvedType, lines: emitted.lines };
    });

    writeFileEnsured(
      path.join(tmpDir, "index.html"),
      indexHtml({ projectId: specs.projectId, scenes, timing, audioAssets, bgm, transitions, tokens, renderFormat: selectedFormat })
    );

    const manifest = buildManifest({
      specs,
      scenes: renderScenes,
      audioByScene,
      audioAssets,
      imageAssets,
      timing,
      tokens,
      transitions,
      bgm,
      compilerVersion,
      renderFormat: selectedFormat
    });
    for (const scene of scenes) {
      patchSceneSubtitleForFormat({ tmpDir, sceneId: scene.sceneId, subtitle: tokens.subtitle });
    }
    const manifestRel = normalizeRelPath(path.relative(repoRoot, path.join(tmpDir, "render-manifest.json")));
    const writeResult = writeManifestViaVf({ repoRoot, manifestPath: manifestRel, manifest });

    const lint = runLint ? runRenderLint({ repoRoot, buildDir: tmpDir, scenes }) : { pass: true };
    if (!lint.pass) throw renderLintError(lint);

    atomicReplaceDir(tmpDir, buildDir);

    return {
      pass: true,
      projectDir: normalizeRelPath(path.relative(repoRoot, absoluteProjectDir)),
      buildDir: normalizeRelPath(path.relative(repoRoot, buildDir)),
      presetPath: normalizeRelPath(path.relative(repoRoot, absolutePresetPath)),
      compilerVersion,
      schemaValidation: {
        sceneSpecs: schemaPathForName("scene-specs"),
        audioMeta: schemaPathForName("audio-meta"),
        designTokens: schemaPathForName("design-tokens"),
        renderManifest: {
          ...writeResult,
          file: normalizeRelPath(path.relative(repoRoot, path.join(buildDir, "render-manifest.json")))
        }
      },
      timing: {
        fps,
        format: selectedFormat.format,
        totalFrames: timing.totalFrames,
        totalDurationSec: timing.totalDurationSec,
        expectedFrameSum: scenes.reduce((sum, scene) => sum + timing.sceneTimings.get(scene.sceneId).durationFrames, 0)
      },
      scenes: scenes.map((scene) => {
        const sceneTiming = timing.sceneTimings.get(scene.sceneId);
        const block = blockByScene.get(scene.sceneId);
        return {
          sceneId: scene.sceneId,
          layout: scene.layout,
          block: block.kind,
          startFrame: sceneTiming.startFrame,
          durationFrames: sceneTiming.durationFrames,
          slotDurationFrames: sceneTiming.slotDurationFrames,
          path: `scenes/scene-${scene.sceneId}.html`
        };
      }),
      transitions: transitions.map(({ lines, ...transition }) => transition),
      transitionHook: transitionHookSignature(),
      warnings,
      renderLint: runLint
        ? {
            hyperframesExitCode: lint.hyperframes.exitCode,
            customViolations: lint.custom.violations.length
          }
        : null
    };
  } catch (error) {
    rmSync(tmpDir, { recursive: true, force: true });
    throw error;
  }
}

export { DEFAULT_PRESET };

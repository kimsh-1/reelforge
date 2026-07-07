import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
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
import {
  DEFAULT_BGM_VOLUME,
  DEFAULT_SPEECH_VOLUME,
  buildDuckingFromAudioMeta,
  emitDuckingTimeline
} from "./audio-duck.mjs";
import { blockHostHtml, blockVariablesForScene, resolveBlock } from "./blocks.mjs";
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
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
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
  sha256Text,
  writeFileEnsured,
  writeSilentWav
} from "./utils.mjs";

const DEFAULT_PRESET = "fixtures/presets/light.json";

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

function headlineFallbackHtml({ scene, timing }) {
  return `        <main
          id="${scene.sceneId}-content"
          class="clip scene-content"
          data-start="0"
          data-duration="${timing.durationSec}"
          data-track-index="2"
        >
          <div id="${scene.sceneId}-panel" class="headline-panel">
            <p id="${scene.sceneId}-mood" class="mood-label">${htmlEscape(scene.mood)}</p>
            <h1 id="${scene.sceneId}-headline">${htmlEscape(scene.headline)}</h1>
          </div>
        </main>`;
}

function sceneHtml({ scene, timing, tokens, block }) {
  const mood = tokens.moods?.[scene.mood] ?? {};
  const accent = mood.accent ?? tokens.colors.accent;
  const foreground = colorLuminance(tokens.colors.background) > 0.5 ? tokens.colors.text : "#F8FAFC";
  const muted = colorLuminance(tokens.colors.background) > 0.5 ? tokens.colors.mutedText : "#CBD5E1";
  const panel = colorLuminance(tokens.colors.background) > 0.5 ? tokens.colors.surface : "rgba(15, 23, 42, 0.72)";
  const variables = blockVariablesForScene({ scene, tokens });
  const blockHost = blockHostHtml({ scene, timing, block, variables });
  const content = block.kind === "block" ? blockHost : headlineFallbackHtml({ scene, timing });
  const subtitleData = subtitleHookData({ scene, timing });
  const tween = revealTween(scene);

  return `<!doctype html>
<!-- ${GENERATED_COMMENT} -->
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${DEFAULT_WIDTH}, height=${DEFAULT_HEIGHT}" />
    <title>ReelForge ${htmlEscape(scene.sceneId)}</title>
      <style>
${fontFaceCss(tokens)}
        #root {
          position: absolute;
          inset: 0;
          width: ${DEFAULT_WIDTH}px;
          height: ${DEFAULT_HEIGHT}px;
          overflow: hidden;
          color: ${foreground};
          font-family: ${cssString(tokens.fonts.body.family)}, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .scene-bg {
          position: absolute;
          inset: 0;
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
          padding: 96px 136px 184px;
        }
        .headline-panel {
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
        .mood-label {
          margin: 0;
          color: ${muted};
          font-size: 31px;
          font-weight: 780;
          line-height: 1;
          letter-spacing: 0;
          text-transform: uppercase;
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
${subtitleCss(tokens)}
      </style>
  </head>
  <body>
      <div
        id="root"
        data-composition-id="${scene.sceneId}"
        data-width="${DEFAULT_WIDTH}"
        data-height="${DEFAULT_HEIGHT}"
        data-duration="${timing.durationSec}"
      >
        <section
          id="${scene.sceneId}-bg"
          class="clip scene-bg"
          data-start="0"
          data-duration="${timing.durationSec}"
          data-track-index="1"
          aria-hidden="true"
        ></section>
${content}
        <div
          id="${scene.sceneId}-subtitles"
          class="clip subtitles"
          data-start="0"
          data-duration="${timing.durationSec}"
          data-track-index="20"
          data-subtitle-mode="${htmlAttr(scene.subtitleMode)}"
          data-subtitles='${jsonAttr(subtitleData)}'
        >${htmlEscape(scene.narration)}</div>
      </div>
      <script src="${GSAP_CDN}"></script>
      <script>
        (function () {
          window.__timelines = window.__timelines || {};
          const tl = gsap.timeline({ paused: true });
          tl.fromTo("#${scene.sceneId}-bg", { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "none" }, 0);
          ${
            block.kind === "block"
              ? `tl.fromTo("#${scene.sceneId}-block-host", ${tween.from}, ${tween.to}, 0.1);`
              : `tl.fromTo("#${scene.sceneId}-panel", ${tween.from}, ${tween.to}, 0.1);`
          }
          tl.fromTo(
            "#${scene.sceneId}-subtitles",
            { opacity: 0, y: 18 },
            { opacity: ${tokens.subtitle.visible ? 1 : 0}, y: 0, duration: 0.36, ease: "power2.out" },
            0.36
          );
          window.__timelines[${cssString(scene.sceneId)}] = tl;
        })();
      </script>
  </body>
</html>
`;
}

function indexHtml({ projectId, scenes, timing, audioAssets, bgm, transitions, tokens }) {
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
        data-width="${DEFAULT_WIDTH}"
        data-height="${DEFAULT_HEIGHT}"
        style="opacity: ${initialOpacity}; z-index: ${index + 1};"
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
    <meta name="viewport" content="width=${DEFAULT_WIDTH}, height=${DEFAULT_HEIGHT}" />
    <title>ReelForge ${htmlEscape(projectId)}</title>
    <script src="${GSAP_CDN}"></script>
    <style>
      html,
      body {
        margin: 0;
        width: ${DEFAULT_WIDTH}px;
        height: ${DEFAULT_HEIGHT}px;
        overflow: hidden;
        background: ${bgColor};
      }
      #root {
        position: relative;
        width: ${DEFAULT_WIDTH}px;
        height: ${DEFAULT_HEIGHT}px;
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
      data-width="${DEFAULT_WIDTH}"
      data-height="${DEFAULT_HEIGHT}"
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

function buildBgm({ specs, tmpDir, scenes, audioMeta, timing }) {
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
  const manifestPath = "./assets/audio/bgm-silence.wav";
  const htmlPath = "assets/audio/bgm-silence.wav";
  writeSilentWav(path.join(tmpDir, htmlPath), timing.totalDurationSec);

  return {
    manifestPath,
    htmlPath,
    volume,
    duckingKeyframes: ducking.keyframes,
    duckingWindows: ducking.windows
  };
}

function buildManifest({ specs, scenes, audioByScene, audioAssets, timing, tokens, transitions, bgm }) {
  return {
    meta: {
      resolution: { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
      fps: timing.fps,
      videoTheme: videoTheme(tokens),
      designTokens: tokens,
      subtitleConfig: tokens.subtitle
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
        imagePath: null,
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
    formatOverrides: {}
  };
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
  runLint = true
}) {
  const absoluteProjectDir = path.resolve(repoRoot, projectDir);
  const sceneSpecsPath = resolveProjectFile(absoluteProjectDir, "scene_specs.json");
  const audioMetaPath = resolveProjectFile(absoluteProjectDir, "audio_meta.json");
  const absolutePresetPath = resolvePresetPath(repoRoot, presetPath);
  if (!existsSync(absolutePresetPath)) throw new Error(`missing design token preset: ${absolutePresetPath}`);

  const specs = validateInput({ repoRoot, filePath: sceneSpecsPath, schemaName: "scene-specs" });
  const audioMeta = validateInput({ repoRoot, filePath: audioMetaPath, schemaName: "audio-meta" });
  const presetTokens = validateInput({ repoRoot, filePath: absolutePresetPath, schemaName: "design-tokens" });

  const scenes = specs.scenes ?? [];
  const audioByScene = sceneMapById(audioMeta.scenes ?? [], "audio_meta.scenes");
  assertSourceHashes({ scenes, audioByScene });

  const buildDir = path.join(absoluteProjectDir, "build");
  const tmpDir = path.join(absoluteProjectDir, `.build-tmp-${process.pid}-${Date.now()}`);
  resetDir(tmpDir);

  try {
    const tokens = copiedDesignTokens({ repoRoot, buildDir: tmpDir, presetPath: absolutePresetPath, tokens: presetTokens });
    const audioAssets = copiedAudioAssets({ projectDir: absoluteProjectDir, buildDir: tmpDir, audioScenes: audioMeta.scenes });
    const timing = buildTiming({ scenes, audioByScene, transitions: specs.transitions ?? [], fps });
    const bgm = buildBgm({ specs, tmpDir, scenes, audioMeta, timing });

    const warnings = [...timing.warnings];
    const blockByScene = new Map();
    for (const scene of scenes) {
      const block = resolveBlock({ repoRoot, buildDir: tmpDir, layout: scene.layout });
      warnings.push(...block.warnings.map((warning) => ({ sceneId: scene.sceneId, ...warning })));
      blockByScene.set(scene.sceneId, block);
      writeFileEnsured(
        path.join(tmpDir, "scenes", `scene-${scene.sceneId}.html`),
        sceneHtml({ scene, timing: timing.sceneTimings.get(scene.sceneId), tokens, block })
      );
    }

    const transitions = (specs.transitions ?? []).map((transition) => {
      const durationFrames = timing.transitionFrames.get(`${transition.from}->${transition.to}`) ?? 0;
      const toTiming = timing.sceneTimings.get(transition.to);
      const startFrame = Math.max(0, toTiming.startFrame - durationFrames);
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
      indexHtml({ projectId: specs.projectId, scenes, timing, audioAssets, bgm, transitions, tokens })
    );

    const manifest = buildManifest({
      specs,
      scenes,
      audioByScene,
      audioAssets,
      timing,
      tokens,
      transitions,
      bgm
    });
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

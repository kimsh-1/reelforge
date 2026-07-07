import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from "./utils.mjs";

export const DEFAULT_FORMAT = "16:9";
export const SUPPORTED_FORMATS = ["16:9", "9:16", "1:1"];

const FORMAT_DIMENSIONS = {
  "16:9": { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, slug: "16x9" },
  "9:16": { width: DEFAULT_HEIGHT, height: DEFAULT_WIDTH, slug: "9x16" },
  "1:1": { width: DEFAULT_HEIGHT, height: DEFAULT_HEIGHT, slug: "1x1" }
};

const BASE_SCENE_PADDING = {
  top: 96,
  x: 136,
  bottom: 184
};

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundPx(value) {
  return Math.max(0, Math.round(value));
}

function deepMergeObject(base, override) {
  if (!base && !override) return null;
  const out = {};
  for (const source of [base, override]) {
    if (!source || typeof source !== "object" || Array.isArray(source)) continue;
    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        out[key] = deepMergeObject(out[key], value);
      } else {
        out[key] = value;
      }
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

function stripByFormat(overrides) {
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) return null;
  const { byFormat, ...base } = overrides;
  return Object.keys(base).length > 0 ? base : null;
}

function formatFromArgv(argv) {
  const index = argv.indexOf("--format");
  if (index < 0) return null;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error("--format requires one of: 16:9, 9:16, 1:1");
  return value;
}

export function normalizeFormat(value) {
  const format = String(value ?? DEFAULT_FORMAT).trim();
  if (!SUPPORTED_FORMATS.includes(format)) {
    throw new Error(`unsupported compile format "${format}"; expected one of: ${SUPPORTED_FORMATS.join(", ")}`);
  }
  return format;
}

export function resolveCompileFormat(value, argv = process.argv) {
  return normalizeFormat(value ?? formatFromArgv(argv) ?? DEFAULT_FORMAT);
}

export function formatSpec(value) {
  const format = normalizeFormat(value);
  const dimensions = FORMAT_DIMENSIONS[format];
  const blockScale = Math.min(dimensions.width / DEFAULT_WIDTH, dimensions.height / DEFAULT_HEIGHT);
  const subtitle = subtitleConfigForFormat({}, format);
  const scenePadding =
    format === DEFAULT_FORMAT
      ? BASE_SCENE_PADDING
      : {
          top: roundPx(Math.max(56, dimensions.height * 0.08)),
          x: roundPx(Math.max(52, dimensions.width * 0.07)),
          bottom: roundPx(subtitle.bottomOffset + Math.max(112, dimensions.height * 0.07))
        };

  return {
    format,
    slug: dimensions.slug,
    width: dimensions.width,
    height: dimensions.height,
    referenceWidth: DEFAULT_WIDTH,
    referenceHeight: DEFAULT_HEIGHT,
    blockScale,
    scenePadding
  };
}

export function allFormatSpecs() {
  return SUPPORTED_FORMATS.map((format) => formatSpec(format));
}

export function subtitleConfigForFormat(subtitle, formatValue) {
  const spec = FORMAT_DIMENSIONS[normalizeFormat(formatValue)];
  const baseBottomOffset = finiteNumber(subtitle.bottomOffset, 96);
  const baseMaxWidth = finiteNumber(subtitle.maxWidth, 920);
  const horizontalSafePx = Math.max(48, roundPx(spec.width * 0.08));
  const bottomSafePx = Math.max(baseBottomOffset, roundPx(spec.height * 0.075));

  return {
    ...subtitle,
    bottomOffset: bottomSafePx,
    maxWidth: Math.max(320, Math.min(baseMaxWidth, spec.width - horizontalSafePx * 2))
  };
}

export function tokensForFormat(tokens, formatValue) {
  const next = structuredClone(tokens);
  next.subtitle = subtitleConfigForFormat(next.subtitle ?? {}, formatValue);
  return next;
}

export function cssVarsForFormat(spec) {
  const blockLeft = roundPx(spec.width / 2);
  const blockTop = roundPx(spec.height / 2);
  const scale = Number(spec.blockScale.toFixed(6));
  return [
    `--rf-format-width: ${spec.width}px;`,
    `--rf-format-height: ${spec.height}px;`,
    `--rf-reference-width: ${spec.referenceWidth}px;`,
    `--rf-reference-height: ${spec.referenceHeight}px;`,
    `--rf-block-left: ${blockLeft}px;`,
    `--rf-block-top: ${blockTop}px;`,
    `--rf-block-scale: ${scale};`,
    `--rf-scene-padding-top: ${spec.scenePadding.top}px;`,
    `--rf-scene-padding-x: ${spec.scenePadding.x}px;`,
    `--rf-scene-padding-bottom: ${spec.scenePadding.bottom}px;`
  ].join("\n          ");
}

export function blockFrameHtml({ sceneId, innerHtml }) {
  return `        <div id="${sceneId}-block-frame" class="block-format-frame">
${innerHtml}
        </div>`;
}

export function resolveCanvasOverrides(scene, formatValue) {
  const overrides = scene.overrides;
  if (!overrides) return null;
  const base = stripByFormat(overrides);
  const byFormat = overrides.byFormat?.[normalizeFormat(formatValue)] ?? null;
  return deepMergeObject(base, byFormat);
}

function percentBoxCss(box) {
  if (!box) return "";
  return [
    box.x !== undefined ? `left: ${box.x}%;` : "",
    box.y !== undefined ? `top: ${box.y}%;` : "",
    box.width !== undefined ? `width: ${box.width}%;` : "",
    box.height !== undefined ? `min-height: ${box.height}%;` : ""
  ]
    .filter(Boolean)
    .join("\n          ");
}

export function canvasOverrideCss({ sceneId, overrides }) {
  const headlineCss = percentBoxCss(overrides?.headline);
  if (!headlineCss) return "";
  return `
        #${sceneId}-content.has-headline-override {
          display: block;
          padding: 0;
        }
        #${sceneId}-content.has-headline-override .headline-panel {
          position: absolute;
          ${headlineCss}
        }`;
}

export function classForCanvasOverrides(overrides) {
  return overrides?.headline ? " has-headline-override" : "";
}

export function formatOverridesForManifest({ scenes, timing, fps }) {
  const out = {};
  for (const spec of allFormatSpecs()) {
    out[spec.format] = {
      resolution: { width: spec.width, height: spec.height },
      fps,
      scenes: Object.fromEntries(
        scenes.map((scene) => {
          const sceneTiming = timing.sceneTimings.get(scene.sceneId);
          const sceneOverride = {
            startFrame: sceneTiming.startFrame,
            durationFrames: sceneTiming.durationFrames
          };
          const overrides = resolveCanvasOverrides(scene, spec.format);
          if (overrides) sceneOverride.overrides = overrides;
          return [scene.sceneId, sceneOverride];
        })
      )
    };
  }
  return out;
}

export function patchSubtitleCssForFormat(html, subtitle) {
  const bottom = roundPx(finiteNumber(subtitle.bottomOffset, 96));
  const maxWidth = roundPx(finiteNumber(subtitle.maxWidth, 920));
  return html
    .replace(/(\.subtitles[^{]*\{[\s\S]*?\bbottom:\s*)-?\d+(?:\.\d+)?px;/g, `$1${bottom}px;`)
    .replace(/(\.subtitles\s*\{[\s\S]*?\bwidth:\s*min\()\d+(?:\.\d+)?px,/g, `$1${maxWidth}px,`)
    .replace(/(\.subtitles\.rf-subtitles-enhanced\s*\{[\s\S]*?\bmax-width:\s*min\()\d+(?:\.\d+)?px,/g, `$1${maxWidth}px,`);
}

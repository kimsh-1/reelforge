import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { applyLivingBackgroundToSceneHtml } from "./motion.mjs";

const DEFAULT_SUBTITLE = {
  fontFamily: "Pretendard",
  fontSize: 46,
  fontWeight: 800,
  color: "#111827",
  strokeColor: "#FFFFFF",
  strokeWidth: 3,
  keywordColor: "#1D4ED8",
  keywordStrokeColor: "#FFFFFF",
  backgroundColor: "#FFFFFF",
  borderRadius: 8,
  boxShadow: "0 10px 30px #CBD5E1",
  bottomOffset: 96,
  maxWidth: 920,
  lineHeight: 1.18,
  maxCharsPerLine: 22,
  visible: true
};

const DEFAULT_PRESET = "fixtures/presets/light.json";
const RENDERER = "p2-02-subtitles";
const hookDataBySceneId = new Map();
const patchedSceneFiles = new Set();
let cachedSubtitleStylePath = null;
let cachedSubtitleStyle = null;

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function syllableHtml(value) {
  return Array.from(String(value ?? ""))
    .map((char, index) => {
      if (/\s/u.test(char)) return htmlEscape(char);
      return `<span class="rf-subtitle-syllable" data-rf-syllable-index="${index}">${htmlEscape(char)}</span>`;
    })
    .join("");
}

function cssString(value) {
  return JSON.stringify(String(value ?? ""));
}

function escapeRegExp(value) {
  return String(value).replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function uniqueStrings(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

function presetPathFromArgv() {
  const raw = optionValue("--preset") ?? DEFAULT_PRESET;
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

function loadSubtitleStyle() {
  const presetPath = presetPathFromArgv();
  if (cachedSubtitleStyle && cachedSubtitleStylePath === presetPath) return cachedSubtitleStyle;
  try {
    const preset = JSON.parse(readFileSync(presetPath, "utf8"));
    cachedSubtitleStyle = { ...DEFAULT_SUBTITLE, ...(preset.subtitle ?? {}) };
  } catch {
    cachedSubtitleStyle = { ...DEFAULT_SUBTITLE };
  }
  cachedSubtitleStylePath = presetPath;
  return cachedSubtitleStyle;
}

function compileProjectDirFromArgv() {
  const explicit = process.env.REELFORGE_COMPILE_PROJECT_DIR;
  if (explicit) return path.resolve(process.cwd(), explicit);

  const compileIndex = process.argv.findIndex((arg) => arg === "compile");
  if (compileIndex < 0) return null;
  const projectDir = process.argv.slice(compileIndex + 1).find((arg) => !arg.startsWith("--"));
  return projectDir ? path.resolve(process.cwd(), projectDir) : null;
}

function newestBuildTmpDir(projectDir) {
  if (!projectDir || !existsSync(projectDir)) return null;
  const candidates = readdirSync(projectDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(".build-tmp-"))
    .map((entry) => {
      const dir = path.join(projectDir, entry.name);
      return { dir, mtimeMs: statSync(dir).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.dir ?? null;
}

function compiledScenePath(sceneId) {
  const projectDir = compileProjectDirFromArgv();
  const tmpDir = newestBuildTmpDir(projectDir);
  if (!tmpDir) return null;
  const candidate = path.join(tmpDir, "scenes", `scene-${sceneId}.html`);
  return existsSync(candidate) ? candidate : null;
}

function visibleLength(value) {
  return Array.from(String(value ?? "").replace(/\s+/g, " ")).length;
}

function addLineBreaks(tokens, maxCharsPerLine) {
  const limit = Math.max(1, Number.parseInt(maxCharsPerLine, 10) || DEFAULT_SUBTITLE.maxCharsPerLine);
  const html = [];
  let lineLength = 0;
  for (const token of tokens) {
    const tokenLength = visibleLength(token.text);
    if (token.breakBefore && lineLength > 0 && lineLength + tokenLength > limit) {
      html.push('<br data-rf-wrap="maxCharsPerLine" />');
      lineLength = 0;
    }
    html.push(token.html);
    lineLength += tokenLength;
  }
  return html.join("");
}

function textToken(text) {
  if (!text) return null;
  return {
    text,
    html: `<span class="rf-subtitle-text">${syllableHtml(text)}</span>`,
    breakBefore: false
  };
}

function wordToken(word, index) {
  return {
    text: word,
    html: `<span class="rf-subtitle-word is-future" data-rf-word-index="${index}">${syllableHtml(word)}</span>`,
    breakBefore: true
  };
}

function isPunctuation(char) {
  return /^\p{P}$/u.test(char);
}

function splitEdgePunctuation(value) {
  const chars = Array.from(String(value ?? ""));
  let start = 0;
  let end = chars.length;
  while (start < end && isPunctuation(chars[start])) start += 1;
  while (end > start && isPunctuation(chars[end - 1])) end -= 1;
  return {
    leading: chars.slice(0, start).join(""),
    core: chars.slice(start, end).join(""),
    trailing: chars.slice(end).join("")
  };
}

function pushSplitWordToken(tokens, rawWord, index) {
  const { leading, core, trailing } = splitEdgePunctuation(rawWord);
  const leadingToken = textToken(leading);
  if (leadingToken) tokens.push(leadingToken);
  if (core) tokens.push(wordToken(core, index));
  else if (rawWord) tokens.push(wordToken(rawWord, index));
  const trailingToken = textToken(trailing);
  if (trailingToken) tokens.push(trailingToken);
}

function keywordToken(text) {
  return {
    text,
    html: `<span class="rf-subtitle-keyword">${syllableHtml(text)}</span>`,
    breakBefore: true
  };
}

function plainToken(text) {
  return {
    text,
    html: `<span class="rf-subtitle-text">${syllableHtml(text)}</span>`,
    breakBefore: true
  };
}

function karaokeTokens({ text, words }) {
  const tokens = [];
  let cursor = 0;

  words.forEach((entry, index) => {
    const word = String(entry.word ?? "");
    if (!word) return;
    const found = text.indexOf(word, cursor);
    if (found >= 0) {
      const before = textToken(text.slice(cursor, found));
      if (before) tokens.push(before);
      pushSplitWordToken(tokens, word, index);
      cursor = found + word.length;
      return;
    }
    pushSplitWordToken(tokens, word, index);
  });

  const after = textToken(text.slice(cursor));
  if (after) tokens.push(after);
  return tokens;
}

function keywordTokens({ text, keywords }) {
  const active = uniqueStrings(keywords).sort((a, b) => b.length - a.length);
  if (active.length === 0) return [plainToken(text)];

  const pattern = new RegExp(active.map(escapeRegExp).join("|"), "giu");
  const tokens = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) tokens.push(plainToken(text.slice(cursor, index)));
    tokens.push(keywordToken(match[0]));
    cursor = index + match[0].length;
  }
  if (cursor < text.length) tokens.push(plainToken(text.slice(cursor)));
  return tokens;
}

function renderSubtitleContent(data) {
  const style = data.style ?? DEFAULT_SUBTITLE;
  if (data.mode === "karaoke") {
    return addLineBreaks(karaokeTokens(data), style.maxCharsPerLine);
  }
  return addLineBreaks(keywordTokens(data), style.maxCharsPerLine);
}

function keywordCandidatesFrom(value) {
  const text = String(value ?? "").trim();
  if (!text) return [];
  const parts = text
    .split(/[\s,.;:!?()[\]{}"'“”‘’·、，。]+/u)
    .map((part) => part.trim())
    .filter(Boolean);
  return [text, ...parts];
}

function keywordsForScene(scene, text) {
  const explicit = Array.isArray(scene.keywords) ? scene.keywords : [];
  const candidates = [
    ...explicit,
    ...keywordCandidatesFrom(scene.headline),
    ...(scene.items ?? []).flatMap(keywordCandidatesFrom),
    ...(scene.values ?? []).flatMap(keywordCandidatesFrom)
  ];
  return uniqueStrings(candidates)
    .filter((keyword) => keyword.length > 0 && text.includes(keyword))
    .sort((a, b) => b.length - a.length);
}

function subtitleDataForScene({ scene, timing }) {
  const words = timing.words ?? [];
  const mode = scene.subtitleMode === "karaoke" ? "karaoke" : "keyword";
  const text = scene.narration;
  return {
    mode,
    renderer: mode === "karaoke" ? "gsap-karaoke" : "keyword-spans",
    text,
    keywords: mode === "keyword" ? keywordsForScene(scene, text) : [],
    words,
    startSec: 0,
    endSec: timing.audioDurationSec,
    style: loadSubtitleStyle()
  };
}

function enhancedSubtitleCss(style) {
  const fontSize = finiteNumber(style.fontSize, DEFAULT_SUBTITLE.fontSize);
  const strokeWidth = finiteNumber(style.strokeWidth, DEFAULT_SUBTITLE.strokeWidth);
  const borderRadius = finiteNumber(style.borderRadius, DEFAULT_SUBTITLE.borderRadius);
  const bottomOffset = finiteNumber(style.bottomOffset, DEFAULT_SUBTITLE.bottomOffset);
  const maxWidth = finiteNumber(style.maxWidth, DEFAULT_SUBTITLE.maxWidth);
  const lineHeight = finiteNumber(style.lineHeight, DEFAULT_SUBTITLE.lineHeight);
  const maxCharsPerLine = Math.max(1, Number.parseInt(style.maxCharsPerLine, 10) || DEFAULT_SUBTITLE.maxCharsPerLine);
  const visible = style.visible === false ? 0 : 1;

  return `
        .subtitles.rf-subtitles-enhanced {
          --rf-subtitle-color: ${style.color};
          --rf-subtitle-stroke-color: ${style.strokeColor};
          --rf-subtitle-keyword-color: ${style.keywordColor};
          --rf-subtitle-keyword-stroke-color: ${style.keywordStrokeColor};
          left: 50%;
          bottom: ${bottomOffset}px;
          width: auto;
          max-width: min(${maxWidth}px, calc(${maxCharsPerLine}em + 52px), 78%);
          padding: max(14px, 0.32em) max(20px, 0.56em);
          border-radius: ${borderRadius}px;
          background: ${style.backgroundColor};
          color: var(--rf-subtitle-color);
          box-shadow: ${style.boxShadow};
          font-family: ${cssString(style.fontFamily)}, system-ui, sans-serif;
          font-size: ${fontSize}px;
          font-weight: ${cssString(style.fontWeight).slice(1, -1)};
          line-height: ${lineHeight};
          text-align: center;
          white-space: normal;
          word-break: keep-all;
          overflow-wrap: anywhere;
          -webkit-text-stroke: ${strokeWidth}px var(--rf-subtitle-stroke-color);
          text-stroke: ${strokeWidth}px var(--rf-subtitle-stroke-color);
          paint-order: stroke fill;
          opacity: ${visible};
        }
        .subtitles.rf-subtitles-enhanced .rf-subtitle-text,
        .subtitles.rf-subtitles-enhanced .rf-subtitle-word,
        .subtitles.rf-subtitles-enhanced .rf-subtitle-keyword {
          display: inline;
          transition: color 0.1s linear, opacity 0.1s linear, -webkit-text-stroke-color 0.1s linear;
        }
        .subtitles.rf-subtitles-enhanced .rf-subtitle-syllable {
          display: inline-block;
          transform-origin: 50% 82%;
          will-change: transform, opacity;
        }
        .subtitles.rf-subtitles-enhanced {
          letter-spacing: -0.02em;
        }
        .subtitles.rf-subtitles-enhanced .rf-subtitle-word.is-future {
          opacity: 0.5;
        }
        .subtitles.rf-subtitles-enhanced .rf-subtitle-word.is-past,
        .subtitles.rf-subtitles-enhanced .rf-subtitle-text {
          opacity: 1;
          color: var(--rf-subtitle-color);
          -webkit-text-stroke-color: var(--rf-subtitle-stroke-color);
          text-stroke-color: var(--rf-subtitle-stroke-color);
        }
        .subtitles.rf-subtitles-enhanced .rf-subtitle-word.is-current,
        .subtitles.rf-subtitles-enhanced .rf-subtitle-keyword {
          opacity: 1;
          color: var(--rf-subtitle-keyword-color);
          -webkit-text-stroke-color: var(--rf-subtitle-keyword-stroke-color);
          text-stroke-color: var(--rf-subtitle-keyword-stroke-color);
        }`;
}

function selectorForWord(sceneId, index) {
  return `#${sceneId}-subtitles [data-rf-word-index="${index}"]`;
}

function karaokeTimelineJs(sceneId, data) {
  if (data.mode !== "karaoke" || data.words.length === 0) return "";

  const style = data.style ?? DEFAULT_SUBTITLE;
  const normal = {
    opacity: 1,
    color: style.color,
    webkitTextStrokeColor: style.strokeColor,
    textStrokeColor: style.strokeColor
  };
  const future = {
    opacity: 0.5,
    color: style.color,
    webkitTextStrokeColor: style.strokeColor,
    textStrokeColor: style.strokeColor
  };
  const current = {
    opacity: 1,
    color: style.keywordColor,
    webkitTextStrokeColor: style.keywordStrokeColor,
    textStrokeColor: style.keywordStrokeColor
  };

  const allSelector = `#${sceneId}-subtitles [data-rf-word-index]`;
  const lines = [`          gsap.set(${cssString(allSelector)}, ${JSON.stringify(future)});`];
  data.words.forEach((word, index) => {
    const start = finiteNumber(word.start, 0);
    const end = Math.max(start, finiteNumber(word.end, start));
    lines.push(`          tl.set(${cssString(selectorForWord(sceneId, index))}, ${JSON.stringify(current)}, ${start});`);
    lines.push(`          tl.set(${cssString(selectorForWord(sceneId, index))}, ${JSON.stringify(normal)}, ${end});`);
  });
  return lines.join("\n");
}

function patchClassAndContent(html, sceneId, data) {
  const openTagPattern = new RegExp(`(<div\\b[^>]*\\bid=["']${escapeRegExp(sceneId)}-subtitles["'][^>]*)(>)`);
  let next = html.replace(openTagPattern, (match, open, close) => {
    let patched = open;
    patched = patched.replace('class="clip subtitles"', 'class="clip subtitles rf-subtitles-enhanced"');
    patched = patched.replace("class='clip subtitles'", "class='clip subtitles rf-subtitles-enhanced'");
    if (!/\bdata-rf-subtitle-renderer=/.test(patched)) {
      patched += ` data-rf-subtitle-renderer="${RENDERER}"`;
    }
    return `${patched}${close}`;
  });

  const contentPattern = new RegExp(
    `(<div\\b[^>]*\\bid=["']${escapeRegExp(sceneId)}-subtitles["'][^>]*>)([\\s\\S]*?)(</div>)`
  );
  next = next.replace(contentPattern, `$1${renderSubtitleContent(data)}$3`);
  return next;
}

function patchSubtitleRevealTween(html, sceneId, data) {
  const visible = data.style?.visible === false ? 0 : 1;
  const pattern = new RegExp(
    `\\s*tl\\.fromTo\\(\\s*${escapeRegExp(cssString(`#${sceneId}-subtitles`))},[\\s\\S]*?\\n\\s*0\\.36\\s*\\n\\s*\\);`
  );
  const syllables = cssString(`#${sceneId}-subtitles .rf-subtitle-syllable`);
  const replacement = `
          tl.set(${cssString(`#${sceneId}-subtitles`)}, { opacity: ${visible}, y: 0 }, 0);
          tl.fromTo(${syllables}, { opacity: 0, y: 18, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: "power2.out", stagger: { each: 0.026, from: "start" } }, 0.05);`;
  return html.replace(pattern, replacement);
}

function patchSceneHtml({ sceneId, data }) {
  const file = compiledScenePath(sceneId);
  if (!file || patchedSceneFiles.has(file)) return;

  const original = readFileSync(file, "utf8");
  if (original.includes(`data-rf-subtitle-renderer="${RENDERER}"`)) {
    patchedSceneFiles.add(file);
    return;
  }

  let html = original.replace("</style>", `${enhancedSubtitleCss(data.style ?? DEFAULT_SUBTITLE)}
      </style>`);
  html = patchClassAndContent(html, sceneId, data);
  html = patchSubtitleRevealTween(html, sceneId, data);
  html = applyLivingBackgroundToSceneHtml({
    html,
    scene: { sceneId },
    durationSec: data.endSec
  });

  const timelinePattern = new RegExp(`(\\s*)window\\.__timelines\\[${escapeRegExp(cssString(sceneId))}\\]\\s*=\\s*tl;`);
  html = html.replace(timelinePattern, (match, indent) => {
    const js = karaokeTimelineJs(sceneId, data);
    return `${js ? `${js}\n` : ""}${indent}window.__timelines[${cssString(sceneId)}] = tl;`;
  });

  writeFileSync(file, html);
  patchedSceneFiles.add(file);
}

export function staticSubtitleForScene({ scene, timing }) {
  const words = timing.words ?? [];
  const hookData = hookDataBySceneId.get(scene.sceneId) ?? subtitleDataForScene({ scene, timing });
  patchSceneHtml({ sceneId: scene.sceneId, data: hookData });
  return {
    text: scene.narration,
    startSec: 0,
    endSec: timing.audioDurationSec,
    words
  };
}

export function subtitleHookData({ scene, timing }) {
  const data = subtitleDataForScene({ scene, timing });
  hookDataBySceneId.set(scene.sceneId, data);
  return data;
}

export const __subtitleTestInternals = {
  addLineBreaks,
  enhancedSubtitleCss,
  keywordTokens,
  karaokeTokens,
  splitEdgePunctuation,
  keywordsForScene,
  renderSubtitleContent,
  subtitleDataForScene
};

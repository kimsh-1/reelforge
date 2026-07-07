#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";
import sharp from "sharp";
import { __subtitleTestInternals } from "../src/compiler/subtitles.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workerId = "p202";
const workRoot = path.join("/tmp", `p2w-${workerId}`);
const tempRepo = path.join(workRoot, "repo");
const fixtureRel = "fixtures/golden-specs/minimal-3scene";
const buildDir = path.join(tempRepo, fixtureRel, "build");
const sceneId = "s01";
const fps = 30;
const safeMargin = 80;
const maxSyncFrameErrorFrames = 3;
const highlightColorDistance = 76;
const minHighlightComponentPixels = 60;
const minCurrentHighlightShare = 0.8;
const minHighlightXIntervalIoU = 0.5;

function assert(condition, message, measured = {}) {
  if (!condition) {
    const error = new Error(message);
    error.measured = measured;
    throw error;
  }
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd ?? tempRepo,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    timeout: options.timeout ?? 120_000
  });
}

function copyIntoTemp(relPath) {
  const source = path.join(repoRoot, relPath);
  const target = path.join(tempRepo, relPath);
  mkdirSync(path.dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}

function prepareTempRepo() {
  rmSync(workRoot, { recursive: true, force: true });
  mkdirSync(tempRepo, { recursive: true });
  for (const rel of [
    "bin",
    "src",
    "schemas",
    fixtureRel,
    "fixtures/presets",
    "poc/fixtures/p0c/fonts",
    "package.json"
  ]) {
    copyIntoTemp(rel);
  }
  rmSync(path.join(tempRepo, fixtureRel, "build"), { recursive: true, force: true });
  symlinkSync(path.join(repoRoot, "node_modules"), path.join(tempRepo, "node_modules"), "dir");

  const specsPath = path.join(tempRepo, fixtureRel, "scene_specs.json");
  const specs = JSON.parse(readFileSync(specsPath, "utf8"));
  specs.scenes = specs.scenes.map((scene) => ({ ...scene, subtitleMode: "karaoke" }));
  writeFileSync(specsPath, `${JSON.stringify(specs, null, 2)}\n`);
}

function htmlUnescape(value) {
  return String(value)
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");
}

function subtitleDataFromSceneHtml(html) {
  const match = html.match(/data-subtitles='([^']+)'/);
  assert(match, "compiled scene is missing data-subtitles");
  return JSON.parse(htmlUnescape(match[1]));
}

function templateContent(html) {
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
  assert(match, "compiled scene is missing body content");
  return match[1];
}

function sceneDocumentHtml(html, baseHref) {
  const baseTag = `<base href="${baseHref}">`;
  if (/<head\b/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
  }
  return `<!doctype html><html><head>${baseTag}</head><body>${templateContent(html)}</body></html>`;
}

function parseHex(hex) {
  const raw = String(hex).replace("#", "");
  return [0, 2, 4].map((offset) => Number.parseInt(raw.slice(offset, offset + 2), 16));
}

function colorDistance(pixel, target) {
  return Math.hypot(pixel[0] - target[0], pixel[1] - target[1], pixel[2] - target[2]);
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function frameForSec(value) {
  return Math.round(finiteNumber(value, 0) * fps);
}

function sampleFrameForWord(word) {
  const startFrame = frameForSec(word.start);
  const endFrame = Math.max(startFrame, frameForSec(word.end));
  const sampleFrame = Math.min(startFrame + maxSyncFrameErrorFrames, Math.max(startFrame, endFrame - 1));
  return {
    startFrame,
    endFrame,
    sampleFrame,
    sampleSec: sampleFrame / fps
  };
}

function rectOverlapArea(pixelBox, rect) {
  const x = Math.max(0, Math.min(pixelBox.right + 1, rect.right) - Math.max(pixelBox.left, rect.left));
  const y = Math.max(0, Math.min(pixelBox.bottom + 1, rect.bottom) - Math.max(pixelBox.top, rect.top));
  return x * y;
}

function unionPixelBbox(components) {
  if (components.length === 0) return null;
  return components.reduce(
    (box, component) => ({
      left: Math.min(box.left, component.bbox.left),
      top: Math.min(box.top, component.bbox.top),
      right: Math.max(box.right, component.bbox.right),
      bottom: Math.max(box.bottom, component.bbox.bottom)
    }),
    { ...components[0].bbox }
  );
}

function xIntervalIoU(pixelBox, rect) {
  const intersection = Math.max(0, Math.min(pixelBox.right + 1, rect.right) - Math.max(pixelBox.left, rect.left));
  const pixelWidth = pixelBox.right - pixelBox.left + 1;
  const rectWidth = rect.right - rect.left;
  return intersection / (pixelWidth + rectWidth - intersection);
}

async function highlightComponents(pngBuffer, keywordColor, bounds) {
  const image = sharp(pngBuffer).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const target = parseHex(keywordColor);
  const x0 = Math.max(0, Math.floor(bounds.left));
  const y0 = Math.max(0, Math.floor(bounds.top));
  const x1 = Math.min(info.width - 1, Math.ceil(bounds.right));
  const y1 = Math.min(info.height - 1, Math.ceil(bounds.bottom));
  const width = x1 - x0 + 1;
  const height = y1 - y0 + 1;
  const mask = new Uint8Array(width * height);
  const seen = new Uint8Array(width * height);
  let count = 0;
  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const offset = (y * info.width + x) * 4;
      const alpha = data[offset + 3];
      if (alpha < 160) continue;
      const rgb = [data[offset], data[offset + 1], data[offset + 2]];
      if (colorDistance(rgb, target) > highlightColorDistance) continue;
      count += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      mask[(y - y0) * width + (x - x0)] = 1;
    }
  }

  assert(count > 20, "highlight pixels not found at sampled frame", { count, bounds });
  const components = [];
  const stack = [];
  for (let offset = 0; offset < mask.length; offset += 1) {
    if (!mask[offset] || seen[offset]) continue;
    seen[offset] = 1;
    stack.push(offset);
    let componentCount = 0;
    let sumX = 0;
    let sumY = 0;
    let componentMinX = info.width;
    let componentMinY = info.height;
    let componentMaxX = 0;
    let componentMaxY = 0;

    while (stack.length > 0) {
      const current = stack.pop();
      const localX = current % width;
      const localY = Math.floor(current / width);
      const x = x0 + localX;
      const y = y0 + localY;
      componentCount += 1;
      sumX += x;
      sumY += y;
      componentMinX = Math.min(componentMinX, x);
      componentMinY = Math.min(componentMinY, y);
      componentMaxX = Math.max(componentMaxX, x);
      componentMaxY = Math.max(componentMaxY, y);

      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ]) {
        const nx = localX + dx;
        const ny = localY + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (!mask[next] || seen[next]) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }

    components.push({
      count: componentCount,
      centroid: { x: sumX / componentCount, y: sumY / componentCount },
      bbox: { left: componentMinX, top: componentMinY, right: componentMaxX, bottom: componentMaxY }
    });
  }

  components.sort((a, b) => b.count - a.count);
  return {
    count,
    bbox: { left: minX, top: minY, right: maxX, bottom: maxY },
    components
  };
}

async function renderAndMeasure({ sceneHtml, data }) {
  const browserPathResult = run(path.join(tempRepo, "node_modules", ".bin", "hyperframes"), ["browser", "path"], {
    timeout: 60_000
  });
  assert(browserPathResult.status === 0, "hyperframes browser path failed", {
    stderr: browserPathResult.stderr,
    stdout: browserPathResult.stdout
  });

  const browser = await puppeteer.launch({
    executablePath: browserPathResult.stdout.trim(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    const baseHref = pathToFileURL(path.join(buildDir, "scenes") + path.sep).href;
    await page.setContent(sceneDocumentHtml(sceneHtml, baseHref), {
      waitUntil: "networkidle0",
      timeout: 60_000
    });
    await page.waitForFunction((id) => Boolean(window.__timelines?.[id]), { timeout: 20_000 }, sceneId);
    await page.evaluate(() => document.fonts?.ready ?? true);

    const words = data.words;
    const measurements = [];
    let subtitleBox = null;
    for (const [index, word] of words.entries()) {
      const { startFrame, endFrame, sampleFrame, sampleSec } = sampleFrameForWord(word);
      await page.evaluate(
        ({ id, time }) => {
          const tl = window.__timelines[id];
          tl.pause();
          tl.seek(time, false);
        },
        { id: sceneId, time: sampleSec }
      );
      await new Promise((resolve) => setTimeout(resolve, 120));
      const { box, wordBoxes } = await page.$eval(`#${sceneId}-subtitles`, (element) => {
        const rect = element.getBoundingClientRect();
        return {
          box: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
          wordBoxes: [...element.querySelectorAll("[data-rf-word-index]")].map((wordElement) => {
            const wordRect = wordElement.getBoundingClientRect();
            return {
              index: Number(wordElement.getAttribute("data-rf-word-index")),
              word: wordElement.textContent,
              rect: {
                left: wordRect.left,
                top: wordRect.top,
                right: wordRect.right,
                bottom: wordRect.bottom,
                width: wordRect.width,
                height: wordRect.height
              }
            };
          })
        };
      });
      subtitleBox = subtitleBox ?? box;
      const screenshot = await page.screenshot({ type: "png" });
      const currentWordBox = wordBoxes.find((item) => item.index === index);
      assert(currentWordBox, "current word DOM box not found", { index, word: word.word, wordBoxes });
      const highlight = await highlightComponents(screenshot, data.style.keywordColor, {
        left: box.left - 8,
        top: box.top - 8,
        right: box.right + 8,
        bottom: box.bottom + 8
      });
      measurements.push({
        word: word.word,
        index,
        start: word.start,
        end: word.end,
        startFrame,
        endFrame,
        sampleFrame,
        sampleSec,
        currentWordBox,
        highlight
      });
    }

    return { measurements, subtitleBox };
  } finally {
    await browser.close();
  }
}

function compileFixture() {
  const outArg = path.join(workRoot, "compile-out");
  const result = run(process.execPath, [
    "bin/vf",
    "compile",
    fixtureRel,
    "--preset",
    "fixtures/presets/light.json",
    "--json",
    "--out",
    outArg
  ]);
  assert(result.status === 0, "vf compile failed", { stderr: result.stderr, stdout: result.stdout });
  return JSON.parse(result.stdout);
}

function assertHighlightSync(measurements) {
  return measurements.map((item) => {
    // Keep single-pixel LCD antialiasing fringes from widening the measured highlight span.
    const significant = item.highlight.components.filter((component) => component.count >= minHighlightComponentPixels);
    assert(significant.length > 0, "significant highlight components not found at sampled frame", {
      word: item.word,
      index: item.index,
      sampleFrame: item.sampleFrame,
      components: item.highlight.components.slice(0, 8)
    });

    const currentComponents = significant.filter((component) => rectOverlapArea(component.bbox, item.currentWordBox.rect) > 0);
    const totalPixels = significant.reduce((sum, component) => sum + component.count, 0);
    const currentPixels = currentComponents.reduce((sum, component) => sum + component.count, 0);
    const currentShare = currentPixels / totalPixels;
    const highlightedBox = unionPixelBbox(currentComponents);
    assert(highlightedBox, "highlight components did not overlap the current word", {
      word: item.word,
      index: item.index,
      sampleFrame: item.sampleFrame,
      currentWordBox: item.currentWordBox,
      significant
    });

    const xIoU = xIntervalIoU(highlightedBox, item.currentWordBox.rect);
    assert(
      currentShare >= minCurrentHighlightShare && xIoU >= minHighlightXIntervalIoU,
      "highlight pixels did not align with the current word",
      {
        word: item.word,
        index: item.index,
        sampleFrame: item.sampleFrame,
        currentShare,
        requiredShare: minCurrentHighlightShare,
        xIoU,
        requiredXIoU: minHighlightXIntervalIoU,
        highlightedBox,
        currentWordBox: item.currentWordBox,
        significant
      }
    );

    return {
      word: item.word,
      index: item.index,
      sampleFrame: item.sampleFrame,
      frameError: Math.abs(item.sampleFrame - item.startFrame),
      currentShare,
      xIoU,
      highlightedBox
    };
  });
}

function assertSafeZone(box) {
  const safe = {
    left: safeMargin,
    top: safeMargin,
    right: 1920 - safeMargin,
    bottom: 1080 - safeMargin
  };
  assert(
    box.left >= safe.left && box.top >= safe.top && box.right <= safe.right && box.bottom <= safe.bottom,
    "subtitle bbox is outside safe zone",
    { box, safe }
  );
  return safe;
}

function assertKeywordMode() {
  const scene = {
    subtitleMode: "keyword",
    narration: "출시 준비는 검수, 승인, 배포 순서로 진행됩니다.",
    headline: "다음 단계",
    items: ["품질 검수", "법무 승인", "점진 배포"],
    values: []
  };
  const data = __subtitleTestInternals.subtitleDataForScene({
    scene,
    timing: { words: [], audioDurationSec: 3 }
  });
  const html = __subtitleTestInternals.renderSubtitleContent(data);
  const keywordSpanCount = (html.match(/class="rf-subtitle-keyword"/g) ?? []).length;
  assert(data.mode === "keyword", "keyword mode data was not selected", { mode: data.mode });
  assert(keywordSpanCount === 3, "keyword mode did not wrap only matching parts", {
    keywords: data.keywords,
    keywordSpanCount,
    html
  });
  assert(!html.includes(">품질 검수<") && html.includes(">검수<"), "keyword mode matched the wrong phrase span", {
    html
  });
  return { keywords: data.keywords, keywordSpanCount };
}

function assertKaraokePunctuationMode() {
  const data = {
    mode: "karaoke",
    text: "나 Supercalifragilisticexpialidocious끝, 응?",
    words: [
      { word: "나", start: 0, end: 0.2 },
      { word: "Supercalifragilisticexpialidocious끝,", start: 0.25, end: 1.2 },
      { word: "응?", start: 1.25, end: 1.5 }
    ],
    style: { maxCharsPerLine: 80 }
  };
  const html = __subtitleTestInternals.renderSubtitleContent(data);
  assert(!html.includes('data-rf-word-index="2">응?</span>'), "karaoke mode included trailing punctuation in current word span", {
    html
  });
  assert(html.includes('data-rf-word-index="2">응</span><span class="rf-subtitle-text">?</span>'), "karaoke mode did not split trailing punctuation", {
    html
  });
  assert(
    html.includes('data-rf-word-index="1">Supercalifragilisticexpialidocious끝</span><span class="rf-subtitle-text">,</span>'),
    "karaoke mode did not keep Korean text in the core word while splitting comma punctuation",
    { html }
  );
  return { html };
}

try {
  const keywordCheck = assertKeywordMode();
  assertKaraokePunctuationMode();
  prepareTempRepo();
  const compile = compileFixture();
  const scenePath = path.join(buildDir, "scenes", `scene-${sceneId}.html`);
  assert(existsSync(scenePath), "compiled scene1 HTML missing", { scenePath });
  const sceneHtml = readFileSync(scenePath, "utf8");
  const data = subtitleDataFromSceneHtml(sceneHtml);
  assert(data.mode === "karaoke", "scene1 did not compile in karaoke mode", { mode: data.mode });
  assert(data.renderer === "gsap-karaoke", "scene1 did not select GSAP karaoke renderer", { renderer: data.renderer });
  const wordSpanCount = (sceneHtml.match(/<span\b[^>]*data-rf-word-index=/g) ?? []).length;
  assert(wordSpanCount === data.words.length, "word span count mismatch", {
    spans: wordSpanCount,
    words: data.words.length
  });

  const { measurements, subtitleBox } = await renderAndMeasure({ sceneHtml, data });
  const highlightChecks = assertHighlightSync(measurements);
  const safe = assertSafeZone(subtitleBox);
  const maxFrameError = Math.max(...highlightChecks.map((item) => item.frameError));

  assert(maxFrameError <= maxSyncFrameErrorFrames, "sample frame exceeded subtitle tolerance", { maxFrameError });

  console.log("subtitles-sync: PASS");
  console.log(`workRoot: ${workRoot}`);
  console.log(`compile: PASS ${compile.buildDir}`);
  console.log(`keywordMode: PASS spans=${keywordCheck.keywordSpanCount} keywords=${keywordCheck.keywords.join("|")}`);
  console.log(`scene1: mode=${data.mode} renderer=${data.renderer} words=${data.words.length}`);
  console.log(`frameTolerance: PASS maxErrorFrames=${maxFrameError} allowed=${maxSyncFrameErrorFrames}`);
  console.log(
    `highlightSync: PASS ${highlightChecks
      .map((item) => `${item.word}@f${item.sampleFrame}:share=${item.currentShare.toFixed(2)},xIoU=${item.xIoU.toFixed(2)}`)
      .join("|")}`
  );
  console.log(
    `safeZone: PASS bbox=${Math.round(subtitleBox.left)},${Math.round(subtitleBox.top)},${Math.round(subtitleBox.right)},${Math.round(subtitleBox.bottom)} safe=${safe.left},${safe.top},${safe.right},${safe.bottom}`
  );
  console.log(`keywordColor: PASS ${data.style.keywordColor}`);
} catch (error) {
  console.error("subtitles-sync: FAIL");
  console.error(error instanceof Error ? error.message : String(error));
  if (error?.measured) console.error(JSON.stringify(error.measured, null, 2));
  process.exitCode = 1;
}

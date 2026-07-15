#!/usr/bin/env node
/**
 * craft-contact-sheet.mjs
 *
 * Block x Preset contact-sheet QC harness for the 2607-craft block/preset surgery
 * (see ops/2607-craft/briefs/00-frozen-contract.md).
 *
 * Captures 3 PNG frames (t ~= 0.6s, 2.0s, 3.6s into each block's own scene) for every
 * requested block x preset combination, WITHOUT rendering a full mp4 — this is what makes
 * 8 blocks x 17 presets (136 combos) affordable on a low-memory box.
 *
 * Strategy (deliberately deviates from a literal "open block.html raw + puppeteer seek"
 * reading of the brief — see notes in ops/2607-craft/briefs for the reasoning):
 *   1. For a given preset, build ONE minimal project containing all requested blocks as
 *      separate back-to-back scenes (one scene per block, fixed 5.5s duration each).
 *   2. `vf compile` that project with the preset once (cheap, no Chrome).
 *   3. `npx hyperframes snapshot <buildDir> --at <every scene's t=0.6/2.0/3.6, absolute>`
 *      ONCE. This is the same snapshot primitive tests/demo-visual-qc.mjs already relies
 *      on in this repo, so it exercises the exact runtime-ready / GSAP-seek path real
 *      renders use, instead of us re-implementing GSAP seeking by hand. One Chrome launch
 *      captures every block for that preset.
 *   4. Analyze + tile the 3 frames per block (stddev/contrast ported from
 *      tests/demo-visual-qc.mjs; motion = pixel diff between t=2.0 and t=3.6 frames).
 *
 * If the combined-project compile or snapshot fails for a preset (e.g. a block was left
 * broken mid-surgery), the harness falls back to compiling+snapshotting that preset's
 * blocks ONE AT A TIME so a single broken block cannot sink the whole preset's report.
 *
 * Chrome is always invoked serially (one `hyperframes snapshot` subprocess at a time,
 * awaited to completion) and zombie chrome-headless-shell processes are pkilled after
 * every subprocess, win or lose.
 *
 * Usage:
 *   node scripts/craft-contact-sheet.mjs --blocks bar,statistic --presets demo-dark,light --out ops/2607-craft/before
 *   node scripts/craft-contact-sheet.mjs --out /tmp/contact-sheet-smoke   # all 8 blocks x all presets
 */

import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  readdirSync
} from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRESETS_DIR = path.join(repoRoot, "fixtures", "presets");
const ALL_BLOCKS = ["bar", "pie", "line", "list", "numbered", "statistic", "compare", "quote"];

const FPS = 30;
const SCENE_DURATION_SEC = 5.5; // 5.5 * 30 = 165 frames exactly, no fps-quantization drift
const CAPTURE_OFFSETS = [0.6, 2.0, 3.6]; // seconds relative to each block's own scene start

const MIN_STDDEV = 15; // blank-card detector, ported from tests/demo-visual-qc.mjs
const MIN_CENTRAL_EDGE_PIXELS = 400;
const MIN_MOTION_MEAN_ABS = 0.35; // living-loop-not-frozen detector
const MIN_MOTION_CHANGED_RATIO = 0.003;
const MOTION_SAMPLE_W = 160;
const MOTION_SAMPLE_H = 90;

// ---------------------------------------------------------------------------
// Fixture data — one realistic Korean scene per block, mirroring the shapes already
// proven in fixtures/golden-specs/full-8types/scene_specs.json (schema-valid, no image
// assets needed since visual_kind is "none"/"chart" only).
// ---------------------------------------------------------------------------
const BLOCK_FIXTURES = {
  bar: {
    narration: "지난주 신규 가입은 검색 유입이 가장 컸고, 추천 유입이 그 뒤를 이었습니다.",
    altText: "막대 차트가 검색 유입 6200명, 추천 유입 4800명, 광고 유입 3100명을 비교한다.",
    mood: "informative",
    reveal: "stagger",
    emphasis: "number",
    headline: "채널별 신규 가입",
    items: ["검색 유입", "추천 유입", "광고 유입"],
    values: [6200, 4800, 3100],
    unit: "명",
    visual_kind: "chart",
    subtitleMode: "karaoke"
  },
  pie: {
    narration: "월간 지출은 인건비가 절반에 가깝고, 인프라와 마케팅이 나머지를 나눕니다.",
    altText: "원형 차트가 인건비 48%, 인프라 27%, 마케팅 18%, 기타 7% 지출 비중을 보여준다.",
    mood: "somber",
    reveal: "cascade",
    emphasis: "contrast",
    headline: "월간 지출 비중",
    items: ["인건비", "인프라", "마케팅", "기타"],
    values: [48, 27, 18, 7],
    unit: "%",
    visual_kind: "chart",
    subtitleMode: "karaoke"
  },
  line: {
    narration: "재방문율은 네 주 연속 상승해 마지막 주에 삼십칠 퍼센트에 도달했습니다.",
    altText: "선 그래프가 1주차 29%, 2주차 31%, 3주차 34%, 4주차 37%로 상승한다.",
    mood: "triumphant",
    reveal: "build_up",
    emphasis: "sequence",
    headline: "재방문율 4주 추이",
    items: ["1주차", "2주차", "3주차", "4주차"],
    values: [29, 31, 34, 37],
    unit: "%",
    visual_kind: "chart",
    subtitleMode: "karaoke"
  },
  list: {
    narration: "운영팀은 온보딩 문서, 알림 문구, 결제 안내를 우선 점검합니다.",
    altText: "세 개의 운영 점검 항목이 상태 값과 함께 목록으로 표시된다.",
    mood: "informative",
    reveal: "stagger_then_flash",
    emphasis: "count",
    headline: "이번 주 점검 항목",
    items: ["온보딩 문서 최신화", "알림 문구 A/B 테스트", "결제 안내 오류 점검"],
    values: ["진행", "대기", "완료"],
    unit: "상태",
    visual_kind: "none",
    subtitleMode: "keyword"
  },
  numbered: {
    narration: "출시 준비는 검수, 승인, 배포 순서로 진행됩니다.",
    altText: "품질 검수, 법무 승인, 점진 배포가 1번부터 3번까지 번호로 정렬된다.",
    mood: "urgent",
    reveal: "cascade",
    emphasis: "sequence",
    headline: "출시 전 세 단계",
    items: ["품질 검수", "법무 승인", "점진 배포"],
    values: [1, 2, 3],
    unit: "단계",
    visual_kind: "none",
    subtitleMode: "keyword"
  },
  statistic: {
    narration: "평균 응답 시간은 백팔십사 밀리초로 목표치보다 십육 밀리초 빠릅니다.",
    altText: "큰 숫자 184ms와 목표 대비 16ms 빠름이라는 보조 수치가 표시된다.",
    mood: "dramatic",
    reveal: "count_up",
    emphasis: "number",
    headline: "렌더 시간",
    items: ["평균 응답 시간", "목표 대비 개선"],
    values: [184, 16],
    unit: "ms",
    visual_kind: "none",
    subtitleMode: "karaoke"
  },
  compare: {
    narration: "새 추천 모델은 기존 모델보다 클릭률은 높이고 이탈률은 낮췄습니다.",
    altText: "기존 모델과 신규 모델의 클릭률 및 이탈률이 나란히 비교된다.",
    mood: "suspense",
    reveal: "split_reveal",
    emphasis: "contrast",
    headline: "추천 모델 비교",
    items: ["기존 클릭률", "신규 클릭률", "기존 이탈률", "신규 이탈률"],
    values: [12.4, 15.8, 9.1, 7.6],
    unit: "%",
    visual_kind: "chart",
    subtitleMode: "karaoke"
  },
  quote: {
    narration: "사용자 인터뷰에서 가장 많이 반복된 문장은 설정이 쉬워야 다시 쓴다는 말이었습니다.",
    altText: "사용자 인터뷰 인용문이 따옴표 스타일의 텍스트 블록으로 표시된다.",
    mood: "contemplative",
    reveal: "typewriter",
    emphasis: "quote",
    headline: "사용자 인용",
    items: ["사용자 인터뷰", "설정이 쉬워야 다시 씁니다"],
    values: ["5회 반복", "핵심 문장"],
    unit: "인용",
    visual_kind: "none",
    subtitleMode: "keyword"
  }
};

// ---------------------------------------------------------------------------
// small utils
// ---------------------------------------------------------------------------

function sha256Text(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 256 * 1024 * 1024,
      ...options
    });
  } catch (error) {
    const stderr = error.stderr?.toString?.().trim() ?? "";
    const stdout = error.stdout?.toString?.().trim() ?? "";
    const detail = [stdout.slice(-800), stderr.slice(-800)].filter(Boolean).join(" | ");
    throw new Error(`${command} ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`);
  }
}

function killChromeZombies() {
  try {
    execFileSync("pkill", ["-9", "-f", "chrome-headless-shell"], { stdio: "ignore" });
  } catch {
    // no matching process — fine
  }
}

function writeSilentWav(filePath, durationSec, sampleRate = 8000) {
  const seconds = Math.max(0.05, Number(durationSec) || 0.05);
  const samples = Math.max(1, Math.ceil(seconds * sampleRate));
  const dataBytes = samples * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataBytes, 40);
  writeFileSync(filePath, buffer);
}

function parseArgs(argv) {
  const args = { blocks: null, presets: null, out: null, tmp: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--blocks") args.blocks = argv[++i];
    else if (arg === "--presets") args.presets = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--tmp") args.tmp = argv[++i];
    else throw new Error(`unknown arg: ${arg}`);
  }
  if (!args.out) throw new Error("--out <dir> is required");
  const blocks = args.blocks ? args.blocks.split(",").map((s) => s.trim()).filter(Boolean) : ALL_BLOCKS.slice();
  for (const block of blocks) {
    if (!BLOCK_FIXTURES[block]) throw new Error(`unknown block: ${block} (known: ${ALL_BLOCKS.join(", ")})`);
  }
  const presets = args.presets
    ? args.presets.split(",").map((s) => s.trim()).filter(Boolean)
    : readdirSync(PRESETS_DIR)
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(/\.json$/, ""));
  for (const preset of presets) {
    const presetPath = path.join(PRESETS_DIR, `${preset}.json`);
    if (!existsSync(presetPath)) throw new Error(`unknown preset: ${preset} (missing ${presetPath})`);
  }
  const outDir = path.resolve(args.out);
  const tmpDir = args.tmp ? path.resolve(args.tmp) : path.join(os.tmpdir(), `rf-contact-sheet-${process.pid}`);
  return { blocks, presets, outDir, tmpDir };
}

// ---------------------------------------------------------------------------
// project scaffolding
// ---------------------------------------------------------------------------

function sceneIdFor(index) {
  // scene-specs.schema.json requires sceneId to match ^s\d{2,}$
  return `s${String(index + 1).padStart(2, "0")}`;
}

function buildProject({ projectDir, blocks }) {
  rmSync(projectDir, { recursive: true, force: true });
  mkdirSync(path.join(projectDir, "assets", "audio"), { recursive: true });

  const scenes = [];
  const audioScenes = [];
  blocks.forEach((block, index) => {
    const fixture = BLOCK_FIXTURES[block];
    const sceneId = sceneIdFor(index);
    const narrationTts = fixture.narration;
    const audioRel = `./assets/audio/${sceneId}.wav`;
    writeSilentWav(path.join(projectDir, "assets", "audio", `${sceneId}.wav`), SCENE_DURATION_SEC);

    scenes.push({
      sceneId,
      sceneNumber: index + 1,
      narration: fixture.narration,
      narration_tts: narrationTts,
      altText: fixture.altText,
      layout: block,
      mood: fixture.mood,
      reveal: fixture.reveal,
      emphasis: fixture.emphasis,
      headline: fixture.headline,
      items: fixture.items,
      values: fixture.values,
      unit: fixture.unit,
      source: `fixture:craft-contact-sheet/${block}`,
      visual_kind: fixture.visual_kind,
      kenBurns: { enabled: false, zoomFactor: 1, zoomDirection: "in", panDirection: "none" },
      subtitleMode: fixture.subtitleMode
    });

    audioScenes.push({
      sceneId,
      audioPath: audioRel,
      audioDurationSec: SCENE_DURATION_SEC,
      words: [],
      sourceHash: sha256Text(narrationTts),
      provider: "craft-contact-sheet-silent",
      voice: "silent"
    });
  });

  writeFileSync(
    path.join(projectDir, "scene_specs.json"),
    JSON.stringify({ version: "1.0.0", projectId: "craft-contact-sheet", scenes, transitions: [] }, null, 2)
  );
  writeFileSync(
    path.join(projectDir, "audio_meta.json"),
    JSON.stringify({ scenes: audioScenes }, null, 2)
  );
}

function compileProject({ projectDir, presetPath }) {
  const stdout = run("node", [
    path.join(repoRoot, "bin", "vf"),
    "compile",
    projectDir,
    "--preset",
    presetPath,
    "--json"
  ]);
  return JSON.parse(stdout);
}

// ---------------------------------------------------------------------------
// snapshot capture
// ---------------------------------------------------------------------------

function captureSnapshots({ buildDir, times, snapDir }) {
  rmSync(snapDir, { recursive: true, force: true });
  mkdirSync(snapDir, { recursive: true });
  const atArg = times.map((t) => t.toFixed(3)).join(",");
  try {
    run("npx", ["hyperframes", "snapshot", buildDir, "--at", atArg, "--no-end", "-o", snapDir]);
  } finally {
    killChromeZombies();
  }
  // Map requested time -> actual frame file by parsing "frame-N-at-X.XXXs.png".
  const files = readdirSync(snapDir).filter((f) => /^frame-\d+-at-.*\.png$/.test(f));
  const byTime = new Map();
  for (const file of files) {
    const match = file.match(/^frame-\d+-at-([0-9.]+)s\.png$/);
    if (!match) continue;
    byTime.set(Number(match[1]).toFixed(3), path.join(snapDir, file));
  }
  return byTime;
}

// ---------------------------------------------------------------------------
// pixel analysis — ported from tests/demo-visual-qc.mjs (kept read-only, not imported,
// since that file is a top-level executable script with no exports).
// ---------------------------------------------------------------------------

function rawRgb(filePath, width, height) {
  const args = ["-v", "error", "-i", filePath, "-frames:v", "1"];
  if (width && height) args.push("-vf", `scale=${width}:${height}:flags=area`);
  args.push("-f", "rawvideo", "-pix_fmt", "rgb24", "-");
  return execFileSync("ffmpeg", args, { maxBuffer: width * height * 3 + 1024 });
}

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return 0;
  const index = Math.max(0, Math.min(sortedValues.length - 1, Math.floor((sortedValues.length - 1) * p)));
  return sortedValues[index];
}

function contrastRatioFromLuma(lo, hi) {
  const low = Math.min(lo, hi) / 255;
  const high = Math.max(lo, hi) / 255;
  return (high + 0.05) / (low + 0.05);
}

function analyzeFrame(filePath, width, height) {
  const rgb = rawRgb(filePath, width, height);
  const pixels = width * height;
  const luma = new Uint8Array(pixels);
  let sum = 0;
  let sumSquares = 0;
  for (let pixel = 0, offset = 0; pixel < pixels; pixel += 1, offset += 3) {
    const y = (54 * rgb[offset] + 183 * rgb[offset + 1] + 19 * rgb[offset + 2]) >> 8;
    luma[pixel] = y;
    sum += y;
    sumSquares += y * y;
  }
  const mean = sum / pixels;
  const stddev = Math.sqrt(Math.max(0, sumSquares / pixels - mean * mean));

  const center = {
    x0: Math.floor(width * 0.2),
    x1: Math.ceil(width * 0.8),
    y0: Math.floor(height * 0.2),
    y1: Math.ceil(height * 0.8)
  };
  const margin = { x: Math.floor(width * 0.05), y: Math.floor(height * 0.05) };
  let centralEdgePixels = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  const localContrastSamples = [];

  for (let y = margin.y; y < height - margin.y - 2; y += 2) {
    const row = y * width;
    for (let x = margin.x; x < width - margin.x - 2; x += 2) {
      const index = row + x;
      const score = Math.max(
        Math.abs(luma[index] - luma[index + 2]),
        Math.abs(luma[index] - luma[index + width * 2])
      );
      if (score < 28) continue;
      let localMin = 255;
      let localMax = 0;
      for (let yy = Math.max(0, y - 3); yy <= Math.min(height - 1, y + 3); yy += 1) {
        const localRow = yy * width;
        for (let xx = Math.max(0, x - 3); xx <= Math.min(width - 1, x + 3); xx += 1) {
          const value = luma[localRow + xx];
          if (value < localMin) localMin = value;
          if (value > localMax) localMax = value;
        }
      }
      localContrastSamples.push(contrastRatioFromLuma(localMin, localMax));
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (x >= center.x0 && x <= center.x1 && y >= center.y0 && y <= center.y1) centralEdgePixels += 1;
    }
  }

  const bbox = maxX >= 0 ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } : null;
  let contrastRatio = 0;
  if (localContrastSamples.length > 0) {
    localContrastSamples.sort((a, b) => a - b);
    contrastRatio = percentile(localContrastSamples, 0.84);
  }

  return {
    stddev,
    centralEdgePixels,
    contrastRatio,
    bbox,
    passStddev: stddev > MIN_STDDEV,
    passCenter: centralEdgePixels >= MIN_CENTRAL_EDGE_PIXELS || (bbox && bbox.width > 200 && bbox.height > 80),
    passContrast: contrastRatio >= 3.0 || centralEdgePixels >= MIN_CENTRAL_EDGE_PIXELS
  };
}

function diffFrames(aPath, bPath) {
  const a = rawRgb(aPath, MOTION_SAMPLE_W, MOTION_SAMPLE_H);
  const b = rawRgb(bPath, MOTION_SAMPLE_W, MOTION_SAMPLE_H);
  const pixels = MOTION_SAMPLE_W * MOTION_SAMPLE_H;
  let sum = 0;
  let changed = 0;
  for (let offset = 0; offset < a.length; offset += 3) {
    const diff =
      (Math.abs(a[offset] - b[offset]) + Math.abs(a[offset + 1] - b[offset + 1]) + Math.abs(a[offset + 2] - b[offset + 2])) / 3;
    sum += diff;
    if (diff >= 4) changed += 1;
  }
  const meanAbs = sum / pixels;
  const changedRatio = changed / pixels;
  return {
    meanAbs,
    changedRatio,
    pass: meanAbs >= MIN_MOTION_MEAN_ABS && changedRatio >= MIN_MOTION_CHANGED_RATIO
  };
}

function tileFrames({ framePaths, outPath }) {
  mkdirSync(path.dirname(outPath), { recursive: true });
  const inputs = framePaths.flatMap((p) => ["-i", p]);
  run("ffmpeg", ["-y", "-v", "error", ...inputs, "-filter_complex", `hstack=inputs=${framePaths.length}`, outPath]);
}

// ---------------------------------------------------------------------------
// per-preset combo evaluation
// ---------------------------------------------------------------------------

function evaluateCombo({ block, preset, width, height, byTime, sceneStartSec, outDir }) {
  const times = CAPTURE_OFFSETS.map((offset) => (sceneStartSec + offset).toFixed(3));
  const framePaths = times.map((t) => byTime.get(t));
  const missing = framePaths.some((p) => !p || !existsSync(p));
  const comboId = `${block}__${preset}`;
  if (missing) {
    return {
      block,
      preset,
      pass: false,
      error: `missing captured frame(s) for times ${times.join(",")}`,
      framePaths: null,
      tilePath: null
    };
  }

  const frameDir = path.join(outDir, "frames", comboId);
  mkdirSync(frameDir, { recursive: true });
  const localPaths = framePaths.map((src, i) => {
    const dest = path.join(frameDir, `t${CAPTURE_OFFSETS[i].toFixed(1)}.png`);
    writeFileSync(dest, readFileSync(src));
    return dest;
  });

  const midAnalysis = analyzeFrame(localPaths[1], width, height); // t=2.0 is our "representative" frame
  const motion = diffFrames(localPaths[1], localPaths[2]); // t=2.0 vs t=3.6: living-loop check

  const pass = midAnalysis.passStddev && midAnalysis.passCenter && midAnalysis.passContrast && motion.pass;

  const tilePath = path.join(outDir, `${comboId}.png`);
  tileFrames({ framePaths: localPaths, outPath: tilePath });

  return {
    block,
    preset,
    pass,
    stddev: midAnalysis.stddev,
    passStddev: midAnalysis.passStddev,
    centralEdgePixels: midAnalysis.centralEdgePixels,
    passCenter: midAnalysis.passCenter,
    contrastRatio: midAnalysis.contrastRatio,
    passContrast: midAnalysis.passContrast,
    motionMeanAbs: motion.meanAbs,
    motionChangedRatio: motion.changedRatio,
    passMotion: motion.pass,
    bbox: midAnalysis.bbox,
    framePaths: {
      "t0.6": localPaths[0],
      "t2.0": localPaths[1],
      "t3.6": localPaths[2]
    },
    tilePath,
    error: null
  };
}

// ---------------------------------------------------------------------------
// per-preset drivers: fast combined path + per-block fallback
// ---------------------------------------------------------------------------

function combinedPresetPass({ blocks, preset, tmpDir, outDir }) {
  const presetPath = path.join(PRESETS_DIR, `${preset}.json`);
  const projectDir = path.join(tmpDir, `combined-${preset}`);
  buildProject({ projectDir, blocks });
  const compileResult = compileProject({ projectDir, presetPath });
  const buildDir = path.join(projectDir, "build");
  const fps = compileResult.timing?.fps ?? FPS;

  const sceneStartByBlock = new Map();
  for (const scene of compileResult.scenes) {
    const block = scene.layout;
    sceneStartByBlock.set(block, scene.startFrame / fps);
  }

  const manifest = JSON.parse(readFileSync(path.join(buildDir, "render-manifest.json"), "utf8"));
  const width = manifest.meta?.resolution?.width ?? 1920;
  const height = manifest.meta?.resolution?.height ?? 1080;

  const allTimes = [];
  for (const block of blocks) {
    const start = sceneStartByBlock.get(block);
    for (const offset of CAPTURE_OFFSETS) allTimes.push(start + offset);
  }
  const uniqueTimes = [...new Set(allTimes.map((t) => t.toFixed(3)))].map(Number).sort((a, b) => a - b);

  const snapDir = path.join(tmpDir, `snap-${preset}`);
  const byTime = captureSnapshots({ buildDir, times: uniqueTimes, snapDir });

  const results = blocks.map((block) =>
    evaluateCombo({
      block,
      preset,
      width,
      height,
      byTime,
      sceneStartSec: sceneStartByBlock.get(block),
      outDir
    })
  );
  return results;
}

function perBlockFallback({ blocks, preset, tmpDir, outDir, reason }) {
  const presetPath = path.join(PRESETS_DIR, `${preset}.json`);
  const results = [];
  for (const block of blocks) {
    try {
      const projectDir = path.join(tmpDir, `solo-${block}-${preset}`);
      buildProject({ projectDir, blocks: [block] });
      const compileResult = compileProject({ projectDir, presetPath });
      const buildDir = path.join(projectDir, "build");
      const fps = compileResult.timing?.fps ?? FPS;
      const scene = compileResult.scenes[0];
      const startSec = scene.startFrame / fps;
      const manifest = JSON.parse(readFileSync(path.join(buildDir, "render-manifest.json"), "utf8"));
      const width = manifest.meta?.resolution?.width ?? 1920;
      const height = manifest.meta?.resolution?.height ?? 1080;
      const times = CAPTURE_OFFSETS.map((offset) => startSec + offset);
      const snapDir = path.join(tmpDir, `snap-solo-${block}-${preset}`);
      const byTime = captureSnapshots({ buildDir, times, snapDir });
      const result = evaluateCombo({ block, preset, width, height, byTime, sceneStartSec: startSec, outDir });
      if (result.error) result.error = `${result.error} (fallback mode; combined-preset reason: ${reason})`;
      results.push(result);
    } catch (error) {
      results.push({
        block,
        preset,
        pass: false,
        error: `fallback failed: ${error.message} (combined-preset reason: ${reason})`,
        framePaths: null,
        tilePath: null
      });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function loadExistingCombos(outDir) {
  const reportPath = path.join(outDir, "report.json");
  if (!existsSync(reportPath)) return new Map();
  try {
    const existing = JSON.parse(readFileSync(reportPath, "utf8"));
    return new Map((existing.combos ?? []).map((combo) => [`${combo.block}__${combo.preset}`, combo]));
  } catch {
    return new Map();
  }
}

function writeReport({ outDir, comboMap, blocks, presets }) {
  const combos = [...comboMap.values()];
  const report = {
    generatedAt: new Date().toISOString(),
    captureOffsetsSec: CAPTURE_OFFSETS,
    sceneDurationSec: SCENE_DURATION_SEC,
    blocks: [...new Set([...combos.map((c) => c.block), ...blocks])],
    presets: [...new Set([...combos.map((c) => c.preset), ...presets])],
    combos,
    summary: {
      total: combos.length,
      pass: combos.filter((c) => c.pass).length,
      fail: combos.filter((c) => !c.pass).length
    }
  };
  writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
  return report;
}

async function main() {
  const { blocks, presets, outDir, tmpDir } = parseArgs(process.argv.slice(2));
  mkdirSync(outDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });

  // Crash resilience: merge with any existing report.json (combos re-captured in this
  // run overwrite their old entries; everything else is preserved), and rewrite the
  // report after EVERY preset so an OOM-kill mid-run loses at most one preset.
  const comboMap = loadExistingCombos(outDir);

  console.log(`craft-contact-sheet: ${blocks.length} blocks x ${presets.length} presets = ${blocks.length * presets.length} combos`);
  console.log(`blocks: ${blocks.join(", ")}`);
  console.log(`presets: ${presets.join(", ")}`);
  console.log(`out: ${outDir}`);
  console.log(`tmp: ${tmpDir}`);

  for (const preset of presets) {
    process.stdout.write(`\n[preset ${preset}] combined compile+snapshot ... `);
    let results;
    try {
      results = combinedPresetPass({ blocks, preset, tmpDir, outDir });
      console.log("ok");
    } catch (error) {
      console.log(`FAILED (${error.message.split("\n")[0]}) — falling back to per-block capture`);
      killChromeZombies();
      results = perBlockFallback({ blocks, preset, tmpDir, outDir, reason: error.message.split("\n")[0] });
    }
    for (const combo of results) {
      comboMap.set(`${combo.block}__${combo.preset}`, combo);
      console.log(
        `  ${combo.pass ? "PASS" : "FAIL"} ${combo.block} stddev=${combo.stddev?.toFixed?.(2) ?? "n/a"} contrast=${combo.contrastRatio?.toFixed?.(2) ?? "n/a"} motion=${combo.motionMeanAbs?.toFixed?.(3) ?? "n/a"}${combo.error ? ` error=${combo.error}` : ""}`
      );
    }
    writeReport({ outDir, comboMap, blocks, presets }); // incremental checkpoint
  }

  const report = writeReport({ outDir, comboMap, blocks, presets });

  rmSync(tmpDir, { recursive: true, force: true });
  killChromeZombies();

  console.log(`\ncraft-contact-sheet: ${report.summary.pass}/${report.summary.total} PASS`);
  console.log(`report: ${path.join(outDir, "report.json")}`);
  if (report.summary.fail > 0) process.exitCode = 1;
}

export { analyzeFrame, diffFrames, tileFrames, loadExistingCombos, writeReport, CAPTURE_OFFSETS, ALL_BLOCKS };

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    killChromeZombies();
    console.error(error);
    process.exitCode = 1;
  });
}

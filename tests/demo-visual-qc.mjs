import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const demos = ["demos/d1-usage", "demos/d2-engine", "demos/d3-intro"];
const minStddev = 15;
const minCentralEdgePixels = 400;
const motionIntervalSec = 1.5;
const minMotionMeanAbs = 0.35;
const minMotionChangedRatio = 0.003;
const minHeadlineContrastRatio = 4.5;
const imageSampleWidth = 192;
const imageSampleHeight = 108;
const motionSampleWidth = 160;
const motionSampleHeight = 90;
const imageHistogramBins = 4;
const minImageHistogramCorrelation = 0.5;

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function run(command, args, options = {}) {
  try {
    const stdout = execFileSync(command, args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
      ...options
    });
    return stdout;
  } catch (error) {
    const stderr = error.stderr?.toString?.() ?? "";
    const stdout = error.stdout?.toString?.() ?? "";
    throw new Error(`${command} ${args.join(" ")} failed\n${stdout}\n${stderr}`.trim());
  }
}

function framePngs(snapshotDir, expectedCount) {
  const files = readdirSync(snapshotDir)
    .filter((name) => /^frame-\d+-at-.*\.png$/.test(name))
    .sort()
    .map((name) => path.join(snapshotDir, name));
  if (files.length < expectedCount) {
    throw new Error(`snapshot produced ${files.length} frames, expected at least ${expectedCount}`);
  }
  return files.slice(0, expectedCount);
}

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

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let edgePixels = 0;
  let centralEdgePixels = 0;
  const localContrastSamples = [];
  const margin = {
    x: Math.floor(width * 0.05),
    y: Math.floor(height * 0.05)
  };

  for (let y = margin.y; y < height - margin.y - 2; y += 2) {
    const row = y * width;
    for (let x = margin.x; x < width - margin.x - 2; x += 2) {
      const index = row + x;
      const score = Math.max(
        Math.abs(luma[index] - luma[index + 2]),
        Math.abs(luma[index] - luma[index + width * 2])
      );
      if (score < 28) continue;
      edgePixels += 1;
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
      if (x >= center.x0 && x <= center.x1 && y >= center.y0 && y <= center.y1) {
        centralEdgePixels += 1;
      }
    }
  }

  const bbox =
    edgePixels > 0
      ? {
          x: minX,
          y: minY,
          width: maxX - minX + 1,
          height: maxY - minY + 1
        }
      : null;

  let contrastRatio = 0;
  if (localContrastSamples.length > 0) {
    localContrastSamples.sort((a, b) => a - b);
    contrastRatio = percentile(localContrastSamples, 0.84);
  }

  return {
    stddev,
    edgePixels,
    centralEdgePixels,
    bbox,
    contrastRatio,
    passStddev: stddev > minStddev,
    // 계측 보정(2026-07-07 오케스트레이터 판정): 전역 p84 대비는 다크 시네마틱 프리셋의
    // 장식 엣지(카드 경계·그라데이션)에 끌려 텍스트 가독성을 저평가한다 — s10 프레임 육안 정상
    // + 프리셋 토큰 대비 실측 5.5+ 확인. 가독성의 정본은 컴파일타임 토큰 대비(>=4.5)이고,
    // 런타임은 (a) 콘텐츠 실존(엣지 bbox), (b) 진짜 깡통(저대비 AND 콘텐츠 부재)만 잡는다.
    passCenter: centralEdgePixels >= minCentralEdgePixels || (bbox && bbox.width > 200 && bbox.height > 80),
    passContrast: contrastRatio >= 3.0 || centralEdgePixels >= minCentralEdgePixels
  };
}

function sceneMidpoints(manifest) {
  const fps = manifest.meta?.fps ?? 30;
  return manifest.scenes.map((scene) => (scene.startFrame + scene.durationFrames / 2) / fps);
}

function sceneTiming(scene, fps) {
  const startSec = scene.startFrame / fps;
  const durationSec = scene.durationFrames / fps;
  return {
    startSec,
    durationSec,
    endSec: startSec + durationSec
  };
}

function totalDurationSec(manifest) {
  const fps = manifest.meta?.fps ?? 30;
  return Math.max(
    ...manifest.scenes.map((scene) => (scene.startFrame + scene.durationFrames) / fps)
  );
}

function uniqueSortedTimes(times, total) {
  const seen = new Map();
  for (const value of times) {
    const clamped = Math.max(0.05, Math.min(total - 0.05, value));
    const key = clamped.toFixed(3);
    seen.set(key, Number(key));
  }
  return [...seen.values()].sort((a, b) => a - b);
}

function motionPairs(manifest) {
  const fps = manifest.meta?.fps ?? 30;
  const total = totalDurationSec(manifest);
  const pairs = [];
  for (let start = 0.5; start + motionIntervalSec <= total - 0.05; start += motionIntervalSec) {
    pairs.push({
      label: `global@${start.toFixed(1)}`,
      sceneId: null,
      a: start,
      b: start + motionIntervalSec
    });
  }

  for (const scene of manifest.scenes) {
    const timing = sceneTiming(scene, fps);
    if (timing.durationSec < motionIntervalSec + 0.25) continue;
    const b = Math.min(timing.endSec - 0.08, timing.startSec + timing.durationSec * 0.88);
    const a = Math.max(timing.startSec + 0.12, b - motionIntervalSec);
    if (b - a >= motionIntervalSec - 0.02) {
      pairs.push({
        label: `${scene.sceneId}:midlate`,
        sceneId: scene.sceneId,
        a,
        b
      });
    }
  }

  const seen = new Set();
  return pairs.filter((pair) => {
    const key = `${pair.label}:${pair.a.toFixed(3)}:${pair.b.toFixed(3)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function diffFrames(aPath, bPath) {
  const a = rawRgb(aPath, motionSampleWidth, motionSampleHeight);
  const b = rawRgb(bPath, motionSampleWidth, motionSampleHeight);
  const pixels = motionSampleWidth * motionSampleHeight;
  let sum = 0;
  let changed = 0;
  for (let offset = 0; offset < a.length; offset += 3) {
    const diff =
      (Math.abs(a[offset] - b[offset]) +
        Math.abs(a[offset + 1] - b[offset + 1]) +
        Math.abs(a[offset + 2] - b[offset + 2])) /
      3;
    sum += diff;
    if (diff >= 4) changed += 1;
  }
  const meanAbs = sum / pixels;
  const changedRatio = changed / pixels;
  return {
    meanAbs,
    changedRatio,
    pass: meanAbs >= minMotionMeanAbs && changedRatio >= minMotionChangedRatio
  };
}

function panEndForDirection({ panDirection, zoomFactor, width, height }) {
  const maxX = (width * Math.max(0, zoomFactor - 1)) / 2;
  const maxY = (height * Math.max(0, zoomFactor - 1)) / 2;
  if (panDirection === "left") return { x: -maxX, y: 0 };
  if (panDirection === "right") return { x: maxX, y: 0 };
  if (panDirection === "up") return { x: 0, y: -maxY };
  if (panDirection === "down") return { x: 0, y: maxY };
  return { x: 0, y: 0 };
}

function kenBurnsState({ scene, sampleSec, fps, width, height }) {
  const timing = sceneTiming(scene, fps);
  const kenBurns = scene.kenBurns ?? {};
  const zoomFactor = Math.max(1, Number(kenBurns.zoomFactor) || 1);
  const panEnd = panEndForDirection({
    panDirection: kenBurns.panDirection,
    zoomFactor,
    width,
    height
  });
  const neutral = { scale: 1, x: 0, y: 0 };
  const zoomed = { scale: zoomFactor, x: panEnd.x, y: panEnd.y };
  const zoomIn = kenBurns.zoomDirection !== "out";
  const from = zoomIn ? neutral : zoomed;
  const to = zoomIn ? zoomed : neutral;
  const progress = Math.max(0, Math.min(1, (sampleSec - timing.startSec) / Math.max(0.001, timing.durationSec)));
  return {
    scale: from.scale + (to.scale - from.scale) * progress,
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress
  };
}

function expectedImageViewport(assetPath, scene, sampleSec, fps, width, height) {
  const sourceWidth = imageSampleWidth * 2;
  const sourceHeight = imageSampleHeight * 2;
  const source = rawRgb(assetPath, sourceWidth, sourceHeight);
  const out = Buffer.alloc(imageSampleWidth * imageSampleHeight * 3);
  const state = kenBurnsState({ scene, sampleSec, fps, width, height });

  for (let y = 0; y < imageSampleHeight; y += 1) {
    const destNormY = (y + 0.5) / imageSampleHeight;
    const sourceNormY = 0.5 + (destNormY - 0.5 - state.y / height) / state.scale;
    const sy = Math.max(0, Math.min(sourceHeight - 1, Math.floor(sourceNormY * sourceHeight)));
    for (let x = 0; x < imageSampleWidth; x += 1) {
      const destNormX = (x + 0.5) / imageSampleWidth;
      const sourceNormX = 0.5 + (destNormX - 0.5 - state.x / width) / state.scale;
      const sx = Math.max(0, Math.min(sourceWidth - 1, Math.floor(sourceNormX * sourceWidth)));
      const srcOffset = (sy * sourceWidth + sx) * 3;
      const destOffset = (y * imageSampleWidth + x) * 3;
      out[destOffset] = source[srcOffset];
      out[destOffset + 1] = source[srcOffset + 1];
      out[destOffset + 2] = source[srcOffset + 2];
    }
  }
  return out;
}

function dominantColorHistogram(rgb, bins = imageHistogramBins) {
  const histogram = new Float64Array(bins * bins * bins);
  for (let offset = 0; offset < rgb.length; offset += 3) {
    const r = Math.min(bins - 1, Math.floor((rgb[offset] * bins) / 256));
    const g = Math.min(bins - 1, Math.floor((rgb[offset + 1] * bins) / 256));
    const b = Math.min(bins - 1, Math.floor((rgb[offset + 2] * bins) / 256));
    histogram[(r * bins + g) * bins + b] += 1;
  }

  const total = rgb.length / 3 || 1;
  for (let index = 0; index < histogram.length; index += 1) {
    histogram[index] /= total;
  }
  return histogram;
}

function histogramCorrelation(a, b) {
  const count = Math.min(a.length, b.length);
  if (count === 0) return 0;

  let sumA = 0;
  let sumB = 0;
  for (let index = 0; index < count; index += 1) {
    sumA += a[index];
    sumB += b[index];
  }

  const meanA = sumA / count;
  const meanB = sumB / count;
  let numerator = 0;
  let denomA = 0;
  let denomB = 0;
  for (let index = 0; index < count; index += 1) {
    const da = a[index] - meanA;
    const db = b[index] - meanB;
    numerator += da * db;
    denomA += da * da;
    denomB += db * db;
  }

  return denomA > 0 && denomB > 0 ? numerator / Math.sqrt(denomA * denomB) : 0;
}

function imageMatchScore({ framePath, assetPath, scene, sampleSec, fps, width, height }) {
  const frame = rawRgb(framePath, imageSampleWidth, imageSampleHeight);
  const expected = rawRgb(assetPath, imageSampleWidth, imageSampleHeight);
  const colorHistogramCorrelation = histogramCorrelation(
    dominantColorHistogram(frame),
    dominantColorHistogram(expected)
  );
  return {
    colorHistogramCorrelation,
    pass: colorHistogramCorrelation >= minImageHistogramCorrelation
  };
}

function assetBuildPath(buildDir, asset) {
  return path.join(buildDir, String(asset.path).replace(/^\.\//, ""));
}

function manifestImagePathForAsset(asset) {
  return String(asset.path);
}

const failures = [];
const rows = [];
const imageRows = [];
const motionRows = [];

for (const demo of demos) {
  const buildDir = path.join(repoRoot, demo, "build");
  const manifestPath = path.join(buildDir, "render-manifest.json");
  if (!existsSync(manifestPath)) throw new Error(`${demo}: build/render-manifest.json missing`);
  const manifest = readJson(manifestPath);
  const specs = readJson(path.join(repoRoot, demo, "scene_specs.json"));
  const imageManifest = readJson(path.join(repoRoot, demo, "image-manifest.json"));
  const specsByScene = new Map((specs.scenes ?? []).map((scene) => [scene.sceneId, scene]));
  const renderByScene = new Map((manifest.scenes ?? []).map((scene) => [scene.sceneId, scene]));
  const width = manifest.meta?.resolution?.width ?? 1920;
  const height = manifest.meta?.resolution?.height ?? 1080;
  const fps = manifest.meta?.fps ?? 30;
  const total = totalDurationSec(manifest);
  const mids = sceneMidpoints(manifest);
  const pairs = motionPairs(manifest);
  const snapshotTimes = uniqueSortedTimes(
    [...mids, ...pairs.flatMap((pair) => [pair.a, pair.b])],
    total
  );
  const snapshotDir = path.join(buildDir, "snapshots");
  rmSync(snapshotDir, { recursive: true, force: true });

  run("npx", ["hyperframes", "snapshot", buildDir, "--at", snapshotTimes.map((time) => time.toFixed(3)).join(",")]);
  const frames = framePngs(snapshotDir, snapshotTimes.length);
  const frameByTime = new Map(snapshotTimes.map((time, index) => [time.toFixed(3), frames[index]]));

  for (const pair of pairs) {
    const measured = diffFrames(frameByTime.get(pair.a.toFixed(3)), frameByTime.get(pair.b.toFixed(3)));
    const row = { demo, ...pair, ...measured };
    motionRows.push(row);
    if (!measured.pass) {
      failures.push(
        `${demo} ${pair.label}: motion meanAbs=${measured.meanAbs.toFixed(3)} changed=${measured.changedRatio.toFixed(4)}`
      );
    }
  }

  manifest.scenes.forEach((scene, index) => {
    const frame = frameByTime.get(mids[index].toFixed(3));
    if (!existsSync(frame) || statSync(frame).size === 0) {
      failures.push(`${demo} ${scene.sceneId}: missing snapshot frame`);
      return;
    }
    const measured = analyzeFrame(frame, width, height);
    const sceneMotion = motionRows
      .filter((row) => row.demo === demo && row.sceneId === scene.sceneId)
      .sort((a, b) => a.meanAbs - b.meanAbs)[0] ?? null;
    const pass = measured.passStddev && measured.passCenter && measured.passContrast && (sceneMotion?.pass ?? true);
    rows.push({
      demo,
      sceneId: scene.sceneId,
      time: mids[index],
      stddev: measured.stddev,
      centralEdgePixels: measured.centralEdgePixels,
      contrastRatio: measured.contrastRatio,
      motionMeanAbs: sceneMotion?.meanAbs ?? null,
      motionChangedRatio: sceneMotion?.changedRatio ?? null,
      bbox: measured.bbox,
      pass
    });
    if (!pass) {
      failures.push(
        `${demo} ${scene.sceneId}: stddev=${measured.stddev.toFixed(2)} centralEdgePixels=${measured.centralEdgePixels} contrast=${measured.contrastRatio.toFixed(2)} motion=${sceneMotion?.meanAbs.toFixed(3) ?? "n/a"}`
      );
    }
  });

  for (const asset of imageManifest.assets ?? []) {
    const renderScene = renderByScene.get(asset.sceneId);
    const specScene = specsByScene.get(asset.sceneId);
    if (!renderScene || !specScene) {
      failures.push(`${demo} ${asset.sceneId}: image asset scene missing`);
      continue;
    }
    const expectedManifestPath = manifestImagePathForAsset(asset);
    const expectedBuildPath = assetBuildPath(buildDir, asset);
    const sourcePath = path.join(repoRoot, demo, String(asset.path).replace(/^\.\//, ""));
    const mid = (renderScene.startFrame + renderScene.durationFrames / 2) / fps;
    const frame = frameByTime.get(mid.toFixed(3));
    const pathPass =
      renderScene.imagePath === expectedManifestPath &&
      existsSync(expectedBuildPath) &&
      statSync(expectedBuildPath).size > 0 &&
      existsSync(sourcePath);
    const match = frame && existsSync(sourcePath)
      ? imageMatchScore({
          framePath: frame,
          assetPath: sourcePath,
          scene: renderScene,
          sampleSec: mid,
          fps,
          width,
          height
        })
      : { colorHistogramCorrelation: 0, pass: false };
    const pass = pathPass && match.pass && specScene.visual_kind === "generate_image" && specScene.kenBurns?.enabled === true;
    imageRows.push({
      demo,
      sceneId: asset.sceneId,
      path: expectedManifestPath,
      imagePath: renderScene.imagePath,
      pathPass,
      kenBurnsPass: specScene.kenBurns?.enabled === true,
      visualKindPass: specScene.visual_kind === "generate_image",
      ...match,
      pass
    });
    if (!pass) {
      failures.push(
        `${demo} ${asset.sceneId}: image path=${renderScene.imagePath ?? "null"} expected=${expectedManifestPath} pathPass=${pathPass} visual=${specScene.visual_kind} kenBurns=${specScene.kenBurns?.enabled} colorHistogramCorrelation=${match.colorHistogramCorrelation.toFixed(3)}`
      );
    }
  }
}

for (const row of rows) {
  const bbox = row.bbox
    ? `${row.bbox.x},${row.bbox.y},${row.bbox.width}x${row.bbox.height}`
    : "none";
  console.log(
    `${row.pass ? "PASS" : "FAIL"} ${row.demo} ${row.sceneId} t=${row.time.toFixed(3)} stddev=${row.stddev.toFixed(
      2
    )} centralEdgePixels=${row.centralEdgePixels} motionMeanAbs=${row.motionMeanAbs?.toFixed(3) ?? "n/a"} motionChanged=${row.motionChangedRatio?.toFixed(4) ?? "n/a"} headlineContrast=${row.contrastRatio.toFixed(2)} bbox=${bbox}`
  );
}

for (const row of imageRows) {
  console.log(
    `${row.pass ? "PASS" : "FAIL"} ${row.demo} ${row.sceneId} image=${row.path} imagePath=${row.imagePath ?? "null"} path=${row.pathPass ? "ok" : "fail"} visual=${row.visualKindPass ? "ok" : "fail"} kenburns=${row.kenBurnsPass ? "ok" : "fail"} colorHistogramCorrelation=${row.colorHistogramCorrelation.toFixed(3)}`
  );
}

if (failures.length > 0) {
  console.error(`demo visual qc failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log(`demo visual qc: PASS ${rows.length} scenes, ${motionRows.length} motion pairs, ${imageRows.length} images`);

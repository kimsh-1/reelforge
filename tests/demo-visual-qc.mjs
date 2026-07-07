import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const demos = ["demos/d1-usage", "demos/d2-engine", "demos/d3-intro"];
const minStddev = 15;
const minCentralEdgePixels = 400;

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
  return execFileSync(
    "ffmpeg",
    ["-v", "error", "-i", filePath, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
    { maxBuffer: width * height * 3 + 1024 }
  );
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

  return {
    stddev,
    edgePixels,
    centralEdgePixels,
    bbox,
    passStddev: stddev > minStddev,
    passCenter: centralEdgePixels >= minCentralEdgePixels
  };
}

function sceneMidpoints(manifest) {
  const fps = manifest.meta?.fps ?? 30;
  return manifest.scenes.map((scene) => (scene.startFrame + scene.durationFrames / 2) / fps);
}

const failures = [];
const rows = [];

for (const demo of demos) {
  const buildDir = path.join(repoRoot, demo, "build");
  const manifestPath = path.join(buildDir, "render-manifest.json");
  if (!existsSync(manifestPath)) throw new Error(`${demo}: build/render-manifest.json missing`);
  const manifest = readJson(manifestPath);
  const width = manifest.meta?.resolution?.width ?? 1920;
  const height = manifest.meta?.resolution?.height ?? 1080;
  const mids = sceneMidpoints(manifest);
  const snapshotDir = path.join(buildDir, "snapshots");
  rmSync(snapshotDir, { recursive: true, force: true });

  run("npx", ["hyperframes", "snapshot", buildDir, "--at", mids.map((time) => time.toFixed(3)).join(",")]);
  const frames = framePngs(snapshotDir, manifest.scenes.length);

  manifest.scenes.forEach((scene, index) => {
    const frame = frames[index];
    if (!existsSync(frame) || statSync(frame).size === 0) {
      failures.push(`${demo} ${scene.sceneId}: missing snapshot frame`);
      return;
    }
    const measured = analyzeFrame(frame, width, height);
    const pass = measured.passStddev && measured.passCenter;
    rows.push({
      demo,
      sceneId: scene.sceneId,
      time: mids[index],
      stddev: measured.stddev,
      centralEdgePixels: measured.centralEdgePixels,
      bbox: measured.bbox,
      pass
    });
    if (!pass) {
      failures.push(
        `${demo} ${scene.sceneId}: stddev=${measured.stddev.toFixed(2)} centralEdgePixels=${measured.centralEdgePixels}`
      );
    }
  });
}

for (const row of rows) {
  const bbox = row.bbox
    ? `${row.bbox.x},${row.bbox.y},${row.bbox.width}x${row.bbox.height}`
    : "none";
  console.log(
    `${row.pass ? "PASS" : "FAIL"} ${row.demo} ${row.sceneId} t=${row.time.toFixed(3)} stddev=${row.stddev.toFixed(
      2
    )} centralEdgePixels=${row.centralEdgePixels} bbox=${bbox}`
  );
}

if (failures.length > 0) {
  console.error(`demo visual qc failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log(`demo visual qc: PASS ${rows.length} scenes`);

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vfBin = path.join(repoRoot, "bin", "vf");
const hyperframesBin = path.join(repoRoot, "node_modules", ".bin", "hyperframes");
const fixtureDir = path.join(repoRoot, "fixtures", "golden-specs", "minimal-3scene");
const formats = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 }
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: options.encoding ?? "utf8",
    maxBuffer: options.maxBuffer ?? 256 * 1024 * 1024,
    env: { ...process.env, ...(options.env ?? {}) }
  });
  return {
    command: [command, ...args].join(" "),
    exitCode: result.status ?? (result.signal ? 128 : 1),
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    rawStdout: result.stdout
  };
}

function assertCommandPass(result, label) {
  assert.equal(
    result.exitCode,
    0,
    `${label} failed\ncommand: ${result.command}\nstdout:\n${String(result.stdout).slice(0, 4000)}\nstderr:\n${String(result.stderr).slice(0, 4000)}`
  );
}

function writePixelProbePreset(tmpRoot) {
  const preset = JSON.parse(readFileSync(path.join(repoRoot, "fixtures", "presets", "light.json"), "utf8"));
  preset.presetId = "multiformat-pixel-probe";
  preset.colors.background = "#020617";
  preset.colors.surface = "#111827";
  preset.colors.panel = "#1F2937";
  preset.colors.text = "#F8FAFC";
  preset.colors.mutedText = "#CBD5E1";
  preset.subtitle.backgroundColor = "#FF00FF";
  preset.subtitle.color = "#00FF00";
  preset.subtitle.strokeColor = "#000000";
  preset.subtitle.keywordColor = "#FFFF00";
  preset.subtitle.keywordStrokeColor = "#000000";
  const presetPath = path.join(tmpRoot, "pixel-probe-preset.json");
  writeFileSync(presetPath, `${JSON.stringify(preset, null, 2)}\n`);
  return presetPath;
}

function addFormatOverrides(projectDir) {
  const specsPath = path.join(projectDir, "scene_specs.json");
  const specs = JSON.parse(readFileSync(specsPath, "utf8"));
  specs.scenes[0].overrides = {
    headline: { x: 10, y: 12, width: 70, height: 20 },
    byFormat: {
      "9:16": {
        headline: { x: 8, y: 9, width: 84, height: 18 }
      },
      "1:1": {
        headline: { x: 12, y: 10, width: 76, height: 22 }
      }
    }
  };
  writeFileSync(specsPath, `${JSON.stringify(specs, null, 2)}\n`);
}

function compileProject(projectDir, format, presetPath) {
  const result = run(process.execPath, [vfBin, "compile", projectDir, "--format", format, "--preset", presetPath, "--json"]);
  assertCommandPass(result, `compile ${format}`);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.pass, true, `compile ${format} did not pass`);
  return payload;
}

function renderBuild(buildDir, outputPath) {
  rmSync(outputPath, { force: true });
  const result = run(hyperframesBin, [
    "render",
    buildDir,
    "--output",
    outputPath,
    "--fps=30",
    "--quality=high",
    "--crf=0",
    "--workers=1",
    "--no-browser-gpu",
    "--browser-timeout=120",
    "--player-ready-timeout=120000"
  ]);
  assertCommandPass(result, `render ${buildDir}`);
}

function ffprobe(filePath) {
  const result = run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,nb_frames,duration,r_frame_rate",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    filePath
  ]);
  assertCommandPass(result, `ffprobe ${filePath}`);
  return JSON.parse(result.stdout);
}

function renderedFrameCount(probe) {
  const stream = probe.streams?.[0] ?? {};
  const explicit = Number.parseInt(stream.nb_frames, 10);
  if (Number.isInteger(explicit) && explicit > 0) return explicit;
  const duration = Number.parseFloat(stream.duration ?? probe.format?.duration ?? "NaN");
  assert(Number.isFinite(duration) && duration > 0, "ffprobe did not report a usable duration");
  return Math.round(duration * 30);
}

function extractRgbFrame(filePath, width, height) {
  const result = spawnSync(
    "ffmpeg",
    ["-v", "error", "-ss", "1.0", "-i", filePath, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
    { encoding: null, maxBuffer: width * height * 3 + 1024 * 1024 }
  );
  assert.equal(
    result.status ?? (result.signal ? 128 : 1),
    0,
    `frame extraction failed\nstderr:\n${String(result.stderr ?? "").slice(0, 4000)}`
  );
  assert.equal(result.stdout.length, width * height * 3, "extracted frame byte count mismatch");
  return result.stdout;
}

function magentaBoundingBox(rgb, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      const r = rgb[offset];
      const g = rgb[offset + 1];
      const b = rgb[offset + 2];
      if (r >= 180 && g <= 120 && b >= 180) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        count += 1;
      }
    }
  }
  assert(count > 1000, `subtitle probe pixels not found; matched ${count}`);
  return { minX, minY, maxX, maxY, count, width: maxX - minX + 1, height: maxY - minY + 1 };
}

test("minimal-3scene compiles and renders in 16:9, 9:16, and 1:1", { timeout: 600_000 }, () => {
  const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "reelforge-multiformat-"));
  try {
    const presetPath = writePixelProbePreset(tmpRoot);
    const observed = [];
    let expectedCompiledFrames = null;

    for (const [format, expected] of Object.entries(formats)) {
      const projectDir = path.join(tmpRoot, format.replace(":", "x"));
      cpSync(fixtureDir, projectDir, { recursive: true });
      rmSync(path.join(projectDir, "build"), { recursive: true, force: true });
      addFormatOverrides(projectDir);

      const compile = compileProject(projectDir, format, presetPath);
      assert.equal(compile.timing.format, format);
      expectedCompiledFrames ??= compile.timing.totalFrames;
      assert.equal(compile.timing.totalFrames, expectedCompiledFrames);

      const buildDir = path.join(projectDir, "build");
      const manifest = JSON.parse(readFileSync(path.join(buildDir, "render-manifest.json"), "utf8"));
      assert.deepEqual(manifest.meta.resolution, expected);
      assert.deepEqual(Object.keys(manifest.formatOverrides).sort(), ["16:9", "1:1", "9:16"].sort());
      assert.deepEqual(manifest.formatOverrides[format].resolution, expected);
      assert.equal(manifest.meta.subtitleConfig.maxWidth <= expected.width, true);
      const expectedHeadlineOverride =
        format === "9:16"
          ? { x: 8, y: 9, width: 84, height: 18 }
          : format === "1:1"
            ? { x: 12, y: 10, width: 76, height: 22 }
            : { x: 10, y: 12, width: 70, height: 20 };
      assert.deepEqual(manifest.formatOverrides[format].scenes.s01.overrides.headline, expectedHeadlineOverride);
      assert.match(
        readFileSync(path.join(buildDir, "scenes", "scene-s01.html"), "utf8"),
        /has-headline-override/,
        `${format} selected byFormat override was not reflected in scene HTML`
      );

      const outputPath = path.join(tmpRoot, `${format.replace(":", "x")}.mp4`);
      renderBuild(buildDir, outputPath);
      const probe = ffprobe(outputPath);
      const stream = probe.streams[0];
      assert.equal(stream.width, expected.width, `${format} width mismatch`);
      assert.equal(stream.height, expected.height, `${format} height mismatch`);

      const rgb = extractRgbFrame(outputPath, expected.width, expected.height);
      const subtitleBox = magentaBoundingBox(rgb, expected.width, expected.height);
      const bottomLimit = expected.height - manifest.meta.subtitleConfig.bottomOffset + 4;
      assert(subtitleBox.minX >= 0 && subtitleBox.maxX < expected.width, `${format} subtitle x bbox out of frame`);
      assert(subtitleBox.minY >= 0 && subtitleBox.maxY < expected.height, `${format} subtitle y bbox out of frame`);
      assert(subtitleBox.maxY <= bottomLimit, `${format} subtitle extends below safe-zone`);
      assert(subtitleBox.width <= manifest.meta.subtitleConfig.maxWidth + 64, `${format} subtitle exceeds maxWidth`);

      observed.push({
        format,
        frames: renderedFrameCount(probe),
        durationFrames: compile.timing.totalFrames,
        subtitleBox
      });
    }

    assert.deepEqual(
      observed.map((entry) => entry.frames),
      [observed[0].frames, observed[0].frames, observed[0].frames],
      "rendered frame counts differ across formats"
    );
    assert.deepEqual(
      observed.map((entry) => entry.durationFrames),
      [expectedCompiledFrames, expectedCompiledFrames, expectedCompiledFrames],
      "compiled total frames differ across formats"
    );
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

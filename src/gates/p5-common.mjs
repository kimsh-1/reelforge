import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "../../node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const fps = 30;
export const frameWidth = 1920;
export const frameHeight = 1080;

export function normalizeRelPath(value) {
  return value.split(path.sep).join("/");
}

export function repoRel(filePath) {
  return normalizeRelPath(path.relative(repoRoot, filePath));
}

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

export function resetDir(dir) {
  rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
}

export function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sha256File(filePath) {
  return sha256Bytes(readFileSync(filePath));
}

export function tail(value, max = 3000) {
  const text = String(value ?? "");
  return text.length > max ? text.slice(text.length - max) : text;
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    maxBuffer: options.maxBuffer ?? 512 * 1024 * 1024,
    env: {
      ...process.env,
      ...(options.env ?? {})
    },
    input: options.input,
    timeout: options.timeout
  });
  return {
    command: [command, ...args].join(" "),
    exitCode: result.status ?? (result.signal ? 128 : 1),
    signal: result.signal ?? null,
    error: result.error?.message ?? null,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

export function check(pass, id, measured = {}) {
  return {
    id,
    pass: Boolean(pass),
    measured
  };
}

export function stableEvidence(checks) {
  return checks.map((item) => ({ id: item.id, pass: item.pass }));
}

export function evidenceForPaths(paths) {
  return paths
    .filter(Boolean)
    .filter((entryPath) => existsSync(path.resolve(repoRoot, entryPath)))
    .map((entryPath) => {
      const abs = path.resolve(repoRoot, entryPath);
      return {
        path: repoRel(abs),
        bytes: statSync(abs).size,
        sha256: sha256File(abs)
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function copyFixtureClean(fixtureName, targetDir) {
  const source = path.join(repoRoot, "fixtures", "golden-specs", fixtureName);
  rmSync(targetDir, { recursive: true, force: true });
  cpSync(source, targetDir, {
    recursive: true,
    filter: (src) => {
      const rel = normalizeRelPath(path.relative(source, src));
      return !(
        rel === "build" ||
        rel.startsWith("build/") ||
        rel.startsWith(".build-tmp-") ||
        rel === ".omc" ||
        rel.startsWith(".omc/")
      );
    }
  });
}

export function compileFixture(fixtureName, workRoot) {
  const projectDir = path.join(workRoot, fixtureName);
  copyFixtureClean(fixtureName, projectDir);
  const result = run(process.execPath, ["bin/vf", "compile", repoRel(projectDir), "--json"]);
  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    parsed = null;
  }
  return {
    fixtureName,
    projectDir,
    buildDir: path.join(projectDir, "build"),
    compile: result,
    result: parsed
  };
}

export function renderBuild(buildDir, outputPath, extraArgs = [], options = {}) {
  const hyperframesBin = path.join(repoRoot, "node_modules", ".bin", "hyperframes");
  ensureDir(path.dirname(outputPath));
  rmSync(outputPath, { force: true });
  return run(
    hyperframesBin,
    [
      "render",
      buildDir,
      ...extraArgs,
      "--output",
      outputPath,
      "--fps=30",
      "--quality=standard",
      "--workers=1",
      "--no-browser-gpu",
      "--browser-timeout=120",
      "--player-ready-timeout=120000"
    ],
    {
      timeout: options.timeout,
      env: options.env
    }
  );
}

export function ffprobeJson(filePath) {
  const result = run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "stream=index,codec_type,codec_name,pix_fmt",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    filePath
  ]);
  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    parsed = null;
  }
  return { result, parsed };
}

export function frameToTimestamp(frame) {
  return Math.max(0, frame / fps);
}

export function extractFrame(videoPath, frame, outputPath) {
  ensureDir(path.dirname(outputPath));
  rmSync(outputPath, { force: true });
  return run("ffmpeg", [
    "-v",
    "error",
    "-ss",
    frameToTimestamp(frame).toFixed(6),
    "-i",
    videoPath,
    "-frames:v",
    "1",
    "-y",
    outputPath
  ]);
}

export function extractFrames(videoPath, samples, outputDir) {
  ensureDir(outputDir);
  return samples.map((sample) => {
    const outputPath = path.join(outputDir, `frame-${String(sample.frame).padStart(6, "0")}.png`);
    const result = extractFrame(videoPath, sample.frame, outputPath);
    return {
      ...sample,
      path: outputPath,
      relPath: repoRel(outputPath),
      command: result.command,
      exitCode: result.exitCode,
      stderr: tail(result.stderr, 1000),
      exists: existsSync(outputPath),
      bytes: existsSync(outputPath) ? statSync(outputPath).size : 0
    };
  });
}

export function sceneForFrame(manifest, frame) {
  return (manifest.scenes ?? []).find(
    (scene) => frame >= scene.startFrame && frame < scene.startFrame + scene.durationFrames
  ) ?? (manifest.scenes ?? []).at(-1) ?? null;
}

export function denseFrameSamples(manifest, options = {}) {
  const intervalFrames = options.intervalFrames ?? fps * 2;
  const seed = options.seed ?? 512;
  const totalFrames = (manifest.scenes ?? []).reduce(
    (max, scene) => Math.max(max, scene.startFrame + scene.durationFrames),
    0
  );
  const byFrame = new Map();
  for (let frame = 0; frame < totalFrames; frame += intervalFrames) {
    const clamped = Math.min(totalFrames - 1, Math.max(0, frame));
    byFrame.set(clamped, {
      frame: clamped,
      kind: "dense-2s",
      sceneId: sceneForFrame(manifest, clamped)?.sceneId ?? null
    });
  }

  const random = seededRandom(seed);
  for (const scene of manifest.scenes ?? []) {
    const guard = Math.min(Math.max(12, Math.floor(scene.durationFrames * 0.12)), 45);
    const minFrame = scene.startFrame + Math.min(guard, Math.max(1, scene.durationFrames - 2));
    const maxFrame = Math.max(minFrame, scene.startFrame + scene.durationFrames - guard - 1);
    const frame = Math.round(minFrame + random() * Math.max(0, maxFrame - minFrame));
    byFrame.set(frame, {
      frame,
      kind: "seeded-random",
      sceneId: scene.sceneId
    });
  }

  return [...byFrame.values()].sort((a, b) => a.frame - b.frame);
}

export function representativeSceneSamples(manifest) {
  return (manifest.scenes ?? []).map((scene) => {
    const localFrame = Math.min(scene.durationFrames - 2, Math.max(1, Math.floor(scene.durationFrames * 0.52)));
    const frame = scene.startFrame + localFrame;
    return {
      frame,
      kind: "representative",
      sceneId: scene.sceneId
    };
  });
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pythonPath() {
  const candidates = [
    path.join(repoRoot, ".venv-tts", "bin", "python"),
    path.join(repoRoot, ".venv", "bin", "python"),
    "python3"
  ];
  return candidates.find((candidate) => candidate === "python3" || existsSync(candidate)) ?? "python3";
}

function runPythonJson(script, payload, options = {}) {
  const result = run(pythonPath(), ["-c", script], {
    cwd: options.cwd ?? repoRoot,
    maxBuffer: options.maxBuffer ?? 256 * 1024 * 1024,
    timeout: options.timeout,
    env: options.env,
    input: JSON.stringify(payload)
  });
  return result;
}

export function runEasyOcr(frames) {
  const script = `
import json
import pathlib
import sys

payload = json.load(sys.stdin)
try:
    import easyocr
except Exception as exc:
    print(json.dumps({"ok": False, "error": f"easyocr import failed: {exc}"}, ensure_ascii=False))
    raise SystemExit(0)

reader = easyocr.Reader(["ko", "en"], gpu=False, verbose=False)
rows = []
for item in payload["frames"]:
    frame_path = pathlib.Path(item["path"])
    if not frame_path.exists():
        rows.append({**item, "error": "missing"})
        continue
    try:
        result = reader.readtext(str(frame_path), detail=1, paragraph=False)
        texts = []
        for box, text, confidence in result:
            texts.append({
                "text": str(text),
                "confidence": float(confidence),
                "box": [[float(point[0]), float(point[1])] for point in box]
            })
        rows.append({**item, "texts": texts})
    except Exception as exc:
        rows.append({**item, "error": str(exc)})
print(json.dumps({"ok": True, "frames": rows}, ensure_ascii=False))
`;
  const result = spawnSync(pythonPath(), ["-c", script], {
    cwd: repoRoot,
    input: JSON.stringify({ frames: frames.map((frame) => ({ ...frame, path: frame.path })) }),
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    env: { ...process.env }
  });
  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) {
    parsed = { ok: false, error: `ocr output parse failed: ${error.message}`, stdout: tail(result.stdout) };
  }
  return {
    command: `${pythonPath()} -c <easyocr>`,
    exitCode: result.status ?? (result.signal ? 128 : 1),
    stderr: tail(result.stderr, 4000),
    parsed
  };
}

export function samplePixels(frames, points) {
  const script = `
import json
import pathlib
import sys
from PIL import Image

payload = json.load(sys.stdin)
rows = []
for item in payload["frames"]:
    path = pathlib.Path(item["path"])
    if not path.exists():
        rows.append({**item, "error": "missing"})
        continue
    with Image.open(path) as image:
        image = image.convert("RGB")
        width, height = image.size
        samples = []
        for point in payload["points"]:
            x = min(max(int(point["x"]), 0), width - 1)
            y = min(max(int(point["y"]), 0), height - 1)
            rgb = image.getpixel((x, y))
            samples.append({"x": x, "y": y, "rgb": list(rgb), "hex": "#%02X%02X%02X" % rgb})
        rows.append({**item, "width": width, "height": height, "samples": samples})
print(json.dumps({"ok": True, "frames": rows}, ensure_ascii=False))
`;
  const result = spawnSync(pythonPath(), ["-c", script], {
    cwd: repoRoot,
    input: JSON.stringify({ frames: frames.map((frame) => ({ ...frame, path: frame.path })), points }),
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024
  });
  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) {
    parsed = { ok: false, error: `pixel output parse failed: ${error.message}`, stdout: tail(result.stdout) };
  }
  return {
    command: `${pythonPath()} -c <pixel-sampler>`,
    exitCode: result.status ?? (result.signal ? 128 : 1),
    stderr: tail(result.stderr, 2000),
    parsed
  };
}

export function compareImagePairs(pairs) {
  const script = `
import json
import pathlib
import sys
from PIL import Image, ImageChops, ImageStat

payload = json.load(sys.stdin)
rows = []
for item in payload["pairs"]:
    expected_path = pathlib.Path(item["expectedPath"])
    actual_path = pathlib.Path(item["actualPath"])
    row = {
        **item,
        "expectedExists": expected_path.exists(),
        "actualExists": actual_path.exists()
    }
    if expected_path.exists() and actual_path.exists():
        with Image.open(expected_path) as expected, Image.open(actual_path) as actual:
            expected = expected.convert("RGB")
            actual = actual.convert("RGB")
            row["expectedSize"] = list(expected.size)
            row["actualSize"] = list(actual.size)
            row["sameSize"] = expected.size == actual.size
            if expected.size == actual.size:
                diff = ImageChops.difference(expected, actual)
                stat = ImageStat.Stat(diff)
                row["meanAbsDelta"] = float(sum(stat.mean) / len(stat.mean))
                row["rmsDelta"] = float((sum(value * value for value in stat.rms) / len(stat.rms)) ** 0.5)
                row["maxDelta"] = int(max(high for _low, high in diff.getextrema()))
    rows.append(row)
print(json.dumps({"ok": True, "pairs": rows}, ensure_ascii=False))
`;
  const result = spawnSync(pythonPath(), ["-c", script], {
    cwd: repoRoot,
    input: JSON.stringify({ pairs }),
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024
  });
  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) {
    parsed = { ok: false, error: `image compare output parse failed: ${error.message}`, stdout: tail(result.stdout) };
  }
  return {
    command: `${pythonPath()} -c <image-compare>`,
    exitCode: result.status ?? (result.signal ? 128 : 1),
    stderr: tail(result.stderr, 2000),
    parsed
  };
}

export function hexToRgb(hex) {
  const match = /^#?([a-f0-9]{6})$/i.exec(String(hex ?? ""));
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function rgbDistance(left, right) {
  return Math.max(
    Math.abs(left[0] - right[0]),
    Math.abs(left[1] - right[1]),
    Math.abs(left[2] - right[2])
  );
}

export function normalizeOcrText(value) {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .replace(/[^\p{Letter}\p{Number}]/gu, "")
    .toLowerCase();
}

export function sceneWhitelist(scene) {
  const values = [
    scene.sceneId,
    scene.mood,
    scene.layout,
    scene.headline,
    scene.narration,
    scene.narration_tts,
    scene.visual_kind,
    ...(scene.items ?? []),
    ...(scene.values ?? []).map((value) => String(value)),
    scene.unit,
    scene.source,
    "chart data source unit vs bar pie line list numbered statistic compare quote 항목"
  ].filter(Boolean);
  return normalizeOcrText(values.join(" "));
}

export function positiveTerms(scene) {
  return [
    scene.headline,
    ...(scene.items ?? []).slice(0, 2),
    scene.narration?.split(/\s+/).slice(0, 3).join("")
  ]
    .map(normalizeOcrText)
    .filter((term) => term.length >= 2);
}

export async function measureSubtitleBboxes(buildDir, scenes) {
  const executablePath = browserExecutablePath();
  const browser = await puppeteer.launch({
    executablePath,
    headless: "shell",
    args: [
      "--allow-file-access-from-files",
      "--disable-web-security",
      "--disable-gpu",
      "--no-sandbox",
      "--font-render-hinting=none"
    ]
  });
  const rows = [];
  try {
    for (const scene of scenes) {
      const page = await browser.newPage();
      await page.setViewport({ width: frameWidth, height: frameHeight, deviceScaleFactor: 1 });
      const htmlPath = path.join(buildDir, "scenes", `scene-${scene.sceneId}.html`);
      await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "domcontentloaded", timeout: 120000 });
      const measured = await page.evaluate((sceneId) => {
        const el = document.querySelector(`#${sceneId}-subtitles`);
        if (!el) return { sceneId, exists: false };
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return {
          sceneId,
          exists: true,
          text: el.textContent,
          rect: {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height
          },
          style: {
            display: style.display,
            visibility: style.visibility,
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            backgroundColor: style.backgroundColor
          }
        };
      }, scene.sceneId);
      rows.push(measured);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  return { executablePath, rows };
}

function browserExecutablePath() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    path.join(homedir(), ".cache", "ms-playwright", "chromium_headless_shell-1228", "chrome-headless-shell-linux64", "chrome-headless-shell"),
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome"
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("no Chromium executable found for DOM bbox measurement");
  return found;
}

export function optionValue(args, optionName) {
  const index = args.indexOf(optionName);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${optionName} requires a value`);
  return value;
}

export async function main(runGate) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const profile = optionValue(args, "--profile") ?? "fast";
  let result;
  try {
    result = await runGate({ profile });
  } catch (error) {
    result = {
      checks: [
        check(false, "p5-gate-runner-error", {
          error: error instanceof Error ? error.stack ?? error.message : String(error)
        })
      ],
      inputSet: [],
      evidence: []
    };
  }

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const item of result.checks ?? []) {
      console.log(`${item.id}: ${item.pass ? "PASS" : "FAIL"}`);
    }
  }

  if (!Array.isArray(result.checks) || result.checks.length === 0 || result.checks.some((item) => item.pass !== true)) {
    process.exitCode = 1;
  }
}

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const fps = 30;

export function normalizeRelPath(value) {
  return value.split(path.sep).join("/");
}

export function repoRel(filePath) {
  return normalizeRelPath(path.relative(repoRoot, filePath));
}

export function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sha256File(filePath) {
  return sha256Bytes(readFileSync(filePath));
}

export function listFilesRecursive(dir) {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFilesRecursive(next));
    else if (entry.isFile()) files.push(next);
  }
  return files;
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

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    maxBuffer: options.maxBuffer ?? 256 * 1024 * 1024,
    env: {
      ...process.env,
      ...(options.env ?? {})
    }
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

export function assertPass(condition, message, measured = {}) {
  return {
    pass: Boolean(condition),
    measured: condition ? measured : { ...measured, error: message }
  };
}

export function resetDir(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
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
  const projectRel = repoRel(projectDir);
  const result = run(process.execPath, ["bin/vf", "compile", projectRel, "--json"]);
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

export function frameCount(seconds, frameRate = fps) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) throw new Error(`invalid duration: ${seconds}`);
  return Math.ceil(value * frameRate);
}

export function secondsFromFrames(frames, frameRate = fps) {
  if (frames === 0) return 0;
  return Math.max(0, frames / frameRate - 1e-9);
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

export function renderBuild(buildDir, outputPath, extraArgs = []) {
  const hyperframesBin = path.join(repoRoot, "node_modules", ".bin", "hyperframes");
  ensureDir(path.dirname(outputPath));
  rmSync(outputPath, { force: true });
  return run(hyperframesBin, [
    "render",
    buildDir,
    ...extraArgs,
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
}

export function framemd5(inputPath, outputPath, filters = []) {
  ensureDir(path.dirname(outputPath));
  rmSync(outputPath, { force: true });
  const args = ["-v", "error", "-i", inputPath, "-an"];
  if (filters.length > 0) args.push("-vf", filters.join(","));
  args.push("-f", "framemd5", outputPath);
  return run("ffmpeg", args);
}

export function parseFrameMd5(filePath) {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const parts = line.split(",").map((part) => part.trim());
      return {
        raw: line,
        streamIndex: Number.parseInt(parts[0], 10),
        dts: Number.parseInt(parts[1], 10),
        pts: Number.parseInt(parts[2], 10),
        duration: Number.parseInt(parts[3], 10),
        size: Number.parseInt(parts[4], 10),
        hash: parts[5] ?? ""
      };
    });
}

export function compareFrameMd5(leftPath, rightPath) {
  const left = parseFrameMd5(leftPath);
  const right = parseFrameMd5(rightPath);
  const min = Math.min(left.length, right.length);
  const mismatches = [];
  let ptsMismatchCount = 0;
  for (let index = 0; index < min; index += 1) {
    if (left[index].pts !== right[index].pts) ptsMismatchCount += 1;
    if (left[index].hash !== right[index].hash) {
      mismatches.push({
        index,
        leftPts: left[index].pts,
        rightPts: right[index].pts,
        leftHash: left[index].hash,
        rightHash: right[index].hash
      });
    }
  }
  return {
    pass: left.length > 0 && left.length === right.length && mismatches.length === 0,
    measured: {
      leftFrameCount: left.length,
      rightFrameCount: right.length,
      minComparedFrames: min,
      mismatchedFrameCount: mismatches.length,
      ptsMismatchCount,
      lengthMismatch: left.length !== right.length,
      firstMismatch: mismatches[0] ?? null,
      firstMismatches: mismatches.slice(0, 8)
    }
  };
}

export function comparePsnrWindows(leftPath, rightPath, { leftFilter, rightFilter, minPsnr = 44 } = {}) {
  const norm = (f) => (f ? `${f},setpts=N/FRAME_RATE/TB` : "setpts=N/FRAME_RATE/TB");
  const lavfi = `[0:v]${norm(leftFilter)}[a];[1:v]${norm(rightFilter)}[b];[a][b]psnr`;
  const result = run("ffmpeg", ["-v", "info", "-i", leftPath, "-i", rightPath, "-lavfi", lavfi, "-f", "null", "-"]);
  const text = `${result.stderr ?? ""}\n${result.stdout ?? ""}`;
  const match = text.match(/PSNR.*?average:(inf|[\d.]+)/);
  const average = match ? (match[1] === "inf" ? Infinity : Number.parseFloat(match[1])) : null;
  return {
    pass: average !== null && average >= minPsnr,
    measured: {
      averagePsnr: average === Infinity ? "inf" : average,
      minPsnr,
      parsed: Boolean(match),
      note: "lossy-encode tolerant comparison; md5 kept as informational"
    }
  };
}

export function copyFileEnsured(source, target) {
  ensureDir(path.dirname(target));
  copyFileSync(source, target);
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
        {
          id: "gate-wrapper-error",
          pass: false,
          measured: { error: error instanceof Error ? error.message : String(error) }
        }
      ],
      inputSet: [repoRel(fileURLToPath(import.meta.url))],
      evidence: []
    };
  }

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const check of result.checks ?? []) {
      console.log(`${check.id}: ${check.pass ? "PASS" : "FAIL"}`);
    }
  }

  if (!Array.isArray(result.checks) || result.checks.length === 0 || result.checks.some((check) => check.pass !== true)) {
    process.exitCode = 1;
  }
}

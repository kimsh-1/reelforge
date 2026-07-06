#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const fixtureDir = path.join(root, "fixtures", "p0b");
const outDir = path.join(root, "out");
const reportPath = path.join(root, "reports", "P0b-report.json");
const hf = process.env.HYPERFRAMES_BIN ?? path.join(".", "node_modules", ".bin", "hyperframes");
const startedAt = new Date().toISOString();
const command = ["node", ...process.argv.slice(1)].join(" ");

const outputs = {
  fullMp4: "out/p0b-full.mp4",
  scene2Mp4: "out/p0b-scene2.mp4",
  orphanMp4: "out/p0b-orphan.mp4",
  fullScene2Md5: "out/p0b-full-scene2.framemd5",
  scene2Md5: "out/p0b-scene2.framemd5",
  psnrLog: "out/p0b-psnr.log"
};

function tail(value, max = 12000) {
  if (!value) return "";
  return value.length > max ? value.slice(value.length - max) : value;
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function listFilesRecursive(dir) {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function hashInputDir(dir) {
  const files = listFilesRecursive(dir);
  const hash = createHash("sha256");
  for (const file of files) {
    const rel = path.relative(dir, file).split(path.sep).join("/");
    const bytes = readFileSync(file);
    hash.update(rel);
    hash.update("\0");
    hash.update(String(bytes.length));
    hash.update("\0");
    hash.update(bytes);
    hash.update("\0");
  }
  return hash.digest("hex");
}

function relPath(filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function evidence(paths) {
  return paths
    .filter((entryPath) => existsSync(path.join(root, entryPath)))
    .map((entryPath) => ({
      path: entryPath,
      bytes: statSync(path.join(root, entryPath)).size,
      sha256: sha256File(path.join(root, entryPath))
    }));
}

function run(args, options = {}) {
  const runStartedAt = new Date().toISOString();
  const result = spawnSync(args[0], args.slice(1), {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  const exitCode = result.status ?? (result.signal ? 128 : 1);
  return {
    command: args.join(" "),
    exitCode,
    signal: result.signal ?? null,
    error: result.error?.message ?? null,
    stdout: tail(result.stdout ?? ""),
    stderr: tail(result.stderr ?? ""),
    startedAt: runStartedAt,
    finishedAt: new Date().toISOString()
  };
}

function parseMaybeJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function probeMp4(fileRel, expectedDuration) {
  const filePath = path.join(root, fileRel);
  if (!existsSync(filePath) || statSync(filePath).size === 0) {
    return { pass: false, measured: { path: fileRel, error: "missing or empty" } };
  }

  const result = run([
    "ffprobe",
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
  const parsed = parseMaybeJson(result.stdout);
  const duration = Number.parseFloat(parsed?.format?.duration ?? "NaN");
  const streams = Array.isArray(parsed?.streams) ? parsed.streams : [];
  const video = streams.find((stream) => stream.codec_type === "video") ?? null;
  const pass =
    result.exitCode === 0 &&
    existsSync(filePath) &&
    statSync(filePath).size > 0 &&
    Number.isFinite(duration) &&
    Math.abs(duration - expectedDuration) <= 0.3;

  return {
    pass,
    measured: {
      path: fileRel,
      bytes: statSync(filePath).size,
      expectedDuration,
      duration,
      durationToleranceSec: 0.3,
      codec: video?.codec_name ?? null,
      pix_fmt: video?.pix_fmt ?? null,
      streams,
      ffprobe: { command: result.command, exitCode: result.exitCode, stderr: result.stderr }
    }
  };
}

function attrsFromTag(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/([A-Za-z0-9:-]+)="([^"]*)"/g)) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readHostAttrs(indexHtml, src) {
  const re = new RegExp(`<[^>]*\\bdata-composition-src="${escapeRegExp(src)}"[^>]*>`, "s");
  const match = indexHtml.match(re);
  return match ? attrsFromTag(match[0]) : null;
}

function inspectSceneContract(sceneFile) {
  const indexHtml = readFileSync(path.join(fixtureDir, "index.html"), "utf8");
  const sceneHtml = readFileSync(path.join(fixtureDir, sceneFile), "utf8");
  const host = readHostAttrs(indexHtml, sceneFile);
  const internalIds = [...sceneHtml.matchAll(/data-composition-id="([^"]+)"/g)].map((match) => match[1]);
  const timelineKeys = [...sceneHtml.matchAll(/__timelines\s*\[\s*["']([^"']+)["']\s*\]/g)].map((match) => match[1]);
  const templateStart = sceneHtml.indexOf("<template");
  const templateEnd = sceneHtml.indexOf("</template>");
  const templateHtml = templateStart >= 0 && templateEnd > templateStart ? sceneHtml.slice(templateStart, templateEnd) : "";
  const rootTag = sceneHtml.match(/<div[^>]*\bdata-composition-id="[^"]+"[^>]*>/s)?.[0] ?? "";

  const idTripleMatches =
    host?.["data-composition-id"] !== undefined &&
    internalIds.length >= 1 &&
    timelineKeys.length >= 1 &&
    internalIds.every((id) => id === host["data-composition-id"]) &&
    timelineKeys.every((id) => id === host["data-composition-id"]);
  const transportInsideTemplate =
    templateStart >= 0 &&
    templateEnd > templateStart &&
    templateHtml.includes("<style") &&
    templateHtml.includes("<script");
  const noRootBackground = !/\bbackground\s*:/.test(rootTag) && !/\bbackground-color\s*:/.test(rootTag);

  return {
    sceneFile,
    pass: Boolean(idTripleMatches && transportInsideTemplate && noRootBackground),
    hostCompositionId: host?.["data-composition-id"] ?? null,
    internalCompositionIds: internalIds,
    timelineKeys,
    hostStart: host?.["data-start"] ?? null,
    hostDuration: host?.["data-duration"] ?? null,
    templateTransportOk: transportInsideTemplate,
    dualModeStandaloneRoot: sceneHtml.trimStart().startsWith("<!doctype html>"),
    rootHasInlineBackground: !noRootBackground,
    usesGsapFromTo: sceneHtml.includes(".fromTo(")
  };
}

function sourceAnalysis() {
  const scenes = ["scenes/scene-01.html", "scenes/scene-02.html", "scenes/scene-03.html"].map(inspectSceneContract);
  const scene2 = scenes.find((scene) => scene.sceneFile === "scenes/scene-02.html");
  return {
    pass: scenes.every((scene) => scene.pass),
    measured: {
      scenes,
      mismatchCandidateChecks: {
        timingOffset: {
          hostStart: scene2?.hostStart ?? null,
          hostDuration: scene2?.hostDuration ?? null,
          sceneDuration: scene2?.hostDuration ?? null,
          note: "scene2 host window is 5.0s..10.0s and the sub-composition duration is 5s"
        },
        backgroundInheritance: {
          rootHasInlineBackground: scene2?.rootHasInlineBackground ?? null,
          note: "scene fill is on a full-bleed child, not the composition root"
        },
        warmupTick: {
          usesGsapFromTo: scene2?.usesGsapFromTo ?? null,
          note: "entrance tween declares from/to states synchronously and registers one paused timeline"
        },
        dualModeRendering: {
          standaloneRootPresent: scene2?.dualModeStandaloneRoot ?? null,
          note: "scene file has a standalone body root for --composition and a template payload for index.html mounting"
        }
      }
    }
  };
}

function parseFrameMd5(fileRel) {
  const filePath = path.join(root, fileRel);
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

function bestHashOffset(fullFrames, sceneFrames) {
  let best = { offset: 0, matches: 0, compared: 0 };
  for (let offset = -3; offset <= 3; offset += 1) {
    let matches = 0;
    let compared = 0;
    for (let fullIndex = 0; fullIndex < fullFrames.length; fullIndex += 1) {
      const sceneIndex = fullIndex + offset;
      if (sceneIndex < 0 || sceneIndex >= sceneFrames.length) continue;
      compared += 1;
      if (fullFrames[fullIndex].hash === sceneFrames[sceneIndex].hash) matches += 1;
    }
    if (matches > best.matches) best = { offset, matches, compared };
  }
  return best;
}

function compareFrameMd5(fullRel, sceneRel) {
  const fullFrames = parseFrameMd5(fullRel);
  const sceneFrames = parseFrameMd5(sceneRel);
  const minFrames = Math.min(fullFrames.length, sceneFrames.length);
  const mismatches = [];
  let ptsMismatchCount = 0;
  for (let index = 0; index < minFrames; index += 1) {
    if (fullFrames[index].pts !== sceneFrames[index].pts) ptsMismatchCount += 1;
    if (fullFrames[index].hash !== sceneFrames[index].hash) {
      mismatches.push({
        index,
        fullPts: fullFrames[index].pts,
        scenePts: sceneFrames[index].pts,
        fullHash: fullFrames[index].hash,
        sceneHash: sceneFrames[index].hash
      });
    }
  }
  const lengthMismatch = fullFrames.length !== sceneFrames.length;
  const pass = fullFrames.length > 0 && !lengthMismatch && mismatches.length === 0;
  const prefixMismatchCount = mismatches.findIndex((entry, expected) => entry.index !== expected);
  const consecutivePrefix = prefixMismatchCount === -1 ? mismatches.length : prefixMismatchCount;
  const pattern =
    mismatches.length === 0 && !lengthMismatch
      ? "all frame hashes match"
      : mismatches.length === minFrames && minFrames > 0
        ? "all compared frames differ"
        : consecutivePrefix > 0 && consecutivePrefix === mismatches.length
          ? `first ${consecutivePrefix} frame(s) differ only`
          : "non-contiguous or mid-stream frame differences";

  return {
    pass,
    measured: {
      comparedWindow: "full render trim 5.0s..10.0s vs scene2 trim 0.0s..5.0s",
      fullFrameCount: fullFrames.length,
      sceneFrameCount: sceneFrames.length,
      minComparedFrames: minFrames,
      mismatchedFrameCount: mismatches.length,
      ptsMismatchCount,
      lengthMismatch,
      pattern,
      firstMismatch: mismatches[0] ?? null,
      firstMismatches: mismatches.slice(0, 8),
      bestOffset: bestHashOffset(fullFrames, sceneFrames)
    }
  };
}

function runPsnrIfNeeded(frameCompare) {
  if (frameCompare.pass) {
    return { skipped: true, reason: "framemd5 hashes match exactly" };
  }
  const fullPath = path.join(root, outputs.fullMp4);
  const scenePath = path.join(root, outputs.scene2Mp4);
  if (!existsSync(fullPath) || !existsSync(scenePath)) {
    return { skipped: true, reason: "one or both MP4 files missing" };
  }
  const result = run([
    "ffmpeg",
    "-v",
    "info",
    "-i",
    fullPath,
    "-i",
    scenePath,
    "-filter_complex",
    `[0:v]trim=start=5:end=10,setpts=PTS-STARTPTS,format=yuv420p[full];[1:v]trim=start=0:end=5,setpts=PTS-STARTPTS,format=yuv420p[scene];[full][scene]psnr=stats_file=${path.join(root, outputs.psnrLog)}`,
    "-f",
    "null",
    "-"
  ]);
  const averageMatch = result.stderr.match(/average:([0-9.inf]+)/);
  return {
    skipped: false,
    command: result.command,
    exitCode: result.exitCode,
    stderr: result.stderr,
    averagePsnr: averageMatch?.[1] ?? null,
    statsPath: existsSync(path.join(root, outputs.psnrLog)) ? outputs.psnrLog : null
  };
}

function renderArgs(extraArgs, outputRel) {
  return [
    hf,
    "render",
    "fixtures/p0b",
    ...extraArgs,
    "--output",
    path.join(root, outputRel),
    "--fps=30",
    "--quality=high",
    "--crf=0",
    "--workers=1",
    "--no-browser-gpu",
    "--browser-timeout=120",
    "--player-ready-timeout=120000"
  ];
}

let checks = [];
let exitCode = 1;

try {
  mkdirSync(outDir, { recursive: true });
  mkdirSync(path.dirname(reportPath), { recursive: true });
  for (const output of Object.values(outputs)) {
    rmSync(path.join(root, output), { force: true });
  }

  const contract = sourceAnalysis();
  const lint = run([hf, "lint", "fixtures/p0b", "--json"]);
  const validate = run([hf, "validate", "fixtures/p0b", "--json", "--timeout=10000"]);
  const fullRender = run(renderArgs([], outputs.fullMp4));
  const fullProbe = probeMp4(outputs.fullMp4, 15);
  const scene2Render = run(renderArgs(["--composition", "scenes/scene-02.html"], outputs.scene2Mp4));
  const scene2Probe = probeMp4(outputs.scene2Mp4, 5);
  const negativeRender = run(renderArgs(["--composition", "scenes/orphan.html"], outputs.orphanMp4));

  const fullMd5 = run([
    "ffmpeg",
    "-v",
    "error",
    "-i",
    path.join(root, outputs.fullMp4),
    "-an",
    "-vf",
    "trim=start=5:end=10,setpts=PTS-STARTPTS,format=rgb24",
    "-f",
    "framemd5",
    path.join(root, outputs.fullScene2Md5)
  ]);
  const scene2Md5 = run([
    "ffmpeg",
    "-v",
    "error",
    "-i",
    path.join(root, outputs.scene2Mp4),
    "-an",
    "-vf",
    "trim=start=0:end=5,setpts=PTS-STARTPTS,format=rgb24",
    "-f",
    "framemd5",
    path.join(root, outputs.scene2Md5)
  ]);
  const frameCompare = compareFrameMd5(outputs.fullScene2Md5, outputs.scene2Md5);
  frameCompare.measured.pixelDiff = runPsnrIfNeeded(frameCompare);
  frameCompare.measured.sourceLevelChecks = contract.measured.mismatchCandidateChecks;

  checks = [
    { id: "source-contract", pass: contract.pass, measured: contract.measured },
    {
      id: "hyperframes-lint",
      pass: lint.exitCode === 0,
      measured: { ...lint, parsed: parseMaybeJson(lint.stdout) }
    },
    {
      id: "hyperframes-validate",
      pass: validate.exitCode === 0,
      measured: { ...validate, parsed: parseMaybeJson(validate.stdout) }
    },
    {
      id: "full-render-15s",
      pass: fullRender.exitCode === 0 && fullProbe.pass,
      measured: { render: fullRender, probe: fullProbe.measured }
    },
    {
      id: "scene2-render-5s",
      pass: scene2Render.exitCode === 0 && scene2Probe.pass,
      measured: { render: scene2Render, probe: scene2Probe.measured }
    },
    {
      id: "orphan-render-success-explicit",
      pass: negativeRender.exitCode === 0,
      measured: {
        ...negativeRender,
        expectedExitCode: 0,
        expectedBehavior: "orphan sub-composition renders successfully in hyperframes 0.7.26; mount enforcement belongs to video-factory lint",
        matchedExpectedBehavior: negativeRender.exitCode === 0,
        actualBehavior:
          negativeRender.exitCode === 0
            ? "orphan sub-composition rendered successfully; mount enforcement was not applied"
            : "orphan sub-composition render failed; mount enforcement is active"
      }
    },
    {
      id: "framemd5-extract",
      pass: fullMd5.exitCode === 0 && scene2Md5.exitCode === 0,
      measured: { fullScene2: fullMd5, scene2: scene2Md5 }
    },
    {
      id: "body-frame-match",
      pass: frameCompare.pass,
      measured: frameCompare.measured
    }
  ];

  const pass = checks.every((check) => check.pass === true);
  exitCode = pass ? 0 : 1;

  const report = {
    gate: "P0b",
    pass,
    checks,
    inputHash: hashInputDir(fixtureDir),
    evidence: evidence([
      outputs.fullMp4,
      outputs.scene2Mp4,
      outputs.orphanMp4,
      outputs.fullScene2Md5,
      outputs.scene2Md5,
      outputs.psnrLog,
      "scripts/gate-p0b.mjs"
    ]),
    command,
    exitCode,
    startedAt,
    finishedAt: new Date().toISOString()
  };

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  const failedReport = {
    gate: "P0b",
    pass: false,
    checks: [
      ...checks,
      {
        id: "gate-runner-error",
        pass: false,
        measured: { error: error instanceof Error ? error.message : String(error) }
      }
    ],
    inputHash: existsSync(fixtureDir) ? hashInputDir(fixtureDir) : null,
    evidence: evidence([
      outputs.fullMp4,
      outputs.scene2Mp4,
      outputs.orphanMp4,
      outputs.fullScene2Md5,
      outputs.scene2Md5,
      "scripts/gate-p0b.mjs"
    ]),
    command,
    exitCode,
    startedAt,
    finishedAt: new Date().toISOString()
  };
  writeFileSync(reportPath, `${JSON.stringify(failedReport, null, 2)}\n`);
}

process.exitCode = exitCode;

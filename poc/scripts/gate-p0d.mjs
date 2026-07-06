#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync
} from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";

const root = process.cwd();
const fixtureDir = path.join(root, "fixtures", "p0d");
const reportPath = path.join(root, "reports", "P0d-report.json");
const hf = process.env.HYPERFRAMES_BIN ?? path.join(".", "node_modules", ".bin", "hyperframes");
const startedAt = new Date().toISOString();
const command = ["node", ...process.argv.slice(1)].join(" ");
const fps = 30;
const oneFrame = 1 / fps;

const baseSpecs = {
  scenes: [
    {
      sceneId: "s01",
      narration: "첫 번째 장면은 편집 루프의 기준점입니다. 이 구간은 이후 렌더에서도 변하지 않아야 합니다.",
      headline: "기준 장면",
      bgColor: "#1b4d5c"
    },
    {
      sceneId: "s02",
      narration: "두 번째 장면의 나레이션을 고치면 이 씬만 다시 합성합니다.",
      headline: "편집 대상",
      bgColor: "#6d3f8c"
    },
    {
      sceneId: "s03",
      narration: "세 번째 장면은 내용은 그대로 유지하고 시작 시각만 뒤로 밀려야 합니다.",
      headline: "시프트 확인",
      bgColor: "#4c6b2f"
    }
  ],
  transitions: [{ from: "s01", to: "s02", type: "crossfade", duration: 0.5 }]
};

const editedNarration =
  "두 번째 장면의 나레이션을 더 길게 고칩니다. 이 변경은 sourceHash를 바꾸고, 두 번째 씬만 다시 합성해야 합니다. 전체 컴파일은 뒤따르는 세 번째 씬의 시작 시각을 새 길이에 맞춰 뒤로 이동시킵니다.";

const outputs = {
  v1: "out/p0d-v1.mp4",
  v2: "out/p0d-v2.mp4",
  scene1V1: "out/p0d-scene1-v1.framemd5",
  scene1V2: "out/p0d-scene1-v2.framemd5",
  scene3V1: "out/p0d-scene3-v1.framemd5",
  scene3V2: "out/p0d-scene3-v2.framemd5"
};

function tail(value, max = 12000) {
  if (!value) return "";
  return value.length > max ? value.slice(value.length - max) : value;
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function listFilesRecursive(dir) {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFilesRecursive(fullPath));
    else if (entry.isFile()) files.push(fullPath);
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

function evidence(paths) {
  const entries = [];
  for (const entryPath of paths) {
    const fullPath = path.join(root, entryPath);
    if (!existsSync(fullPath)) continue;
    if (statSync(fullPath).isDirectory()) {
      for (const file of listFilesRecursive(fullPath)) {
        entries.push({
          path: path.relative(root, file).split(path.sep).join("/"),
          bytes: statSync(file).size,
          sha256: sha256File(file)
        });
      }
    } else {
      entries.push({ path: entryPath, bytes: statSync(fullPath).size, sha256: sha256File(fullPath) });
    }
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

function readJson(relPath) {
  return JSON.parse(readFileSync(path.join(root, relPath), "utf8"));
}

function writeJson(relPath, value) {
  writeFileSync(path.join(root, relPath), `${JSON.stringify(value, null, 2)}\n`);
}

function run(args, options = {}) {
  const runStartedAt = new Date().toISOString();
  const result = spawnSync(args[0], args.slice(1), {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024
  });
  return {
    command: args.join(" "),
    exitCode: result.status ?? (result.signal ? 128 : 1),
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

function renderArgs(outputRel) {
  return [
    hf,
    "render",
    "fixtures/p0d",
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

function probeMp4(fileRel) {
  const filePath = path.join(root, fileRel);
  if (!existsSync(filePath) || statSync(filePath).size === 0) {
    return { pass: false, measured: { path: fileRel, error: "missing or empty" } };
  }
  const result = run([
    "ffprobe",
    "-v",
    "error",
    "-show_entries",
    "stream=index,codec_type,codec_name,pix_fmt,duration,nb_frames",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    filePath
  ]);
  const parsed = parseMaybeJson(result.stdout);
  const streams = Array.isArray(parsed?.streams) ? parsed.streams : [];
  const video = streams.find((stream) => stream.codec_type === "video") ?? null;
  const audioTracks = streams.filter((stream) => stream.codec_type === "audio");
  const videoDuration = Number.parseFloat(video?.duration ?? parsed?.format?.duration ?? "NaN");
  const frameCount = Number.parseInt(video?.nb_frames ?? "0", 10);
  return {
    pass: result.exitCode === 0 && streams.length > 0 && audioTracks.length > 0 && Number.isFinite(videoDuration),
    measured: {
      path: fileRel,
      bytes: statSync(filePath).size,
      formatDurationSec: Number.parseFloat(parsed?.format?.duration ?? "NaN"),
      videoDurationSec: Number.isFinite(videoDuration) ? videoDuration : null,
      videoFrames: Number.isFinite(frameCount) ? frameCount : null,
      hasAudioTrack: audioTracks.length > 0,
      audioTrackCount: audioTracks.length,
      videoCodec: video?.codec_name ?? null,
      pixFmt: video?.pix_fmt ?? null,
      streams,
      ffprobe: { command: result.command, exitCode: result.exitCode, stderr: result.stderr }
    }
  };
}

function extractFrameMd5(inputRel, outputRel, startSec, durationSec) {
  return run([
    "ffmpeg",
    "-v",
    "error",
    "-i",
    path.join(root, inputRel),
    "-an",
    "-vf",
    `trim=start=${startSec}:duration=${durationSec},setpts=PTS-STARTPTS,format=rgb24`,
    "-f",
    "framemd5",
    path.join(root, outputRel)
  ]);
}

function parseFrameMd5(relPath) {
  const filePath = path.join(root, relPath);
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const parts = line.split(",").map((part) => part.trim());
      return {
        pts: Number.parseInt(parts[2], 10),
        duration: Number.parseInt(parts[3], 10),
        size: Number.parseInt(parts[4], 10),
        hash: parts[5] ?? ""
      };
    });
}

function compareMd5(aRel, bRel) {
  const a = parseFrameMd5(aRel);
  const b = parseFrameMd5(bRel);
  const min = Math.min(a.length, b.length);
  const mismatches = [];
  for (let index = 0; index < min; index += 1) {
    if (a[index].hash !== b[index].hash) {
      mismatches.push({ index, a: a[index].hash, b: b[index].hash });
      if (mismatches.length >= 8) break;
    }
  }
  return {
    pass: a.length > 0 && a.length === b.length && mismatches.length === 0,
    measured: {
      frameCountA: a.length,
      frameCountB: b.length,
      mismatchedFrameCount: mismatches.length,
      firstMismatches: mismatches
    }
  };
}

function frameHashAt(inputRel, frameIndex) {
  const result = run([
    "ffmpeg",
    "-v",
    "error",
    "-i",
    path.join(root, inputRel),
    "-an",
    "-vf",
    `select=eq(n\\,${frameIndex}),format=rgb24`,
    "-frames:v",
    "1",
    "-f",
    "md5",
    "-"
  ]);
  const match = result.stdout.match(/MD5=([a-f0-9]+)/i);
  return { hash: match?.[1] ?? null, command: result.command, exitCode: result.exitCode, stderr: result.stderr };
}

function expectedTotal(manifest) {
  const sumFrames = manifest.scenes.reduce((sum, scene) => sum + scene.durationFrames, 0);
  const overlapFrames = manifest.transitions.reduce((sum, transition) => sum + transition.durationFrames, 0);
  return { frames: sumFrames - overlapFrames, seconds: (sumFrames - overlapFrames) / fps, sumFrames, overlapFrames };
}

function checkDuration(manifest, probe) {
  const expected = expectedTotal(manifest);
  const actualFrames = probe.measured.videoFrames;
  const actualDuration = probe.measured.videoDurationSec;
  const frameDelta = Number.isInteger(actualFrames)
    ? Math.abs(actualFrames - expected.frames)
    : Number.isFinite(actualDuration)
      ? Math.abs(actualDuration - expected.seconds) * fps
      : Infinity;
  return { pass: frameDelta <= 1, measured: { expected, actualFrames, actualDuration, frameDelta } };
}

function mtimeMs(sceneId) {
  return statSync(path.join(fixtureDir, "audio", `${sceneId}.mp3`)).mtimeMs;
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function httpGet(port, pathname, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port, path: pathname, timeout: timeoutMs }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
        if (body.length > 200000) body = body.slice(-200000);
      });
      res.on("end", () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
    });
    req.on("timeout", () => {
      req.destroy(new Error(`GET ${pathname} timed out`));
    });
    req.on("error", reject);
  });
}

async function waitForHttp(port, pathname, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await httpGet(port, pathname, 4000);
      if (response.statusCode && response.statusCode < 500) return response;
      lastError = new Error(`status ${response.statusCode}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw lastError ?? new Error(`GET ${pathname} did not become ready`);
}

function waitForSseEvent(port, touchRelPath, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      {
        host: "127.0.0.1",
        port,
        path: "/api/events",
        headers: { Accept: "text/event-stream" },
        timeout: timeoutMs
      },
      (res) => {
        let buffer = "";
        const timer = setTimeout(() => {
          req.destroy();
          reject(new Error("SSE event timeout"));
        }, timeoutMs);
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          buffer += chunk;
          const events = buffer.split(/\n\n/);
          buffer = events.pop() ?? "";
          for (const eventText of events) {
            if (!eventText.includes("file-change")) continue;
            clearTimeout(timer);
            req.destroy();
            resolve({ statusCode: res.statusCode, eventText });
            return;
          }
        });
        setTimeout(() => {
          const filePath = path.join(root, touchRelPath);
          const now = new Date();
          utimesSync(filePath, now, now);
        }, 800);
      }
    );
    req.on("timeout", () => {
      req.destroy(new Error("SSE request timed out"));
    });
    req.on("error", (error) => {
      if (error.code === "ECONNRESET") return;
      reject(error);
    });
  });
}

async function studioPreviewSse() {
  const port = await getFreePort();
  const child = spawn(hf, ["preview", "fixtures/p0d", "--port", String(port), "--no-open", "--force-new"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
    stdout = tail(stdout);
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
    stderr = tail(stderr);
  });

  try {
    await waitForHttp(port, "/__hyperframes_config");
    const preview = await httpGet(port, "/api/projects/p0d/preview");
    const file = await httpGet(port, "/api/projects/p0d/files/scene_specs.json");
    const sse = await waitForSseEvent(port, "fixtures/p0d/scene_specs.json");
    return {
      pass: preview.statusCode === 200 && file.statusCode === 200 && sse.statusCode === 200,
      measured: {
        port,
        previewStatus: preview.statusCode,
        fileStatus: file.statusCode,
        sseStatus: sse.statusCode,
        sseEvent: sse.eventText,
        stdout,
        stderr
      }
    };
  } catch (error) {
    return {
      pass: false,
      measured: {
        port,
        error: error instanceof Error ? error.message : String(error),
        stdout,
        stderr
      }
    };
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 3000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}

let checks = [];
let exitCode = 1;

try {
  mkdirSync(path.join(root, "out"), { recursive: true });
  mkdirSync(path.dirname(reportPath), { recursive: true });
  mkdirSync(fixtureDir, { recursive: true });
  for (const output of Object.values(outputs)) rmSync(path.join(root, output), { force: true });
  rmSync(path.join(fixtureDir, "audio_meta.json"), { force: true });
  rmSync(path.join(fixtureDir, "render-manifest.json"), { force: true });
  rmSync(path.join(fixtureDir, "index.html"), { force: true });
  rmSync(path.join(fixtureDir, "audio"), { recursive: true, force: true });
  rmSync(path.join(fixtureDir, "scenes"), { recursive: true, force: true });
  writeJson("fixtures/p0d/scene_specs.json", baseSpecs);

  const compileInitial = run(["node", "scripts/compile-p0d.mjs"]);
  const manifestV1 = readJson("fixtures/p0d/render-manifest.json");
  const metaV1 = readJson("fixtures/p0d/audio_meta.json");
  const lint = run([hf, "lint", "fixtures/p0d", "--json"]);
  const validate = run([hf, "validate", "fixtures/p0d", "--json", "--timeout=10000"]);
  const renderV1 = run(renderArgs(outputs.v1));
  const probeV1 = probeMp4(outputs.v1);
  const durationV1 = checkDuration(manifestV1, probeV1);
  const mtimesBeforeEdit = { s01: mtimeMs("s01"), s02: mtimeMs("s02"), s03: mtimeMs("s03") };

  const editedSpecs = JSON.parse(JSON.stringify(baseSpecs));
  editedSpecs.scenes.find((scene) => scene.sceneId === "s02").narration = editedNarration;
  writeJson("fixtures/p0d/scene_specs.json", editedSpecs);
  const compileEdit = run(["node", "scripts/compile-p0d.mjs"]);
  const manifestV2 = readJson("fixtures/p0d/render-manifest.json");
  const metaV2 = readJson("fixtures/p0d/audio_meta.json");
  const mtimesAfterEdit = { s01: mtimeMs("s01"), s02: mtimeMs("s02"), s03: mtimeMs("s03") };

  const s2V1 = metaV1.scenes.find((scene) => scene.sceneId === "s02");
  const s2V2 = metaV2.scenes.find((scene) => scene.sceneId === "s02");
  const s3StartV1 = manifestV1.scenes.find((scene) => scene.sceneId === "s03").startFrame;
  const s3StartV2 = manifestV2.scenes.find((scene) => scene.sceneId === "s03").startFrame;

  const renderV2 = run(renderArgs(outputs.v2));
  const probeV2 = probeMp4(outputs.v2);
  const durationV2 = checkDuration(manifestV2, probeV2);

  const scene1V1Md5 = extractFrameMd5(outputs.v1, outputs.scene1V1, 0, 4);
  const scene1V2Md5 = extractFrameMd5(outputs.v2, outputs.scene1V2, 0, 4);
  const scene1Compare = compareMd5(outputs.scene1V1, outputs.scene1V2);

  const s3V1 = manifestV1.scenes.find((scene) => scene.sceneId === "s03");
  const s3V2 = manifestV2.scenes.find((scene) => scene.sceneId === "s03");
  const scene3SafeOffsetSec = 1;
  const scene3CompareDuration = Math.min(
    3,
    s3V1.audioDurationSec - scene3SafeOffsetSec - oneFrame,
    s3V2.audioDurationSec - scene3SafeOffsetSec - oneFrame
  );
  const scene3V1Md5 = extractFrameMd5(
    outputs.v1,
    outputs.scene3V1,
    s3V1.startSec + scene3SafeOffsetSec,
    scene3CompareDuration
  );
  const scene3V2Md5 = extractFrameMd5(
    outputs.v2,
    outputs.scene3V2,
    s3V2.startSec + scene3SafeOffsetSec,
    scene3CompareDuration
  );
  const scene3Compare = compareMd5(outputs.scene3V1, outputs.scene3V2);

  const transition = manifestV2.transitions[0];
  const beforeHash = frameHashAt(outputs.v2, transition.startFrame - 1);
  const midHash = frameHashAt(outputs.v2, transition.startFrame + Math.floor(transition.durationFrames / 2));
  const afterHash = frameHashAt(outputs.v2, transition.startFrame + transition.durationFrames + 1);
  const crossfadePass =
    beforeHash.exitCode === 0 &&
    midHash.exitCode === 0 &&
    afterHash.exitCode === 0 &&
    midHash.hash !== null &&
    midHash.hash !== beforeHash.hash &&
    midHash.hash !== afterHash.hash;

  const studio = await studioPreviewSse();

  checks = [
    {
      id: "compile-initial",
      pass:
        compileInitial.exitCode === 0 &&
        lint.exitCode === 0 &&
        validate.exitCode === 0 &&
        metaV1.lastCompile.changedSceneIds.length === 3 &&
        manifestV1.scenes.length === 3,
      measured: {
        compile: { ...compileInitial, parsed: parseMaybeJson(compileInitial.stdout) },
        lint: { ...lint, parsed: parseMaybeJson(lint.stdout) },
        validate: { ...validate, parsed: parseMaybeJson(validate.stdout) },
        durations: manifestV1.scenes.map((scene) => ({
          sceneId: scene.sceneId,
          durationFrames: scene.durationFrames,
          audioDurationSec: scene.audioDurationSec
        }))
      }
    },
    {
      id: "full-render-v1",
      pass: renderV1.exitCode === 0 && probeV1.pass && durationV1.pass,
      measured: { render: renderV1, probe: probeV1.measured, duration: durationV1.measured }
    },
    {
      id: "edit-selective-retts",
      pass:
        compileEdit.exitCode === 0 &&
        metaV2.lastCompile.changedSceneIds.length === 1 &&
        metaV2.lastCompile.changedSceneIds[0] === "s02" &&
        metaV2.lastCompile.reusedSceneIds.includes("s01") &&
        metaV2.lastCompile.reusedSceneIds.includes("s03") &&
        mtimesBeforeEdit.s01 === mtimesAfterEdit.s01 &&
        mtimesBeforeEdit.s03 === mtimesAfterEdit.s03 &&
        mtimesAfterEdit.s02 > mtimesBeforeEdit.s02 &&
        s2V1.sourceHash !== s2V2.sourceHash,
      measured: {
        compile: { ...compileEdit, parsed: parseMaybeJson(compileEdit.stdout) },
        beforeMtimeMs: mtimesBeforeEdit,
        afterMtimeMs: mtimesAfterEdit,
        changedSceneIds: metaV2.lastCompile.changedSceneIds,
        reusedSceneIds: metaV2.lastCompile.reusedSceneIds,
        s2HashBefore: s2V1.sourceHash,
        s2HashAfter: s2V2.sourceHash
      }
    },
    {
      id: "shift-recompile",
      pass: s2V2.durationFrames > s2V1.durationFrames && s3StartV2 > s3StartV1,
      measured: {
        s2DurationFramesBefore: s2V1.durationFrames,
        s2DurationFramesAfter: s2V2.durationFrames,
        s3StartFrameBefore: s3StartV1,
        s3StartFrameAfter: s3StartV2,
        s3ShiftFrames: s3StartV2 - s3StartV1
      }
    },
    {
      id: "v2-render-integrity",
      pass:
        renderV2.exitCode === 0 &&
        probeV2.pass &&
        durationV2.pass &&
        scene1V1Md5.exitCode === 0 &&
        scene1V2Md5.exitCode === 0 &&
        scene1Compare.pass &&
        scene3V1Md5.exitCode === 0 &&
        scene3V2Md5.exitCode === 0 &&
        scene3Compare.pass &&
        crossfadePass,
      measured: {
        render: renderV2,
        probe: probeV2.measured,
        duration: durationV2.measured,
        scene1Invariant: scene1Compare.measured,
        scene3ShiftedContent: {
          ...scene3Compare.measured,
          v1StartSec: s3V1.startSec,
          v2StartSec: s3V2.startSec,
          safeOffsetSec: scene3SafeOffsetSec,
          comparedDurationSec: scene3CompareDuration
        },
        crossfade: {
          pass: crossfadePass,
          transitionStartFrame: transition.startFrame,
          transitionDurationFrames: transition.durationFrames,
          beforeHash,
          midHash,
          afterHash
        }
      }
    },
    { id: "studio-preview-sse", pass: studio.pass, measured: studio.measured }
  ];

  const pass = checks.every((check) => check.pass === true);
  exitCode = pass ? 0 : 1;
  const report = {
    gate: "P0d",
    pass,
    checks,
    inputHash: hashInputDir(fixtureDir),
    evidence: evidence([
      "fixtures/p0d",
      "out/p0d-v1.mp4",
      "out/p0d-v2.mp4",
      "out/p0d-scene1-v1.framemd5",
      "out/p0d-scene1-v2.framemd5",
      "out/p0d-scene3-v1.framemd5",
      "out/p0d-scene3-v2.framemd5",
      "scripts/compile-p0d.mjs",
      "scripts/gate-p0d.mjs",
      "package.json",
      "package-lock.json"
    ]),
    command,
    exitCode,
    startedAt,
    finishedAt: new Date().toISOString()
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  const failedReport = {
    gate: "P0d",
    pass: false,
    checks: [
      ...checks,
      { id: "gate-runner-error", pass: false, measured: { error: error instanceof Error ? error.stack ?? error.message : String(error) } }
    ],
    inputHash: existsSync(fixtureDir) ? hashInputDir(fixtureDir) : null,
    evidence: evidence(["fixtures/p0d", "out/p0d-v1.mp4", "out/p0d-v2.mp4", "scripts/compile-p0d.mjs", "scripts/gate-p0d.mjs"]),
    command,
    exitCode,
    startedAt,
    finishedAt: new Date().toISOString()
  };
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(failedReport, null, 2)}\n`);
}

process.exitCode = exitCode;

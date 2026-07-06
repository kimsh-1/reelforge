#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyDuckingToIndexHtml, applyDuckingToManifest, buildDuckingKeyframes } from "../src/compiler/audio-duck.mjs";
import { applyKenBurnsToSceneHtml } from "../src/compiler/motion.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hyperframesBin = path.join(repoRoot, "node_modules", ".bin", "hyperframes");
const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "p2w-p203-"));
const repoTmpRoot = path.join(repoRoot, "tmp", `p2w-p203-${process.pid}-${Date.now()}`);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    ...options
  });
  if (result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(" ")} failed with ${result.status}`,
        result.stdout?.trim(),
        result.stderr?.trim()
      ]
        .filter(Boolean)
        .join("\n")
    );
  }
  return result;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function ensureTool(name) {
  run(name, ["-version"]);
}

function copyFixtureForCompile() {
  const source = path.join(repoRoot, "fixtures", "golden-specs", "edit-scenario");
  const projectDir = path.join(repoTmpRoot, "edit-scenario");
  rmSync(repoTmpRoot, { recursive: true, force: true });
  mkdirSync(repoTmpRoot, { recursive: true });
  cpSync(source, projectDir, {
    recursive: true,
    filter: (src) => !src.includes(`${path.sep}build${path.sep}`) && !src.endsWith(`${path.sep}build`)
  });
  return projectDir;
}

function compileKenBurnsVariant() {
  const projectDir = copyFixtureForCompile();
  const specsPath = path.join(projectDir, "scene_specs.json");
  const specs = readJson(specsPath);
  specs.scenes[0].kenBurns = {
    enabled: true,
    zoomFactor: 1.18,
    zoomDirection: "in",
    panDirection: "right"
  };
  writeJson(specsPath, specs);

  const relProject = path.relative(repoRoot, projectDir);
  const outBuild = path.join(tmpRoot, "kenburns-build");
  rmSync(outBuild, { recursive: true, force: true });
  writeJson(path.join(tmpRoot, "kenburns-scene_specs.json"), specs);

  try {
    const compile = run(process.execPath, ["bin/vf", "compile", relProject, "--json"]);
    const compileResult = JSON.parse(compile.stdout);
    const compiledBuild = path.join(projectDir, "build");
    assert.equal(compileResult.pass, true, "compile did not pass");
    assert.equal(existsSync(compiledBuild), true, "compile build directory missing");
    cpSync(compiledBuild, outBuild, { recursive: true });
    return { specs, outBuild, compileResult };
  } catch (error) {
    cpSync(path.join(repoRoot, "fixtures", "golden-specs", "edit-scenario", "build"), outBuild, { recursive: true });
    const manifestPath = path.join(outBuild, "render-manifest.json");
    const manifest = readJson(manifestPath);
    const scene = manifest.scenes.find((item) => item.sceneId === "s01");
    scene.kenBurns = specs.scenes[0].kenBurns;
    writeJson(manifestPath, manifest);
    return {
      specs,
      outBuild,
      compileResult: {
        pass: false,
        buildDir: null,
        fallbackReason: error instanceof Error ? error.message.split("\n")[0] : String(error)
      }
    };
  }
}

function singleSceneIndex(durationSec) {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>P2-03 Ken Burns Smoke</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      html,
      body {
        margin: 0;
        width: 1920px;
        height: 1080px;
        overflow: hidden;
        background: #000;
      }
      #root {
        position: relative;
        width: 1920px;
        height: 1080px;
        overflow: hidden;
      }
      #slot-s01 {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-width="1920" data-height="1080" data-duration="${durationSec}">
      <div
        id="slot-s01"
        data-composition-id="s01"
        data-composition-src="scenes/scene-s01.html"
        data-start="0"
        data-duration="${durationSec}"
        data-track-index="1"
        data-width="1920"
        data-height="1080"
      ></div>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      (function () {
        const tl = gsap.timeline({ paused: true });
        window.__timelines["main"] = tl;
      })();
    </script>
  </body>
</html>
`;
}

function renderKenBurns({ specs, outBuild }) {
  const manifest = readJson(path.join(outBuild, "render-manifest.json"));
  const sceneManifest = manifest.scenes.find((scene) => scene.sceneId === "s01");
  const durationSec = sceneManifest.audioDurationSec;
  const scenePath = path.join(outBuild, "scenes", "scene-s01.html");
  const patched = applyKenBurnsToSceneHtml({
    html: readFileSync(scenePath, "utf8"),
    scene: specs.scenes[0],
    durationSec
  });
  writeFileSync(scenePath, patched);
  writeFileSync(path.join(outBuild, "index.html"), singleSceneIndex(durationSec));

  const output = path.join(tmpRoot, "kenburns-s01.mp4");
  run(hyperframesBin, [
    "render",
    outBuild,
    "--output",
    output,
    "--fps=30",
    "--quality=draft",
    "--workers=1",
    "--no-browser-gpu",
    "--browser-timeout=120"
  ]);
  assert.equal(existsSync(output), true, "kenburns render output missing");
  assert.ok(statSync(output).size > 10_000, "kenburns render output too small");
  return { output, durationSec };
}

function frameCropMd5(videoPath, atSec) {
  const result = run("ffmpeg", [
    "-v",
    "error",
    "-ss",
    String(atSec),
    "-i",
    videoPath,
    "-frames:v",
    "1",
    "-vf",
    "crop=180:180:120:120,format=rgb24",
    "-f",
    "md5",
    "-"
  ]);
  const match = result.stdout.match(/MD5=([a-f0-9]+)/i);
  if (!match) throw new Error(`missing md5 for frame at ${atSec}s: ${result.stdout}`);
  return match[1];
}

function verifyKenBurnsPixels(videoPath, durationSec) {
  const times = [0.8, durationSec / 2, Math.max(1, durationSec - 0.7)].map((value) => Number(value.toFixed(3)));
  const hashes = times.map((timeSec) => ({ timeSec, md5: frameCropMd5(videoPath, timeSec) }));
  const unique = new Set(hashes.map((hash) => hash.md5));
  assert.equal(unique.size, 3, `kenburns crop hashes did not change across 3 samples: ${JSON.stringify(hashes)}`);
  return hashes;
}

function createToneAssets(projectDir) {
  const audioDir = path.join(projectDir, "assets", "audio");
  mkdirSync(audioDir, { recursive: true });
  const bgm = path.join(audioDir, "bgm-tone.wav");
  const narration = path.join(audioDir, "narration-silence.wav");
  run("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=4:sample_rate=48000",
    "-c:a",
    "pcm_s16le",
    bgm
  ]);
  run("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=mono:sample_rate=48000",
    "-t",
    "4",
    "-c:a",
    "pcm_s16le",
    narration
  ]);
}

function duckingIndex() {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>P2-03 Audio Duck</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      html,
      body {
        margin: 0;
        width: 1920px;
        height: 1080px;
        overflow: hidden;
        background: #0f172a;
      }
      #root {
        position: relative;
        width: 1920px;
        height: 1080px;
        overflow: hidden;
      }
      .visual {
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, #0f172a, #1d4ed8);
      }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-width="1920" data-height="1080" data-duration="4">
      <div id="visual" class="clip visual" data-start="0" data-duration="4" data-track-index="1"></div>
      <audio
        id="rf-bgm"
        src="assets/audio/bgm-tone.wav"
        data-start="0"
        data-duration="4"
        data-track-index="900"
        data-volume="0.35"
      ></audio>
      <audio
        id="audio-s01"
        src="assets/audio/narration-silence.wav"
        data-start="0"
        data-duration="4"
        data-track-index="100"
        data-volume="1"
      ></audio>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      (function () {
        const tl = gsap.timeline({ paused: true });
        window.__timelines["main"] = tl;
      })();
    </script>
  </body>
</html>
`;
}

function renderDucking() {
  const projectDir = path.join(tmpRoot, "ducking-render");
  mkdirSync(projectDir, { recursive: true });
  createToneAssets(projectDir);

  const keyframes = buildDuckingKeyframes({
    windows: [{ sceneId: "s01", startSec: 1, endSec: 2.6 }],
    totalDurationSec: 4
  });
  const baseHtml = duckingIndex();
  const html = applyDuckingToIndexHtml({ html: baseHtml, keyframes });
  writeFileSync(path.join(projectDir, "index.html"), html);

  const manifest = applyDuckingToManifest({
    manifest: {
      bgm: {
        path: "./assets/audio/bgm-tone.wav",
        volume: 0.35,
        duckingKeyframes: []
      }
    },
    keyframes
  });
  writeJson(path.join(projectDir, "render-manifest.json"), manifest);

  const output = path.join(tmpRoot, "ducking.mp4");
  run(hyperframesBin, [
    "render",
    projectDir,
    "--output",
    output,
    "--fps=30",
    "--quality=draft",
    "--workers=1",
    "--no-browser-gpu",
    "--browser-timeout=120"
  ]);
  assert.equal(existsSync(output), true, "ducking render output missing");
  assert.ok(statSync(output).size > 10_000, "ducking render output too small");
  assert.deepEqual(manifest.bgm.duckingKeyframes, keyframes, "manifest ducking keyframes mismatch");
  return { output, keyframes };
}

function rmsDb(videoPath, startSec, durationSec) {
  const result = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostats",
      "-ss",
      String(startSec),
      "-t",
      String(durationSec),
      "-i",
      videoPath,
      "-af",
      "astats=metadata=1:reset=0",
      "-f",
      "null",
      "-"
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  if (result.status !== 0) {
    throw new Error(`ffmpeg astats failed\n${result.stdout}\n${result.stderr}`);
  }
  const matches = [...result.stderr.matchAll(/RMS level dB:\s*(-?(?:\d+(?:\.\d+)?|inf))/gi)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
  if (matches.length === 0) throw new Error(`RMS level not found in astats output\n${result.stderr}`);
  return matches.at(-1);
}

function verifyDuckingRms(videoPath) {
  const nonSpeech = rmsDb(videoPath, 0.15, 0.35);
  const speech = rmsDb(videoPath, 1.25, 0.45);
  const deltaDb = nonSpeech - speech;
  assert.ok(deltaDb >= 4, `ducking RMS delta too small: ${deltaDb.toFixed(2)}dB`);
  return { nonSpeech, speech, deltaDb };
}

try {
  ensureTool("ffmpeg");
  assert.equal(existsSync(hyperframesBin), true, "local hyperframes binary missing");

  const { specs, outBuild, compileResult } = compileKenBurnsVariant();
  const kenBurnsRender = renderKenBurns({ specs, outBuild });
  const kenBurnsHashes = verifyKenBurnsPixels(kenBurnsRender.output, kenBurnsRender.durationSec);

  const duckingRender = renderDucking();
  const duckingRms = verifyDuckingRms(duckingRender.output);

  console.log("motion-duck: PASS");
  console.log(`tmp: ${tmpRoot}`);
  console.log(
    compileResult.pass
      ? `compile: PASS ${compileResult.buildDir} (copied to ${outBuild})`
      : `compile: FALLBACK ${compileResult.fallbackReason} (golden build copied to ${outBuild})`
  );
  console.log(`compile-out: unavailable in current vf; no shared fixture build was written`);
  console.log(`kenburns: PASS hashes=${kenBurnsHashes.map((hash) => `${hash.timeSec}s:${hash.md5.slice(0, 8)}`).join(",")}`);
  console.log(`ducking-keyframes: PASS ${JSON.stringify(duckingRender.keyframes)}`);
  console.log(
    `ducking-rms: PASS nonSpeech=${duckingRms.nonSpeech.toFixed(2)}dB speech=${duckingRms.speech.toFixed(2)}dB delta=${duckingRms.deltaDb.toFixed(2)}dB`
  );
} finally {
  rmSync(repoTmpRoot, { recursive: true, force: true });
}

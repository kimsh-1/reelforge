#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { TRANSITION_SAFE_RATIO } from "../../src/compiler/timing.mjs";
import {
  copyFixtureClean,
  evidenceForPaths,
  fps,
  frameCount,
  main,
  readJson,
  repoRel,
  repoRoot,
  resetDir,
  run,
  secondsFromFrames,
  sha256File,
  writeJson
} from "./helpers.mjs";

const self = repoRel(fileURLToPath(import.meta.url));
const workRoot = path.join(repoRoot, "tmp", "gate-work", "l1-2-transitions");
const transitionTypes = ["cut", "fade", "crossfade", "slide_left", "slide_right", "wipe"];
const durationCombos = [
  { id: "zero", durations: [0, 0] },
  { id: "short-long", durations: [0.2, 0.4] },
  { id: "fractional", durations: [0.333, 0.667] },
  { id: "tail-extend", durations: [0.5, 5] }
];
const renderCases = [
  { type: "crossfade", comboId: "short-long" },
  { type: "wipe", comboId: "short-long" }
];

function effectiveDurations(type, durations) {
  return type === "cut" ? [0, 0] : durations;
}

function resolvedType(type) {
  return type === "fade" ? "crossfade" : type;
}

function expectedTiming(audioMeta, durations) {
  const sceneFrames = audioMeta.scenes.map((scene) => frameCount(scene.audioDurationSec));
  const requestedTransitionFrames = durations.map((duration) => (duration === 0 ? 0 : frameCount(duration)));
  const transitionFrames = requestedTransitionFrames.map((requested, index) => {
    const adjacentMin = Math.min(sceneFrames[index], sceneFrames[index + 1]);
    const limit = adjacentMin <= 0 ? 0 : Math.max(1, Math.floor(adjacentMin * TRANSITION_SAFE_RATIO));
    return Math.min(requested, limit);
  });
  const starts = [0, sceneFrames[0], sceneFrames[0] + sceneFrames[1]];
  const totalFrames = sceneFrames.reduce((sum, value) => sum + value, 0);
  const transitionStarts = transitionFrames.map((frames, index) => starts[index + 1]);
  return { sceneFrames, requestedTransitionFrames, transitionFrames, transitionStarts, starts, totalFrames };
}

function makeCase(type, combo) {
  const caseId = `${type}-${combo.id}`;
  const caseDir = path.join(workRoot, "cases", caseId);
  copyFixtureClean("edit-scenario", caseDir);

  const specsPath = path.join(caseDir, "scene_specs.json");
  const specs = readJson(specsPath);
  const [firstDuration, secondDuration] = effectiveDurations(type, combo.durations);
  specs.projectId = `transition-${caseId}`;
  specs.transitions = [
    { from: "s01", to: "s02", type, duration: firstDuration },
    { from: "s02", to: "s03", type, duration: secondDuration }
  ];
  writeJson(specsPath, specs);

  return { type, comboId: combo.id, caseId, caseDir, durations: [firstDuration, secondDuration] };
}

function compileCase(testCase) {
  const result = run(process.execPath, ["bin/vf", "compile", repoRel(testCase.caseDir), "--json"]);
  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    parsed = null;
  }
  return { ...testCase, compile: result, result: parsed };
}

function verifyCompile(compiled) {
  if (compiled.compile.exitCode !== 0 || compiled.result?.pass !== true) {
    return {
      pass: false,
      measured: {
        caseId: compiled.caseId,
        exitCode: compiled.compile.exitCode,
        stderr: compiled.compile.stderr.trim(),
        stdout: compiled.compile.stdout.slice(0, 4000)
      }
    };
  }

  const audioMeta = readJson(path.join(compiled.caseDir, "audio_meta.json"));
  const expected = expectedTiming(audioMeta, compiled.durations);
  const byScene = new Map(compiled.result.scenes.map((scene) => [scene.sceneId, scene]));
  const failures = [];

  if (compiled.result.timing.fps !== fps) failures.push("fps mismatch");
  if (compiled.result.timing.totalFrames !== expected.totalFrames) failures.push("totalFrames mismatch");
  if (compiled.result.timing.expectedFrameSum !== expected.sceneFrames.reduce((sum, value) => sum + value, 0)) {
    failures.push("expectedFrameSum mismatch");
  }

  ["s01", "s02", "s03"].forEach((sceneId, index) => {
    const scene = byScene.get(sceneId);
    if (!scene) failures.push(`${sceneId} missing`);
    else {
      if (scene.startFrame !== expected.starts[index]) failures.push(`${sceneId} startFrame moved`);
      if (scene.durationFrames !== expected.sceneFrames[index]) failures.push(`${sceneId} durationFrames mismatch`);
    }
  });

  if (byScene.get("s01")?.slotDurationFrames !== expected.sceneFrames[0] + expected.transitionFrames[0]) {
    failures.push("s01 slotDurationFrames mismatch");
  }
  if (byScene.get("s02")?.slotDurationFrames !== expected.sceneFrames[1] + expected.transitionFrames[1]) {
    failures.push("s02 slotDurationFrames mismatch");
  }
  if (byScene.get("s03")?.slotDurationFrames !== expected.sceneFrames[2]) failures.push("s03 slotDurationFrames mismatch");

  compiled.result.transitions.forEach((transition, index) => {
    if (transition.resolvedType !== resolvedType(compiled.type)) failures.push(`transition ${index} resolvedType mismatch`);
    if (transition.durationFrames !== expected.transitionFrames[index]) failures.push(`transition ${index} durationFrames mismatch`);
    if (transition.startFrame !== expected.transitionStarts[index]) failures.push(`transition ${index} startFrame mismatch`);
  });

  const fallbackWarnings = compiled.result.warnings.filter((warning) => warning.code === "transition-fallback");
  if (fallbackWarnings.length > 0) failures.push("transition fallback warning emitted");
  const clampWarnings = compiled.result.warnings.filter((warning) => warning.code === "transition-duration-clamped");
  const expectedClampCount = expected.requestedTransitionFrames.filter(
    (requested, index) => requested > expected.transitionFrames[index]
  ).length;
  if (clampWarnings.length !== expectedClampCount) failures.push("transition clamp warning count mismatch");

  return {
    pass: failures.length === 0,
    expected,
    measured: {
      caseId: compiled.caseId,
      type: compiled.type,
      comboId: compiled.comboId,
      failures,
      expected,
      actual: {
        totalFrames: compiled.result.timing.totalFrames,
        scenes: compiled.result.scenes,
        transitions: compiled.result.transitions
      }
    }
  };
}

function snapshotTimes(expected, transitionIndex) {
  const startFrame = expected.transitionStarts[transitionIndex];
  const durationFrames = expected.transitionFrames[transitionIndex];
  const beforeFrame = Math.max(0, startFrame - 6);
  const middleFrame = startFrame + Math.max(1, Math.floor(durationFrames / 2));
  const afterFrame = startFrame + durationFrames + 36;
  return [beforeFrame, middleFrame, afterFrame].map((frame) => secondsFromFrames(frame));
}

function runSnapshot(compiled, expected) {
  const outputDir = path.join(workRoot, "snapshots", compiled.caseId);
  rmSync(outputDir, { recursive: true, force: true });
  const times = snapshotTimes(expected, 0).map((time) => Number(time.toFixed(6))).join(",");
  const result = run("npx", [
    "hyperframes",
    "snapshot",
    path.join(compiled.caseDir, "build"),
    "--output",
    outputDir,
    "--at",
    times,
    "--no-end",
    "--describe",
    "false"
  ]);
  const frames = existsSync(outputDir)
    ? readdirSync(outputDir)
        .filter((name) => name.endsWith(".png"))
        .sort()
        .map((name) => path.join(outputDir, name))
    : [];
  const hashes = frames.map((file) => sha256File(file));
  return {
    pass: result.exitCode === 0 && frames.length === 3,
    measured: {
      caseId: compiled.caseId,
      command: result.command,
      exitCode: result.exitCode,
      times,
      frames: frames.map(repoRel),
      hashes,
      stderr: result.stderr.trim()
    },
    evidencePaths: frames.map(repoRel)
  };
}

function sha256Text(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function ntsc2997SecondsFromFrames(frames) {
  return frames === 0 ? 0 : Math.max(0, (frames * 1001) / 30000 - 1e-9);
}

function makeHostile2997Case() {
  const caseDir = path.join(workRoot, "cases", "hostile-2997-short-scenes");
  copyFixtureClean("minimal-3scene", caseDir);

  const specsPath = path.join(caseDir, "scene_specs.json");
  const specs = readJson(specsPath);
  specs.projectId = "transition-hostile-2997-short-scenes";
  specs.scenes = specs.scenes.map((scene) => ({ ...scene, layout: "headline_only", ost: null }));
  specs.transitions = [
    { from: "s01", to: "s02", type: "crossfade", duration: ntsc2997SecondsFromFrames(30) },
    { from: "s02", to: "s03", type: "slide_left", duration: ntsc2997SecondsFromFrames(24) }
  ];
  writeJson(specsPath, specs);

  const audioPath = path.join(caseDir, "audio_meta.json");
  const audioMeta = readJson(audioPath);
  const framesByScene = new Map([
    ["s01", 10],
    ["s02", 6],
    ["s03", 12]
  ]);
  audioMeta.scenes = audioMeta.scenes.map((scene) => {
    const authored = specs.scenes.find((item) => item.sceneId === scene.sceneId);
    return {
      ...scene,
      audioDurationSec: ntsc2997SecondsFromFrames(framesByScene.get(scene.sceneId)),
      words: [],
      sourceHash: sha256Text(authored.narration_tts)
    };
  });
  writeJson(audioPath, audioMeta);
  return caseDir;
}

async function nearWhiteRatio(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let nearWhite = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] >= 250 && data[offset] >= 245 && data[offset + 1] >= 245 && data[offset + 2] >= 245) {
      nearWhite += 1;
    }
  }
  return nearWhite / (info.width * info.height);
}

async function runHostile2997PixelCheck() {
  const caseDir = makeHostile2997Case();
  const compile = run(process.execPath, [
    "bin/vf",
    "compile",
    repoRel(caseDir),
    "--fps",
    "29.97",
    "--preset",
    "fixtures/presets/dark.json",
    "--json"
  ]);
  let parsed = null;
  try {
    parsed = JSON.parse(compile.stdout);
  } catch {
    parsed = null;
  }
  if (compile.exitCode !== 0 || parsed?.pass !== true) {
    return {
      pass: false,
      measured: {
        command: compile.command,
        exitCode: compile.exitCode,
        stderr: compile.stderr.trim(),
        stdout: compile.stdout.slice(0, 4000)
      },
      evidencePaths: []
    };
  }

  const outputDir = path.join(workRoot, "snapshots", "hostile-2997-short-scenes");
  rmSync(outputDir, { recursive: true, force: true });
  const sampleFrames = [0, 7, 8, 9, 10, 13, 14, 15, 16, 27];
  const times = sampleFrames.map((frame) => Number(ntsc2997SecondsFromFrames(frame).toFixed(6)));
  const snapshot = run("npx", [
    "hyperframes",
    "snapshot",
    path.join(caseDir, "build"),
    "--output",
    outputDir,
    "--at",
    times.join(","),
    "--no-end",
    "--describe",
    "false"
  ]);
  const frames = existsSync(outputDir)
    ? readdirSync(outputDir)
        .filter((name) => name.endsWith(".png"))
        .sort()
        .map((name) => path.join(outputDir, name))
    : [];
  const ratios = [];
  for (const file of frames) {
    ratios.push({ file: repoRel(file), nearWhiteRatio: await nearWhiteRatio(file) });
  }
  const blankFrames = ratios.filter((item) => item.nearWhiteRatio >= 0.985);
  const clampWarnings = parsed.warnings.filter((warning) => warning.code === "transition-duration-clamped");
  return {
    pass:
      snapshot.exitCode === 0 &&
      frames.length === sampleFrames.length &&
      blankFrames.length === 0 &&
      parsed.timing.totalFrames === 28 &&
      parsed.transitions.every((transition) => transition.durationFrames === 3) &&
      clampWarnings.length === 2,
    measured: {
      compileCommand: compile.command,
      snapshotCommand: snapshot.command,
      snapshotExitCode: snapshot.exitCode,
      totalFrames: parsed.timing.totalFrames,
      transitions: parsed.transitions,
      clampWarnings,
      sampleFrames,
      times,
      ratios,
      blankFrames,
      stderr: snapshot.stderr.trim()
    },
    evidencePaths: frames.map(repoRel)
  };
}

async function runGate({ profile }) {
  resetDir(workRoot);

  const compiled = [];
  const compileChecks = [];
  for (const type of transitionTypes) {
    for (const combo of durationCombos) {
      const testCase = makeCase(type, combo);
      const result = compileCase(testCase);
      const verified = verifyCompile(result);
      compiled.push({ ...result, expected: verified.expected });
      compileChecks.push({
        id: `compile-matrix:${testCase.caseId}`,
        pass: verified.pass,
        measured: verified.measured
      });
    }
  }

  const checks = [
    {
      id: "compile-matrix-cardinality",
      pass: compileChecks.length === transitionTypes.length * durationCombos.length,
      measured: {
        transitionTypes,
        durationCombos: durationCombos.map((combo) => combo.id),
        cases: compileChecks.length
      }
    },
    ...compileChecks
  ];

  const evidencePaths = compiled
    .flatMap((item) => [path.join(item.caseDir, "build", "index.html"), path.join(item.caseDir, "build", "render-manifest.json")])
    .filter((file) => existsSync(file))
    .map(repoRel);

  if (profile === "full") {
    for (const renderCase of renderCases) {
      const target = compiled.find((item) => item.type === renderCase.type && item.comboId === renderCase.comboId);
      const rendered = target?.expected ? runSnapshot(target, target.expected) : { pass: false, measured: { error: "compiled case missing" }, evidencePaths: [] };
      checks.push({
        id: `render-transition-pixels:${renderCase.type}-${renderCase.comboId}`,
        pass: rendered.pass,
        measured: rendered.measured
      });
      evidencePaths.push(...rendered.evidencePaths);
    }
    const hostile = await runHostile2997PixelCheck();
    checks.push({
      id: "render-transition-pixels:hostile-2997-short-scenes",
      pass: hostile.pass,
      measured: hostile.measured
    });
    evidencePaths.push(...hostile.evidencePaths);
  } else {
    checks.push({
      id: "render-transition-pixels",
      pass: true,
      measured: { skipped: true, reason: "render traces run only with --profile full" }
    });
  }

  return {
    checks,
    inputSet: [
      self,
      "tests/transitions-matrix.mjs",
      "src/compiler/compiler.mjs",
      "src/compiler/transitions.mjs",
      "src/compiler/timing.mjs",
      "fixtures/golden-specs/edit-scenario/scene_specs.json",
      "fixtures/golden-specs/edit-scenario/audio_meta.json",
      "fixtures/presets/light.json"
    ],
    evidence: evidenceForPaths(evidencePaths)
  };
}

main(runGate);

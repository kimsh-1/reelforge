#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workerId = "p201";
const tmpRoot = path.join("/tmp", `p2w-${workerId}`);
const tmpRepo = path.join(tmpRoot, "repo");
const casesRoot = path.join(tmpRepo, "cases");
const fixtureDir = path.join(repoRoot, "fixtures", "golden-specs", "edit-scenario");
const fps = 30;

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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function frameCount(seconds) {
  const value = Number(seconds);
  return value === 0 ? 0 : Math.ceil(value * fps);
}

function effectiveDurations(type, durations) {
  return type === "cut" ? [0, 0] : durations;
}

function resolvedType(type) {
  if (type === "fade") return "crossfade";
  return type;
}

function copyRunnerRepo() {
  rmSync(tmpRoot, { recursive: true, force: true });
  mkdirSync(path.join(tmpRepo, "bin"), { recursive: true });
  cpSync(path.join(repoRoot, "bin", "vf"), path.join(tmpRepo, "bin", "vf"));

  for (const name of ["src", "schemas", "fixtures", "poc", "blocks", "node_modules", "package.json", "package-lock.json"]) {
    symlinkSync(path.join(repoRoot, name), path.join(tmpRepo, name));
  }
  mkdirSync(casesRoot, { recursive: true });
}

function makeCase({ type, combo }) {
  const caseId = `${type}-${combo.id}`;
  const caseDir = path.join(casesRoot, caseId);
  cpSync(fixtureDir, caseDir, {
    recursive: true,
    filter: (source) => !source.split(path.sep).includes("build")
  });

  const specsPath = path.join(caseDir, "scene_specs.json");
  const specs = readJson(specsPath);
  const [firstDuration, secondDuration] = effectiveDurations(type, combo.durations);
  specs.projectId = `transition-${caseId}`;
  specs.transitions = [
    { from: "s01", to: "s02", type, duration: firstDuration },
    { from: "s02", to: "s03", type, duration: secondDuration }
  ];
  writeJson(specsPath, specs);

  return { caseId, caseDir, durations: [firstDuration, secondDuration] };
}

function runCompile(caseDir) {
  const outDir = path.join(tmpRoot, "out", path.basename(caseDir));
  const relativeCaseDir = path.relative(tmpRepo, caseDir);
  const result = spawnSync(process.execPath, ["bin/vf", "compile", relativeCaseDir, "--out", outDir, "--json"], {
    cwd: tmpRepo,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });

  assert(result.status === 0, `compile failed for ${relativeCaseDir}\n${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

function expectedTiming(audioMeta, durations) {
  const sceneFrames = audioMeta.scenes.map((scene) => frameCount(scene.audioDurationSec));
  const transitionFrames = durations.map(frameCount);
  const starts = [0, sceneFrames[0], sceneFrames[0] + sceneFrames[1]];
  const totalFrames = Math.max(
    starts[0] + sceneFrames[0] + transitionFrames[0],
    starts[1] + sceneFrames[1] + transitionFrames[1],
    starts[2] + sceneFrames[2]
  );
  return { sceneFrames, transitionFrames, starts, totalFrames };
}

function verifyCompileResult({ type, caseId, caseDir, durations, result }) {
  const audioMeta = readJson(path.join(caseDir, "audio_meta.json"));
  const expected = expectedTiming(audioMeta, durations);
  const byScene = new Map(result.scenes.map((scene) => [scene.sceneId, scene]));

  assert(result.timing.fps === fps, `${caseId}: fps mismatch`);
  assert(result.timing.totalFrames === expected.totalFrames, `${caseId}: totalFrames mismatch`);
  assert(
    result.timing.expectedFrameSum === expected.sceneFrames.reduce((sum, value) => sum + value, 0),
    `${caseId}: expectedFrameSum mismatch`
  );

  ["s01", "s02", "s03"].forEach((sceneId, index) => {
    const scene = byScene.get(sceneId);
    assert(scene.startFrame === expected.starts[index], `${caseId}: ${sceneId} startFrame moved`);
    assert(scene.durationFrames === expected.sceneFrames[index], `${caseId}: ${sceneId} durationFrames mismatch`);
  });

  assert(byScene.get("s01").slotDurationFrames === expected.sceneFrames[0] + expected.transitionFrames[0], `${caseId}: s01 slot duration mismatch`);
  assert(byScene.get("s02").slotDurationFrames === expected.sceneFrames[1] + expected.transitionFrames[1], `${caseId}: s02 slot duration mismatch`);
  assert(byScene.get("s03").slotDurationFrames === expected.sceneFrames[2], `${caseId}: s03 slot duration mismatch`);

  result.transitions.forEach((transition, index) => {
    assert(transition.resolvedType === resolvedType(type), `${caseId}: transition ${index} resolvedType mismatch`);
    assert(transition.durationFrames === expected.transitionFrames[index], `${caseId}: transition ${index} durationFrames mismatch`);
  });

  const fallbackWarnings = result.warnings.filter((warning) => warning.code === "transition-fallback");
  assert(fallbackWarnings.length === 0, `${caseId}: transition fallback warning emitted`);

  return expected;
}

function secondsFromFrames(frames) {
  return frames === 0 ? 0 : Math.max(0, frames / fps - 1e-9);
}

function snapshotTimes(expected, transitionIndex) {
  const startFrame = expected.starts[transitionIndex + 1];
  const durationFrames = expected.transitionFrames[transitionIndex];
  const beforeFrame = Math.max(0, startFrame - 6);
  const middleFrame = startFrame + Math.max(1, Math.floor(durationFrames / 2));
  const afterFrame = startFrame + durationFrames + 36;
  return [beforeFrame, middleFrame, afterFrame].map(secondsFromFrames);
}

function runSnapshot({ buildDir, outputDir, times }) {
  const at = times.map((time) => Number(time.toFixed(6))).join(",");
  const result = spawnSync(
    "npx",
    ["hyperframes", "snapshot", buildDir, "--output", outputDir, "--at", at, "--no-end", "--describe", "false"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024
    }
  );
  assert(result.status === 0, `snapshot failed for ${buildDir}\n${result.stdout}\n${result.stderr}`);
  const frames = readdirSync(outputDir)
    .filter((name) => name.endsWith(".png"))
    .sort()
    .map((name) => path.join(outputDir, name));
  assert(frames.length === 3, `expected 3 snapshot frames, got ${frames.length}`);
  return frames;
}

async function meanAbsoluteDiff(leftPath, rightPath) {
  const left = await sharp(leftPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const right = await sharp(rightPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert(left.info.width === right.info.width && left.info.height === right.info.height, "snapshot dimensions differ");
  assert(left.data.length === right.data.length, "snapshot byte lengths differ");

  let sum = 0;
  for (let index = 0; index < left.data.length; index += 1) {
    sum += Math.abs(left.data[index] - right.data[index]);
  }
  return sum / left.data.length;
}

async function verifyRenderTrace({ type, comboId, caseDir, expected }) {
  const buildDir = path.join(caseDir, "build");
  assert(existsSync(path.join(buildDir, "index.html")), `${type}-${comboId}: compiled build missing`);

  const outputDir = path.join(tmpRoot, "snapshots", `${type}-${comboId}`);
  const times = snapshotTimes(expected, 0);
  const [before, middle, after] = runSnapshot({ buildDir, outputDir, times });
  const diffFrom = await meanAbsoluteDiff(before, middle);
  const diffTo = await meanAbsoluteDiff(after, middle);
  const threshold = 1.5;

  assert(diffFrom > threshold, `${type}-${comboId}: boundary frame too close to outgoing scene (${diffFrom})`);
  assert(diffTo > threshold, `${type}-${comboId}: boundary frame too close to incoming scene (${diffTo})`);
  return { type, comboId, diffFrom, diffTo, times };
}

copyRunnerRepo();

const compiled = [];
for (const type of transitionTypes) {
  for (const combo of durationCombos) {
    const testCase = makeCase({ type, combo });
    const result = runCompile(testCase.caseDir);
    const expected = verifyCompileResult({ type, result, ...testCase });
    compiled.push({ type, comboId: combo.id, ...testCase, result, expected });
  }
}

const renderChecks = [];
for (const renderCase of renderCases) {
  const match = compiled.find((item) => item.type === renderCase.type && item.comboId === renderCase.comboId);
  assert(match, `missing compiled render case ${renderCase.type}-${renderCase.comboId}`);
  renderChecks.push(await verifyRenderTrace(match));
}

console.log("transitions-matrix: PASS");
console.log(`matrix cases: ${compiled.length} (${transitionTypes.length} types x ${durationCombos.length} duration combos)`);
console.log(`compile root: ${tmpRoot}`);
console.log("compile command: node bin/vf compile <case> --out /tmp/p2w-p201/out/<case> --json");
console.log("timing: PASS totalFrames, scene durationFrames, startFrame invariance, outgoing slot extension");
console.log("fallback warnings: PASS none");
for (const check of renderChecks) {
  console.log(
    `render pixels: PASS ${check.type}-${check.comboId} diffFrom=${check.diffFrom.toFixed(2)} diffTo=${check.diffTo.toFixed(2)}`
  );
}

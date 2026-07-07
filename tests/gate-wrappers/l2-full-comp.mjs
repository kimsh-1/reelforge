#!/usr/bin/env node
import { existsSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  compileFixture,
  ensureDir,
  evidenceForPaths,
  ffprobeJson,
  fps,
  frameCount,
  main,
  readJson,
  renderBuild,
  repoRel,
  repoRoot,
  resetDir
} from "./helpers.mjs";

const self = repoRel(fileURLToPath(import.meta.url));
const workRoot = path.join(repoRoot, "tmp", "gate-work", "l2-full-comp");
const durationToleranceSec = 0.2;

async function runGate() {
  resetDir(workRoot);
  const compiled = compileFixture("full-8types", workRoot);
  const checks = [
    {
      id: "clean-compile:full-8types",
      pass: compiled.compile.exitCode === 0 && compiled.result?.pass === true,
      measured: {
        command: compiled.compile.command,
        exitCode: compiled.compile.exitCode,
        buildDir: compiled.result?.buildDir ?? repoRel(compiled.buildDir),
        sceneCount: compiled.result?.scenes?.length ?? null,
        warnings: compiled.result?.warnings ?? null,
        stderr: compiled.compile.stderr.trim()
      }
    }
  ];

  const evidencePaths = [];
  if (compiled.compile.exitCode === 0 && compiled.result?.pass === true) {
    const layouts = compiled.result.scenes.map((scene) => scene.layout);
    checks.push({
      id: "integrated-block-surface",
      pass:
        compiled.result.scenes.length === 8 &&
        compiled.result.scenes.every((scene) => scene.block === "block") &&
        ["bar", "pie", "line", "list", "numbered", "statistic", "compare", "quote"].every((layout) => layouts.includes(layout)) &&
        compiled.result.warnings.length === 0,
      measured: {
        layouts,
        scenes: compiled.result.scenes.map(({ sceneId, layout, block }) => ({ sceneId, layout, block })),
        warnings: compiled.result.warnings,
        purpose: "merge gate for defects that per-worker block checks can miss after compiler integration"
      }
    });

    const output = path.join(workRoot, "videos", "full-8types.mp4");
    const render = renderBuild(compiled.buildDir, output);
    checks.push({
      id: "render:full-8types",
      pass: render.exitCode === 0 && existsSync(output) && statSync(output).size > 0,
      measured: {
        command: render.command,
        exitCode: render.exitCode,
        output: repoRel(output),
        bytes: existsSync(output) ? statSync(output).size : 0,
        stderr: render.stderr.slice(-4000)
      }
    });

    const audioMeta = readJson(path.join(compiled.projectDir, "audio_meta.json"));
    const expectedFrames = audioMeta.scenes.reduce((sum, scene) => sum + frameCount(scene.audioDurationSec), 0);
    const expectedDurationSec = expectedFrames / fps;
    const probe = ffprobeJson(output);
    const probePath = path.join(workRoot, "ffprobe", "full-8types.json");
    ensureDir(path.dirname(probePath));
    writeFileSync(probePath, `${JSON.stringify(probe.parsed ?? { error: probe.result.stderr }, null, 2)}\n`);
    evidencePaths.push(repoRel(probePath));

    const actualDurationSec = Number.parseFloat(probe.parsed?.format?.duration ?? "NaN");
    const deltaSec = Math.abs(actualDurationSec - expectedDurationSec);
    checks.push({
      id: "ffprobe-duration-ceil-sum",
      pass: probe.result.exitCode === 0 && Number.isFinite(actualDurationSec) && deltaSec <= durationToleranceSec,
      measured: {
        command: probe.result.command,
        exitCode: probe.result.exitCode,
        expectedFrames,
        expectedDurationSec,
        actualDurationSec,
        deltaSec,
        durationToleranceSec,
        fps,
        stderr: probe.result.stderr.trim(),
        streams: probe.parsed?.streams ?? null
      }
    });
  }

  return {
    checks,
    inputSet: [
      self,
      "src/compiler/compiler.mjs",
      "src/compiler/blocks.mjs",
      "src/compiler/transitions.mjs",
      "fixtures/presets/light.json",
      "blocks",
      "fixtures/golden-specs/full-8types/scene_specs.json",
      "fixtures/golden-specs/full-8types/audio_meta.json"
    ],
    evidence: evidenceForPaths(evidencePaths)
  };
}

main(runGate);

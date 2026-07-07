#!/usr/bin/env node
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  compareFrameMd5,
  compileFixture,
  evidenceForPaths,
  framemd5,
  main,
  renderBuild,
  repoRel,
  repoRoot,
  resetDir
} from "./helpers.mjs";

const self = repoRel(fileURLToPath(import.meta.url));
const workRoot = path.join(repoRoot, "tmp", "gate-work", "l2-1-determinism");

async function runGate() {
  resetDir(workRoot);
  const compiled = compileFixture("minimal-3scene", workRoot);
  const checks = [
    {
      id: "compile:minimal-3scene",
      pass: compiled.compile.exitCode === 0 && compiled.result?.pass === true,
      measured: {
        command: compiled.compile.command,
        exitCode: compiled.compile.exitCode,
        buildDir: compiled.result?.buildDir ?? repoRel(compiled.buildDir),
        stderr: compiled.compile.stderr.trim()
      }
    }
  ];

  const evidencePaths = [];
  if (compiled.compile.exitCode === 0 && compiled.result?.pass === true) {
    const firstMp4 = path.join(workRoot, "videos", "minimal-run-a.mp4");
    const secondMp4 = path.join(workRoot, "videos", "minimal-run-b.mp4");
    const firstRender = renderBuild(compiled.buildDir, firstMp4);
    const secondRender = renderBuild(compiled.buildDir, secondMp4);
    evidencePaths.push(repoRel(firstMp4), repoRel(secondMp4));
    checks.push({
      id: "render-twice:same-build",
      pass:
        firstRender.exitCode === 0 &&
        secondRender.exitCode === 0 &&
        existsSync(firstMp4) &&
        existsSync(secondMp4) &&
        statSync(firstMp4).size > 0 &&
        statSync(secondMp4).size > 0,
      measured: {
        first: { command: firstRender.command, exitCode: firstRender.exitCode, stderr: firstRender.stderr.slice(-2000) },
        second: { command: secondRender.command, exitCode: secondRender.exitCode, stderr: secondRender.stderr.slice(-2000) }
      }
    });

    const firstMd5 = path.join(workRoot, "framemd5", "minimal-run-a.framemd5");
    const secondMd5 = path.join(workRoot, "framemd5", "minimal-run-b.framemd5");
    const firstMd5Run = framemd5(firstMp4, firstMd5, ["format=rgb24"]);
    const secondMd5Run = framemd5(secondMp4, secondMd5, ["format=rgb24"]);
    evidencePaths.push(repoRel(firstMd5), repoRel(secondMd5));
    checks.push({
      id: "framemd5-extract",
      pass: firstMd5Run.exitCode === 0 && secondMd5Run.exitCode === 0,
      measured: {
        first: { command: firstMd5Run.command, exitCode: firstMd5Run.exitCode, stderr: firstMd5Run.stderr.slice(-2000) },
        second: { command: secondMd5Run.command, exitCode: secondMd5Run.exitCode, stderr: secondMd5Run.stderr.slice(-2000) }
      }
    });

    const compare = compareFrameMd5(firstMd5, secondMd5);
    checks.push({
      id: "framemd5-identical",
      pass: compare.pass,
      measured: compare.measured
    });
  }

  return {
    checks,
    inputSet: [
      self,
      "src/compiler/compiler.mjs",
      "src/compiler/transitions.mjs",
      "fixtures/presets/light.json",
      "fixtures/golden-specs/minimal-3scene/scene_specs.json",
      "fixtures/golden-specs/minimal-3scene/audio_meta.json"
    ],
    evidence: evidenceForPaths(evidencePaths)
  };
}

main(runGate);

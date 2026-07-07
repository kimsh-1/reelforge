#!/usr/bin/env node
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  compareFrameMd5,
  compileFixture,
  evidenceForPaths,
  fps,
  framemd5,
  main,
  renderBuild,
  repoRel,
  repoRoot,
  resetDir
} from "./helpers.mjs";

const self = repoRel(fileURLToPath(import.meta.url));
const workRoot = path.join(repoRoot, "tmp", "gate-work", "l2-2-scene-solo");

function selectFramesFilter(startFrame, endFrameExclusive) {
  return `select=between(n\\,${startFrame}\\,${Math.max(startFrame, endFrameExclusive - 1)}),setpts=N/FRAME_RATE/TB,format=rgb24`;
}

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
    const fullMp4 = path.join(workRoot, "videos", "minimal-full.mp4");
    const soloMp4 = path.join(workRoot, "videos", "minimal-scene-s02.mp4");
    const fullRender = renderBuild(compiled.buildDir, fullMp4);
    const soloRender = renderBuild(compiled.buildDir, soloMp4, ["--composition", "scenes/scene-s02.html"]);
    evidencePaths.push(repoRel(fullMp4), repoRel(soloMp4));

    checks.push({
      id: "render:full-and-scene2",
      pass: fullRender.exitCode === 0 && soloRender.exitCode === 0 && existsSync(fullMp4) && existsSync(soloMp4),
      measured: {
        full: { command: fullRender.command, exitCode: fullRender.exitCode, stderr: fullRender.stderr.slice(-2000) },
        solo: { command: soloRender.command, exitCode: soloRender.exitCode, stderr: soloRender.stderr.slice(-2000) }
      }
    });

    const scene = compiled.result.scenes.find((entry) => entry.sceneId === "s02");
    const incoming = compiled.result.transitions.find((entry) => entry.to === "s02")?.durationFrames ?? 0;
    const outgoing = compiled.result.transitions.find((entry) => entry.from === "s02")?.durationFrames ?? 0;
    const guardFrames = 2;
    const bodyStartFrame = Math.min(scene.durationFrames - 1, incoming + guardFrames);
    const bodyEndFrame = Math.max(bodyStartFrame + 1, scene.durationFrames - outgoing - guardFrames);
    const fullStartFrame = scene.startFrame + bodyStartFrame;
    const fullEndFrame = scene.startFrame + bodyEndFrame;

    const fullMd5 = path.join(workRoot, "framemd5", "full-scene2-body.framemd5");
    const soloMd5 = path.join(workRoot, "framemd5", "solo-scene2-body.framemd5");
    const fullMd5Run = framemd5(fullMp4, fullMd5, [selectFramesFilter(fullStartFrame, fullEndFrame)]);
    const soloMd5Run = framemd5(soloMp4, soloMd5, [selectFramesFilter(bodyStartFrame, bodyEndFrame)]);
    evidencePaths.push(repoRel(fullMd5), repoRel(soloMd5));

    checks.push({
      id: "framemd5-extract:scene2-body",
      pass: fullMd5Run.exitCode === 0 && soloMd5Run.exitCode === 0,
      measured: {
        full: { command: fullMd5Run.command, exitCode: fullMd5Run.exitCode, stderr: fullMd5Run.stderr.slice(-2000) },
        solo: { command: soloMd5Run.command, exitCode: soloMd5Run.exitCode, stderr: soloMd5Run.stderr.slice(-2000) },
        bodyWindow: {
          sceneId: "s02",
          incomingTransitionFrames: incoming,
          outgoingTransitionFrames: outgoing,
          bodyStartFrame,
          bodyEndFrameExclusive: bodyEndFrame,
          fullStartFrame,
          fullEndFrameExclusive: fullEndFrame,
          fps
        }
      }
    });

    const frameCompare = compareFrameMd5(fullMd5, soloMd5);
    checks.push({
      id: "body-frame-match",
      pass: frameCompare.pass,
      measured: {
        comparedWindow: "minimal-3scene scene s02 full-render body frames vs solo scene render body frames",
        ...frameCompare.measured
      }
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

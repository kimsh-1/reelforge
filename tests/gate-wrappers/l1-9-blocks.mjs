#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { BLOCK_RUNTIME_READY_VERSION } from "../../src/compiler/blocks.mjs";
import {
  compileFixture,
  evidenceForPaths,
  fps,
  main,
  readJson,
  repoRel,
  repoRoot,
  resetDir,
  run,
  secondsFromFrames,
  sha256File
} from "./helpers.mjs";

const self = repoRel(fileURLToPath(import.meta.url));
const workRoot = path.join(repoRoot, "tmp", "gate-work", "l1-9-blocks");
const blockTypes = ["bar", "pie", "line", "list", "numbered", "statistic", "compare", "quote"];

function inspectCompiledBlocks(compiled) {
  const specs = readJson(path.join(compiled.projectDir, "scene_specs.json"));
  const sceneChecks = [];
  for (const scene of specs.scenes) {
    const sceneHtmlPath = path.join(compiled.buildDir, "scenes", `scene-${scene.sceneId}.html`);
    const html = existsSync(sceneHtmlPath) ? readFileSync(sceneHtmlPath, "utf8") : "";
    const blockPath = path.join(compiled.buildDir, "blocks", scene.layout, "block.html");
    const sourceHtml = existsSync(blockPath) ? readFileSync(blockPath, "utf8") : "";
    const compositionId = sourceHtml.match(/data-composition-id=["']([^"']+)["']/)?.[1] ?? null;
    const timelineRegistered =
      compositionId !== null &&
      (sourceHtml.includes(`__timelines["${compositionId}"]`) ||
        sourceHtml.includes("__timelines[id]") ||
        sourceHtml.includes("__timelines[compositionId]"));
    const runtimeReadyInjected =
      sourceHtml.includes(`data-rf-runtime-ready="${BLOCK_RUNTIME_READY_VERSION}"`) &&
      sourceHtml.includes("__hfForceTimelineRebind") &&
      sourceHtml.includes("__hfFlushSync") &&
      sourceHtml.includes("__playerReady") &&
      sourceHtml.includes("__renderReady");
    sceneChecks.push({
      sceneId: scene.sceneId,
      layout: scene.layout,
      pass:
        blockTypes.includes(scene.layout) &&
        existsSync(blockPath) &&
        html.includes(`data-composition-src="blocks/${scene.layout}/block.html"`) &&
        html.includes("data-variable-values=") &&
        Boolean(compositionId) &&
        timelineRegistered &&
        runtimeReadyInjected &&
        sourceHtml.includes("paused: true"),
      measured: {
        blockPath: repoRel(blockPath),
        sceneHtmlPath: repoRel(sceneHtmlPath),
        compositionId,
        hasHost: html.includes(`data-composition-src="blocks/${scene.layout}/block.html"`),
        hasVariables: html.includes("data-variable-values="),
        timelineRegistered,
        runtimeReadyInjected,
        pausedTimeline: sourceHtml.includes("paused: true")
      }
    });
  }
  return sceneChecks;
}

function snapshotTimes(compiled) {
  return compiled.result.scenes.flatMap((scene) => {
    const start = scene.startFrame / fps;
    const duration = scene.durationFrames / fps;
    const early = Number((start + 0.05).toFixed(6));
    const mid = Number((start + Math.max(0.1, duration / 2)).toFixed(6));
    const late = Number((start + Math.max(0.2, Math.min(1.2, duration - 0.1))).toFixed(6));
    return [early, mid, late];
  });
}

async function frameStats(file) {
  const image = sharp(file).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  let nearWhite = 0;
  let opaque = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    const alpha = data[offset + 3];
    if (alpha >= 250) opaque += 1;
    if (alpha >= 250 && data[offset] >= 245 && data[offset + 1] >= 245 && data[offset + 2] >= 245) {
      nearWhite += 1;
    }
  }
  const pixels = info.width * info.height;
  return {
    width: info.width,
    height: info.height,
    opaqueRatio: opaque / pixels,
    nearWhiteRatio: nearWhite / pixels
  };
}

async function runSnapshots(compiled) {
  const outputDir = path.join(workRoot, "snapshots");
  rmSync(outputDir, { recursive: true, force: true });
  const times = snapshotTimes(compiled);
  const result = run("npx", [
    "hyperframes",
    "snapshot",
    compiled.buildDir,
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
  const triples = [];
  for (const [index, scene] of compiled.result.scenes.entries()) {
    const early = frames[index * 3];
    const mid = frames[index * 3 + 1];
    const late = frames[index * 3 + 2];
    const midStats = mid && existsSync(mid) ? await frameStats(mid) : null;
    triples.push({
      sceneId: scene.sceneId,
      layout: scene.layout,
      early: early ? repoRel(early) : null,
      mid: mid ? repoRel(mid) : null,
      late: late ? repoRel(late) : null,
      earlyHash: early && existsSync(early) ? sha256File(early) : null,
      midHash: mid && existsSync(mid) ? sha256File(mid) : null,
      lateHash: late && existsSync(late) ? sha256File(late) : null,
      midStats
    });
  }
  const animated = triples.every((triple) => triple.earlyHash && triple.lateHash && triple.earlyHash !== triple.lateHash);
  const midSceneVisible = triples.every((triple) => {
    return (
      triple.midHash &&
      triple.midStats?.width === 1920 &&
      triple.midStats?.height === 1080 &&
      triple.midStats?.opaqueRatio > 0.99 &&
      triple.midStats?.nearWhiteRatio < 0.985
    );
  });
  return {
    pass: result.exitCode === 0 && frames.length === times.length && animated && midSceneVisible,
    measured: {
      command: result.command,
      exitCode: result.exitCode,
      expectedPngCount: times.length,
      actualPngCount: frames.length,
      times,
      triples,
      animated,
      midSceneVisible,
      stderr: result.stderr.trim()
    },
    evidencePaths: frames.map(repoRel)
  };
}

async function runGate({ profile }) {
  resetDir(workRoot);
  const compiled = compileFixture("full-8types", workRoot);
  const checks = [
    {
      id: "compile:full-8types",
      pass: compiled.compile.exitCode === 0 && compiled.result?.pass === true,
      measured: {
        command: compiled.compile.command,
        exitCode: compiled.compile.exitCode,
        buildDir: compiled.result?.buildDir ?? repoRel(compiled.buildDir),
        sceneCount: compiled.result?.scenes?.length ?? null,
        stderr: compiled.compile.stderr.trim()
      }
    }
  ];

  const evidencePaths = [];
  if (compiled.compile.exitCode === 0 && compiled.result?.pass === true) {
    const layoutSet = [...new Set(compiled.result.scenes.map((scene) => scene.layout))].sort();
    checks.push({
      id: "block-layout-cardinality",
      pass: blockTypes.every((type) => layoutSet.includes(type)) && compiled.result.scenes.every((scene) => scene.block === "block"),
      measured: {
        expected: blockTypes,
        actual: layoutSet,
        scenes: compiled.result.scenes.map(({ sceneId, layout, block }) => ({ sceneId, layout, block })),
        warnings: compiled.result.warnings
      }
    });

    for (const sceneCheck of inspectCompiledBlocks(compiled)) {
      checks.push({
        id: `block-contract:${sceneCheck.layout}`,
        pass: sceneCheck.pass,
        measured: { sceneId: sceneCheck.sceneId, layout: sceneCheck.layout, ...sceneCheck.measured }
      });
    }

    evidencePaths.push(path.join(compiled.buildDir, "index.html"), path.join(compiled.buildDir, "render-manifest.json"));

    if (profile === "full") {
      const snapshots = await runSnapshots(compiled);
      checks.push({
        id: "block-snapshots-and-animation",
        pass: snapshots.pass,
        measured: snapshots.measured
      });
      evidencePaths.push(...snapshots.evidencePaths);
    } else {
      checks.push({
        id: "block-snapshots-and-animation",
        pass: true,
        measured: { skipped: true, reason: "PNG snapshots and animation checks run only with --profile full" }
      });
    }
  }

  return {
    checks,
    inputSet: [
      self,
      "src/compiler/compiler.mjs",
      "src/compiler/blocks.mjs",
      "blocks",
      "fixtures/presets/light.json",
      "fixtures/golden-specs/full-8types/scene_specs.json",
      "fixtures/golden-specs/full-8types/audio_meta.json"
    ],
    evidence: evidenceForPaths(evidencePaths.map((entry) => (path.isAbsolute(entry) ? repoRel(entry) : entry)))
  };
}

main(runGate);

#!/usr/bin/env node
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  check,
  compileFixture,
  denseFrameSamples,
  evidenceForPaths,
  extractFrames,
  frameHeight,
  frameWidth,
  hexToRgb,
  main,
  measureSubtitleBboxes,
  normalizeOcrText,
  positiveTerms,
  readJson,
  renderBuild,
  repoRel,
  repoRoot,
  representativeSceneSamples,
  resetDir,
  rgbDistance,
  runEasyOcr,
  samplePixels,
  sceneForFrame,
  sceneWhitelist,
  stableEvidence,
  tail
} from "./p5-common.mjs";

const self = repoRel(fileURLToPath(import.meta.url));
const workRoot = path.join(repoRoot, "tmp", "gate-work", "p5", "l2-dense-visual");
const safeZone = { left: 64, top: 64, right: frameWidth - 64, bottom: frameHeight - 64 };
const backgroundPoints = [
  { x: 96, y: 96 },
  { x: 960, y: 72 },
  { x: 1824, y: 96 },
  { x: 96, y: 540 },
  { x: 1824, y: 540 },
  { x: 96, y: 984 },
  { x: 960, y: 1032 },
  { x: 1824, y: 984 }
];

function reusableFull8TypesCandidate() {
  const candidates = [
    {
      label: "l2-dense-visual",
      projectDir: path.join(workRoot, "full-8types"),
      output: path.join(workRoot, "videos", "full-8types.mp4")
    },
    {
      label: "l2-8-anchors",
      projectDir: path.join(repoRoot, "tmp", "gate-work", "p5", "l2-8-anchors", "full-8types"),
      output: path.join(repoRoot, "tmp", "gate-work", "p5", "l2-8-anchors", "videos", "full-8types.mp4")
    }
  ].map((candidate) => ({
    ...candidate,
    buildDir: path.join(candidate.projectDir, "build"),
    manifestPath: path.join(candidate.projectDir, "build", "render-manifest.json"),
    sceneSpecsPath: path.join(candidate.projectDir, "scene_specs.json")
  }));

  return candidates.find(
    (candidate) =>
      existsSync(candidate.projectDir) &&
      existsSync(candidate.buildDir) &&
      existsSync(candidate.manifestPath) &&
      existsSync(candidate.sceneSpecsPath) &&
      existsSync(candidate.output) &&
      statSync(candidate.output).size > 0
  ) ?? null;
}

function reusedCompileResult(candidate) {
  return {
    fixtureName: "full-8types",
    projectDir: candidate.projectDir,
    buildDir: candidate.buildDir,
    compile: {
      command: `reuse existing ${candidate.label} full-8types build`,
      exitCode: 0,
      signal: null,
      error: null,
      stdout: "",
      stderr: ""
    },
    result: {
      pass: true,
      buildDir: repoRel(candidate.buildDir)
    },
    reusedFrom: candidate.label
  };
}

function checkBboxes(rows) {
  const measured = rows.map((row) => {
    const rect = row.rect ?? {};
    const pass =
      row.exists === true &&
      rect.width > 0 &&
      rect.height > 0 &&
      rect.left >= safeZone.left &&
      rect.top >= safeZone.top &&
      rect.right <= safeZone.right &&
      rect.bottom <= safeZone.bottom &&
      row.style?.display !== "none" &&
      row.style?.visibility !== "hidden";
    return { ...row, pass };
  });
  return check(measured.every((row) => row.pass), "l2-3-subtitle-bbox-dense-safe-zone", {
    safeZone,
    scenesChecked: measured.length,
    failures: measured.filter((row) => !row.pass),
    rows: measured
  });
}

function checkOcr({ ocr, frameRows, specs, manifest }) {
  const scenes = new Map((specs.scenes ?? []).map((scene) => [scene.sceneId, scene]));
  const rows = (ocr.parsed?.frames ?? []).map((frame) => {
    const scene = scenes.get(frame.sceneId) ?? scenes.get(sceneForFrame(manifest, frame.frame)?.sceneId);
    const whitelist = scene ? sceneWhitelist(scene) : "";
    const terms = scene ? positiveTerms(scene) : [];
    const texts = Array.isArray(frame.texts) ? frame.texts : [];
    const normalizedTexts = texts
      .filter((item) => Number(item.confidence ?? 0) >= 0.15)
      .map((item) => normalizeOcrText(item.text))
      .filter(Boolean);
    const joined = normalizedTexts.join("");
    const positive = terms.some((term) => joined.includes(term) || term.includes(joined));
    const residual = normalizedTexts.filter((text) => {
      if (text.length < 2) return false;
      if (/^\d+$/.test(text)) return false;
      return !looksWhitelisted(text, whitelist);
    });
    return {
      frame: frame.frame,
      kind: frame.kind,
      sceneId: frame.sceneId,
      positiveTerms: terms,
      texts,
      normalizedTexts,
      positive,
      residual
    };
  });
  const expectedPositiveScenes = new Set((specs.scenes ?? []).map((scene) => scene.sceneId));
  const positiveScenes = new Set(rows.filter((row) => row.positive).map((row) => row.sceneId));
  const missingPositiveScenes = [...expectedPositiveScenes].filter((sceneId) => !positiveScenes.has(sceneId));
  const residualFailures = rows.filter((row) => row.kind === "representative" && row.residual.length > 0);
  return check(
    ocr.exitCode === 0 &&
      ocr.parsed?.ok === true &&
      missingPositiveScenes.length === 0 &&
      residualFailures.length === 0,
    "l2-4-ocr-positive-and-whitelist-residual",
    {
      method: "easyocr",
      command: ocr.command,
      exitCode: ocr.exitCode,
      stderr: ocr.stderr,
      framesRequested: frameRows.length,
      framesRead: rows.length,
      missingPositiveScenes,
      residualFailures,
      rows
    }
  );
}

function looksWhitelisted(text, whitelist) {
  if (whitelist.includes(text) || text.includes(whitelist)) return true;
  if (text.length === 0) return true;
  const chars = Array.from(text);
  const hits = chars.filter((char) => whitelist.includes(char)).length;
  return hits / chars.length >= 0.62;
}

function checkBackground({ pixel, tokens }) {
  const targetHex = tokens.colors.background;
  const targetRgb = hexToRgb(targetHex);
  const tolerance = 14;
  const rows = (pixel.parsed?.frames ?? []).map((frame) => {
    const samples = (frame.samples ?? []).map((sample) => {
      const distance = targetRgb ? rgbDistance(sample.rgb, targetRgb) : Number.POSITIVE_INFINITY;
      return {
        ...sample,
        distance,
        match: distance <= tolerance
      };
    });
    return {
      frame: frame.frame,
      kind: frame.kind,
      sceneId: frame.sceneId,
      matches: samples.filter((sample) => sample.match).length,
      samples
    };
  });
  return check(
    pixel.exitCode === 0 && pixel.parsed?.ok === true && rows.length > 0 && rows.every((row) => row.matches >= 1),
    "l2-5-background-hex-dense-pixels",
    {
      targetHex,
      tolerance,
      samplePoints: backgroundPoints,
      failures: rows.filter((row) => row.matches < 1),
      rows
    }
  );
}

async function runGate({ profile }) {
  const checks = [
    check(profile === "full", "profile-full-required", {
      profile,
      reason: "dense visual sampling renders full-8types and is intentionally full-profile only"
    })
  ];
  if (profile !== "full") {
    return { checks, inputSet: [self], evidence: stableEvidence(checks) };
  }

  const reusable = reusableFull8TypesCandidate();
  if (reusable) {
    resetDir(path.join(workRoot, "frames"));
  } else {
    resetDir(workRoot);
  }

  const compiled = reusable ? reusedCompileResult(reusable) : compileFixture("full-8types", workRoot);
  checks.push(
    check(compiled.compile.exitCode === 0 && compiled.result?.pass === true, "compile:full-8types", {
      command: compiled.compile.command,
      exitCode: compiled.compile.exitCode,
      reusedFrom: compiled.reusedFrom ?? null,
      buildDir: compiled.result?.buildDir ?? repoRel(compiled.buildDir),
      stderrTail: tail(compiled.compile.stderr, 2000)
    })
  );

  const evidencePaths = [];
  if (compiled.compile.exitCode === 0 && compiled.result?.pass === true) {
    const output = reusable?.output ?? path.join(workRoot, "videos", "full-8types.mp4");
    const render = reusable
      ? {
          command: `reuse existing ${reusable.label} full-8types render`,
          exitCode: 0,
          signal: null,
          stderr: ""
        }
      : renderBuild(compiled.buildDir, output, [], { timeout: 20 * 60 * 1000 });
    checks.push(
      check(render.exitCode === 0 && existsSync(output) && statSync(output).size > 0, "render:full-8types", {
        command: render.command,
        exitCode: render.exitCode,
        signal: render.signal,
        reusedFrom: reusable?.label ?? null,
        output: repoRel(output),
        bytes: existsSync(output) ? statSync(output).size : 0,
        stderrTail: tail(render.stderr, 4000)
      })
    );
    evidencePaths.push(repoRel(output));

    if (render.exitCode === 0 && existsSync(output)) {
      const manifest = readJson(path.join(compiled.buildDir, "render-manifest.json"));
      const specs = readJson(path.join(compiled.projectDir, "scene_specs.json"));
      const tokens = readJson(path.join(repoRoot, "fixtures", "presets", "light.json"));
      const dense = denseFrameSamples(manifest, { seed: 1208 });
      const representatives = representativeSceneSamples(manifest);
      const frameSamples = [...new Map([...dense, ...representatives].map((item) => [item.frame, item])).values()].sort(
        (a, b) => a.frame - b.frame
      );
      const frameRows = extractFrames(output, frameSamples, path.join(workRoot, "frames"));
      evidencePaths.push(...frameRows.filter((row) => row.exists).map((row) => row.relPath));

      checks.push(
        check(frameRows.every((row) => row.exitCode === 0 && row.exists && row.bytes > 0), "dense-frame-extraction", {
          requested: frameSamples.length,
          denseEverySec: 2,
          seededRandomPerScene: 1,
          frames: frameRows.map(({ path: _path, ...row }) => row),
          failures: frameRows.filter((row) => row.exitCode !== 0 || !row.exists || row.bytes <= 0)
        })
      );

      const bboxes = await measureSubtitleBboxes(compiled.buildDir, specs.scenes);
      checks.push(checkBboxes(bboxes.rows));

      const ocrRows = frameRows.filter((row) => row.exists && row.bytes > 0 && row.kind === "representative");
      const ocr = runEasyOcr(ocrRows);
      checks.push(checkOcr({ ocr, frameRows: ocrRows, specs, manifest }));

      const pixel = samplePixels(frameRows.filter((row) => row.exists && row.bytes > 0), backgroundPoints);
      checks.push(checkBackground({ pixel, tokens }));
    }
  }

  return {
    checks,
    inputSet: [
      self,
      "src/gates/p5-common.mjs",
      "fixtures/golden-specs/full-8types/scene_specs.json",
      "fixtures/golden-specs/full-8types/audio_meta.json",
      "fixtures/presets/light.json",
      "research/06-plan/VERIFICATION-PLAN.md",
      "research/08-audit/RESOLUTION.md"
    ],
    evidence: [...stableEvidence(checks), ...evidenceForPaths(evidencePaths)]
  };
}

main(runGate);

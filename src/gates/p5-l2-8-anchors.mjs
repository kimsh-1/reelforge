#!/usr/bin/env node
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  check,
  compileFixture,
  compareImagePairs,
  evidenceForPaths,
  extractFrame,
  ffprobeJson,
  main,
  readJson,
  renderBuild,
  repoRel,
  repoRoot,
  representativeSceneSamples,
  resetDir,
  sha256File,
  stableEvidence,
  tail
} from "./p5-common.mjs";

const self = repoRel(fileURLToPath(import.meta.url));
const workRoot = path.join(repoRoot, "tmp", "gate-work", "p5", "l2-8-anchors");
const anchorRoot = path.join(repoRoot, "fixtures", "anchors");
const anchorSetDir = path.join(anchorRoot, "full-8types");
const anchorsJsonPath = path.join(anchorRoot, "anchors.json");
const sourceSceneSpecsPath = path.join(repoRoot, "fixtures", "golden-specs", "full-8types", "scene_specs.json");
const expectedAnchorCount = 8;
const imageTolerance = {
  meanAbsDeltaMax: 1.5,
  rmsDeltaMax: 3,
  maxDeltaMax: 64
};

function isInside(child, parent) {
  return child === parent || child.startsWith(`${parent}${path.sep}`);
}

function expectedImageName(anchor) {
  if (!anchor?.sceneId || !Number.isInteger(anchor?.frame)) return null;
  return `${anchor.sceneId}-frame-${String(anchor.frame).padStart(6, "0")}.png`;
}

function expectedSceneIds() {
  return Array.from({ length: expectedAnchorCount }, (_item, index) => `s${String(index + 1).padStart(2, "0")}`);
}

function readAnchorJson() {
  try {
    return {
      anchorSet: readJson(anchorsJsonPath),
      error: null
    };
  } catch (error) {
    return {
      anchorSet: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function validateAnchorFiles() {
  const { anchorSet, error } = readAnchorJson();
  const checks = [
    check(anchorSet !== null, "anchors-json-readable", {
      path: repoRel(anchorsJsonPath),
      error
    })
  ];
  if (!anchorSet) {
    return {
      anchorSet: null,
      anchors: [],
      checks,
      evidencePaths: [repoRel(anchorsJsonPath)]
    };
  }

  const sourceSpecs = readJson(sourceSceneSpecsPath);
  const sourceScenes = new Map((sourceSpecs.scenes ?? []).map((scene) => [scene.sceneId, scene]));
  const anchors = Array.isArray(anchorSet.anchors) ? anchorSet.anchors : [];
  const anchorIds = anchors.map((anchor) => anchor.anchorId).filter(Boolean);
  const duplicateAnchorIds = anchorIds.filter((id, index) => anchorIds.indexOf(id) !== index);
  const sceneIds = anchors.map((anchor) => anchor.sceneId).filter(Boolean);
  const duplicateSceneIds = sceneIds.filter((id, index) => sceneIds.indexOf(id) !== index);
  const expectedScenes = expectedSceneIds();

  const rows = anchors.map((anchor, index) => {
    const imagePath = typeof anchor.imagePath === "string" ? anchor.imagePath : "";
    const absoluteImagePath = imagePath ? path.resolve(repoRoot, imagePath) : null;
    const expectedName = expectedImageName(anchor);
    const pathInsideAnchorSet = absoluteImagePath ? isInside(absoluteImagePath, anchorSetDir) : false;
    const pathMatchesName = Boolean(expectedName && absoluteImagePath && path.basename(absoluteImagePath) === expectedName);
    const exists = Boolean(absoluteImagePath && existsSync(absoluteImagePath));
    const actualBytes = exists ? statSync(absoluteImagePath).size : 0;
    const actualSha256 = exists ? sha256File(absoluteImagePath) : null;
    const sourceScene = sourceScenes.get(anchor.sceneId);
    const textMatches =
      sourceScene &&
      anchor.expectedText?.headline === sourceScene.headline &&
      JSON.stringify(anchor.expectedText?.items ?? []) === JSON.stringify(sourceScene.items ?? []) &&
      anchor.expectedText?.narration === sourceScene.narration;
    const pass =
      anchor.anchorId === `full-8types:${anchor.sceneId}:${anchor.frame}` &&
      anchor.label === "pass" &&
      anchor.fixture === "full-8types" &&
      Number.isInteger(anchor.frame) &&
      anchor.frame >= 0 &&
      anchor.timeSec === Number((anchor.frame / 30).toFixed(3)) &&
      pathInsideAnchorSet &&
      pathMatchesName &&
      exists &&
      anchor.bytes === actualBytes &&
      anchor.sha256 === actualSha256 &&
      actualBytes > 0 &&
      textMatches === true &&
      typeof anchor.criteria?.visualQuality === "string";
    return {
      index,
      anchorId: anchor.anchorId ?? null,
      sceneId: anchor.sceneId ?? null,
      frame: anchor.frame ?? null,
      imagePath,
      expectedName,
      pathInsideAnchorSet,
      pathMatchesName,
      exists,
      declaredBytes: anchor.bytes ?? null,
      actualBytes,
      declaredSha256: anchor.sha256 ?? null,
      actualSha256,
      textMatches: Boolean(textMatches),
      pass
    };
  });

  checks.push(
    check(
      anchorSet.version === "1.0.0" &&
        anchorSet.fixture === "full-8types" &&
        anchorSet.generatedBy === self &&
        anchorSet.representativeFramePolicy === "scene startFrame + floor(durationFrames * 0.52)" &&
        anchors.length === expectedAnchorCount &&
        JSON.stringify([...sceneIds].sort()) === JSON.stringify(expectedScenes),
      "anchors-json-contract",
      {
        version: anchorSet.version ?? null,
        fixture: anchorSet.fixture ?? null,
        generatedBy: anchorSet.generatedBy ?? null,
        sourceRender: anchorSet.sourceRender ?? null,
        representativeFramePolicy: anchorSet.representativeFramePolicy ?? null,
        anchorCount: anchors.length,
        expectedAnchorCount,
        sceneIds,
        expectedScenes
      }
    )
  );
  checks.push(
    check(
      anchors.length === expectedAnchorCount &&
        duplicateAnchorIds.length === 0 &&
        duplicateSceneIds.length === 0 &&
        rows.every((row) => row.pass),
      "anchor-image-files-match-json",
      {
        anchorDir: repoRel(anchorSetDir),
        duplicateAnchorIds,
        duplicateSceneIds,
        rows,
        failures: rows.filter((row) => !row.pass)
      }
    )
  );

  return {
    anchorSet,
    anchors,
    checks,
    evidencePaths: [
      repoRel(anchorsJsonPath),
      ...rows
        .filter((row) => row.exists && row.imagePath)
        .map((row) => row.imagePath)
    ]
  };
}

function inputSet() {
  return [
    self,
    "src/gates/p5-common.mjs",
    "fixtures/anchors/anchors.json",
    "fixtures/anchors/full-8types",
    "fixtures/golden-specs/full-8types/scene_specs.json",
    "fixtures/golden-specs/full-8types/audio_meta.json",
    "fixtures/presets/light.json",
    "research/06-plan/VERIFICATION-PLAN.md",
    "research/08-audit/RESOLUTION.md"
  ];
}

async function runGate({ profile }) {
  const anchorValidation = validateAnchorFiles();
  const checks = [...anchorValidation.checks];
  const evidencePaths = [...anchorValidation.evidencePaths];

  if (profile !== "full") {
    return {
      checks,
      inputSet: inputSet(),
      evidence: [...stableEvidence(checks), ...evidenceForPaths(evidencePaths)]
    };
  }

  if (checks.some((item) => item.pass !== true)) {
    return {
      checks,
      inputSet: inputSet(),
      evidence: [...stableEvidence(checks), ...evidenceForPaths(evidencePaths)]
    };
  }

  resetDir(workRoot);
  const compiled = compileFixture("full-8types", workRoot);
  checks.push(
    check(compiled.compile.exitCode === 0 && compiled.result?.pass === true, "compile:full-8types", {
      command: compiled.compile.command,
      exitCode: compiled.compile.exitCode,
      buildDir: compiled.result?.buildDir ?? repoRel(compiled.buildDir),
      stderrTail: tail(compiled.compile.stderr, 2000)
    })
  );

  if (compiled.compile.exitCode === 0 && compiled.result?.pass === true) {
    const output = path.join(workRoot, "videos", "full-8types.mp4");
    const render = renderBuild(compiled.buildDir, output, [], { timeout: 20 * 60 * 1000 });
    checks.push(
      check(render.exitCode === 0 && existsSync(output) && statSync(output).size > 0, "render:full-8types", {
        command: render.command,
        exitCode: render.exitCode,
        signal: render.signal,
        output: repoRel(output),
        bytes: existsSync(output) ? statSync(output).size : 0,
        stderrTail: tail(render.stderr, 4000)
      })
    );
    evidencePaths.push(repoRel(output));

    if (render.exitCode === 0 && existsSync(output)) {
      const manifest = readJson(path.join(compiled.buildDir, "render-manifest.json"));
      const samples = representativeSceneSamples(manifest);
      const anchorByKey = new Map(anchorValidation.anchors.map((anchor) => [`${anchor.sceneId}:${anchor.frame}`, anchor]));
      const rows = [];
      const pairs = [];
      for (const sample of samples) {
        const anchor = anchorByKey.get(`${sample.sceneId}:${sample.frame}`) ?? null;
        const extractedPath = path.join(
          workRoot,
          "reextracted",
          `${sample.sceneId}-frame-${String(sample.frame).padStart(6, "0")}.png`
        );
        const extracted = anchor ? extractFrame(output, sample.frame, extractedPath) : null;
        const extractedExists = existsSync(extractedPath);
        const row = {
          sceneId: sample.sceneId,
          frame: sample.frame,
          anchorId: anchor?.anchorId ?? null,
          anchorImagePath: anchor?.imagePath ?? null,
          extractedPath: repoRel(extractedPath),
          extractionExitCode: extracted?.exitCode ?? null,
          extractedExists,
          extractedBytes: extractedExists ? statSync(extractedPath).size : 0,
          stderrTail: tail(extracted?.stderr ?? "", 1000)
        };
        rows.push(row);
        if (anchor && extractedExists) {
          pairs.push({
            sceneId: sample.sceneId,
            frame: sample.frame,
            expectedPath: path.join(repoRoot, anchor.imagePath),
            actualPath: extractedPath,
            expectedRelPath: anchor.imagePath,
            actualRelPath: repoRel(extractedPath)
          });
          evidencePaths.push(repoRel(extractedPath));
        }
      }

      checks.push(
        check(
          samples.length === expectedAnchorCount &&
            rows.length === expectedAnchorCount &&
            rows.every((row) => row.anchorId && row.extractionExitCode === 0 && row.extractedExists && row.extractedBytes > 0),
          "full-reextract-anchor-frames",
          {
            representativeFramePolicy: anchorValidation.anchorSet.representativeFramePolicy,
            expectedAnchorCount,
            rows,
            failures: rows.filter(
              (row) => !row.anchorId || row.extractionExitCode !== 0 || !row.extractedExists || row.extractedBytes <= 0
            )
          }
        )
      );

      const compare = compareImagePairs(pairs);
      const compareRows = (compare.parsed?.pairs ?? []).map((row) => {
        const pass =
          row.expectedExists === true &&
          row.actualExists === true &&
          row.sameSize === true &&
          row.meanAbsDelta <= imageTolerance.meanAbsDeltaMax &&
          row.rmsDelta <= imageTolerance.rmsDeltaMax &&
          row.maxDelta <= imageTolerance.maxDeltaMax;
        return { ...row, pass };
      });
      checks.push(
        check(
          compare.exitCode === 0 &&
            compare.parsed?.ok === true &&
            compareRows.length === expectedAnchorCount &&
            compareRows.every((row) => row.pass),
          "full-reextract-matches-anchors",
          {
            command: compare.command,
            exitCode: compare.exitCode,
            stderr: compare.stderr,
            tolerance: imageTolerance,
            rows: compareRows,
            failures: compareRows.filter((row) => !row.pass)
          }
        )
      );

      const probe = ffprobeJson(output);
      const durationSec = Number.parseFloat(probe.parsed?.format?.duration ?? "NaN");
      checks.push(
        check(probe.result.exitCode === 0 && Number.isFinite(durationSec) && durationSec > 0, "ffprobe:source-render", {
          command: probe.result.command,
          exitCode: probe.result.exitCode,
          durationSec,
          streams: probe.parsed?.streams ?? null,
          stderrTail: tail(probe.result.stderr, 1000)
        })
      );
    }
  }

  return {
    checks,
    inputSet: inputSet(),
    evidence: [...stableEvidence(checks), ...evidenceForPaths(evidencePaths)]
  };
}

main(runGate);

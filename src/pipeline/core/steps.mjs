import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { compileProject, DEFAULT_PRESET } from "../../compiler/compiler.mjs";
import {
  formatAjvErrors,
  hashGateEvidence,
  requiredReportFields,
  schemaPathForName,
  validateJsonForSchema
} from "../../gates/registry.mjs";
import {
  formatSemanticViolations,
  validateSceneAudioSourceHashes,
  validateSemanticsForWrite
} from "../../gates/semantic.mjs";
import { hashPatterns, maxMtimeMs, outputsExist } from "./globs.mjs";
import {
  ensureDir,
  normalizeRelPath,
  readJsonFile,
  sha256File
} from "./io.mjs";
import { IMAGE_MANIFEST_FILE, isNonEmptyPngFile, runImagesStep } from "../images/index.mjs";
import { runTtsStep } from "../tts/index.mjs";

export const PIPELINE_STEP_ORDER = ["tts", "images", "compile", "render", "gate"];
export const PIPELINE_GATE_REPORT = "reports/pipeline-gate-report.json";

function gitCommit(repoRoot) {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function withProjectRootEnv(projectDir, callback) {
  const previous = process.env.VF_PROJECT_ROOTS;
  const roots = [previous, projectDir].filter(Boolean).join(path.delimiter);
  process.env.VF_PROJECT_ROOTS = roots;
  try {
    return callback();
  } finally {
    if (previous === undefined) delete process.env.VF_PROJECT_ROOTS;
    else process.env.VF_PROJECT_ROOTS = previous;
  }
}

function runCompileStep(ctx) {
  return withProjectRootEnv(ctx.projectDir, () =>
    compileProject({
      repoRoot: ctx.repoRoot,
      projectDir: ctx.projectDir,
      presetPath: DEFAULT_PRESET
    })
  );
}

function runRenderStep(ctx) {
  const outputPath = path.join(ctx.projectDir, "out", "main.mp4");
  ensureDir(path.dirname(outputPath));
  const hyperframesBin = path.join(ctx.repoRoot, "node_modules", ".bin", "hyperframes");
  const result = spawnSync(
    hyperframesBin,
    [
      "render",
      path.join(ctx.projectDir, "build"),
      "--output",
      outputPath,
      "--fps=30",
      "--quality=standard",
      "--workers=1",
      "--no-browser-gpu",
      "--browser-timeout=120",
      "--player-ready-timeout=120000"
    ],
    {
      cwd: ctx.repoRoot,
      encoding: "utf8",
      maxBuffer: 512 * 1024 * 1024
    }
  );
  const exitCode = result.status ?? (result.signal ? 128 : 1);
  if (exitCode !== 0) {
    throw new Error(`hyperframes render failed exitCode=${exitCode}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim());
  }
  return {
    output: normalizeRelPath(path.relative(ctx.projectDir, outputPath)),
    bytes: statSync(outputPath).size,
    stdoutTail: (result.stdout ?? "").slice(-2000)
  };
}

function validateContract({ repoRoot, projectDir, relPath, schemaName }) {
  const filePath = path.join(projectDir, relPath);
  if (!existsSync(filePath)) {
    return {
      id: `${schemaName}:exists`,
      pass: false,
      measured: { file: relPath, error: "missing" }
    };
  }

  const data = readJsonFile(filePath);
  const schema = validateJsonForSchema(repoRoot, data, schemaName);
  const semantic = validateSemanticsForWrite({ repoRoot, schemaName, data, targetPath: filePath });
  const errors = [
    ...formatAjvErrors(schema.errors ?? []),
    ...formatSemanticViolations(semantic.violations ?? [])
  ];
  return {
    id: `${schemaName}:valid`,
    pass: schema.pass && semantic.pass,
    measured: {
      file: relPath,
      schemaPath: schemaPathForName(schemaName),
      errors
    }
  };
}

function validateSceneAudioSourceHashContract({ repoRoot, projectDir }) {
  const sceneSpecsPath = path.join(projectDir, "scene_specs.json");
  const audioMetaPath = path.join(projectDir, "audio_meta.json");
  if (!existsSync(sceneSpecsPath) || !existsSync(audioMetaPath)) {
    return {
      id: "l0-12:scene-audio-sourcehash",
      pass: false,
      measured: {
        files: ["scene_specs.json", "audio_meta.json"],
        error: "missing required contract file"
      }
    };
  }

  const sceneSpecs = readJsonFile(sceneSpecsPath);
  const audioMeta = readJsonFile(audioMetaPath);
  const violations = validateSceneAudioSourceHashes({
    sceneSpecs,
    audioMeta,
    sceneSpecsFile: normalizeRelPath(path.relative(repoRoot, sceneSpecsPath)),
    audioMetaFile: normalizeRelPath(path.relative(repoRoot, audioMetaPath))
  });
  return {
    id: "l0-12:scene-audio-sourcehash",
    pass: violations.length === 0,
    measured: {
      files: ["scene_specs.json", "audio_meta.json"],
      violations
    }
  };
}

function writeProjectGateReport(ctx, report) {
  const reportPath = path.join(ctx.projectDir, PIPELINE_GATE_REPORT);
  mkdirSync(path.dirname(reportPath), { recursive: true });
  const tmpPath = `${reportPath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmpPath, `${JSON.stringify(report, null, 2)}\n`);
  renameSync(tmpPath, reportPath);
  return reportPath;
}

function runGateStep(ctx) {
  const startedAt = new Date().toISOString();
  const inputPatterns = [
    "scene_specs.json",
    "audio_meta.json",
    "versions.json",
    IMAGE_MANIFEST_FILE,
    "build/index.html",
    "build/render-manifest.json",
    "out/main.mp4",
    "repo:src/pipeline/core/**",
    "repo:src/pipeline/images/**",
    "repo:src/pipeline/tts/**",
    "repo:src/pipeline/versions-impl/**",
    "repo:src/compiler/**",
    "repo:blocks/**",
    `repo:${DEFAULT_PRESET}`,
    "repo:package.json"
  ];
  const input = hashPatterns({ repoRoot: ctx.repoRoot, projectDir: ctx.projectDir, patterns: inputPatterns });
  const renderOutput = path.join(ctx.projectDir, "out", "main.mp4");
  const checks = [
    validateContract({ repoRoot: ctx.repoRoot, projectDir: ctx.projectDir, relPath: "scene_specs.json", schemaName: "scene-specs" }),
    validateContract({ repoRoot: ctx.repoRoot, projectDir: ctx.projectDir, relPath: "audio_meta.json", schemaName: "audio-meta" }),
    validateSceneAudioSourceHashContract({ repoRoot: ctx.repoRoot, projectDir: ctx.projectDir }),
    validateContract({ repoRoot: ctx.repoRoot, projectDir: ctx.projectDir, relPath: "versions.json", schemaName: "versions" }),
    validateContract({ repoRoot: ctx.repoRoot, projectDir: ctx.projectDir, relPath: "build/render-manifest.json", schemaName: "render-manifest" }),
    {
      id: "render-output:exists",
      pass: existsSync(renderOutput) && statSync(renderOutput).isFile() && statSync(renderOutput).size > 0,
      measured: {
        file: "out/main.mp4",
        bytes: existsSync(renderOutput) ? statSync(renderOutput).size : 0
      }
    }
  ];
  const pass = checks.every((check) => check.pass === true);
  const report = {
    gate: "P3-pipeline",
    profile: ctx.profile,
    pass,
    checks,
    inputSet: input.entries.map((entry) => entry.path),
    canonicalInputMerkleHash: input.hash,
    evidenceHash: hashGateEvidence(checks),
    gateScriptHash: sha256File(path.join(ctx.repoRoot, "src", "pipeline", "core", "steps.mjs")),
    gitCommit: gitCommit(ctx.repoRoot),
    command: ctx.command,
    exitCode: pass ? 0 : 1,
    pipelineStepHashes: { ...(ctx.state.stepHashes ?? {}) },
    startedAt,
    finishedAt: new Date().toISOString()
  };
  const reportPath = writeProjectGateReport(ctx, report);
  if (!pass) throw new Error(`pipeline gate failed: ${normalizeRelPath(path.relative(ctx.projectDir, reportPath))}`);
  return {
    report: normalizeRelPath(path.relative(ctx.projectDir, reportPath)),
    checks: checks.length
  };
}

export function validPriorGateReport(ctx, step = null, inputHash = null) {
  const reportPath = path.join(ctx.projectDir, PIPELINE_GATE_REPORT);
  if (!existsSync(reportPath)) return false;
  try {
    const report = readJsonFile(reportPath);
    if (!requiredReportFields.every((field) => Object.prototype.hasOwnProperty.call(report, field))) return false;
    if (report.pass !== true || report.exitCode !== 0) return false;
    if (step && inputHash && report.pipelineStepHashes?.[step.id] !== inputHash) return false;
    const reportMtime = statSync(reportPath).mtimeMs;
    const inputMtime = maxMtimeMs({
      repoRoot: ctx.repoRoot,
      projectDir: ctx.projectDir,
      patterns: [
        "scene_specs.json",
        "audio_meta.json",
        "versions.json",
        IMAGE_MANIFEST_FILE,
        "build/**",
        "out/main.mp4",
        ...(Array.isArray(step?.inputs) ? step.inputs : [])
      ]
    });
    return reportMtime >= inputMtime;
  } catch {
    return false;
  }
}

export function defaultSkipWhen(ctx, step, inputHash) {
  if (ctx.force) return { skip: false, reason: "force" };
  const outputStatus = outputsExist({ repoRoot: ctx.repoRoot, projectDir: ctx.projectDir, patterns: step.outputs });
  if (!outputStatus.pass) return { skip: false, reason: "missing-outputs", missing: outputStatus.missing };
  const completed = ctx.state.completedSteps.includes(step.id);
  const unchanged = ctx.state.stepHashes[step.id] === inputHash;
  if (completed && unchanged) return { skip: true, reason: "resume-state" };
  if (validPriorGateReport(ctx, step, inputHash)) return { skip: true, reason: "validated-prior-gate" };
  return { skip: false, reason: completed ? "input-hash-changed" : "not-completed" };
}

function ttsRun(ctx) {
  return runTtsStep(ctx);
}

function imagesRun(ctx) {
  return runImagesStep(ctx);
}

function projectRelToAbs(projectDir, relPath) {
  return path.join(projectDir, String(relPath).replace(/^\.\//, ""));
}

function missingManifestAssets(ctx) {
  const manifestPath = path.join(ctx.projectDir, IMAGE_MANIFEST_FILE);
  if (!existsSync(manifestPath)) return [IMAGE_MANIFEST_FILE];
  let manifest;
  try {
    manifest = readJsonFile(manifestPath);
  } catch {
    return [IMAGE_MANIFEST_FILE];
  }

  return (manifest.assets ?? [])
    .map((asset) => asset?.path)
    .filter(Boolean)
    .filter((assetPath) => {
      const absolute = projectRelToAbs(ctx.projectDir, assetPath);
      return !isNonEmptyPngFile(absolute);
    })
    .map((assetPath) => normalizeRelPath(assetPath));
}

function imagesSkipWhen(ctx, step, inputHash) {
  const decision = defaultSkipWhen(ctx, step, inputHash);
  if (!decision.skip) return decision;
  const missing = missingManifestAssets(ctx);
  if (missing.length > 0) {
    return { skip: false, reason: "missing-manifest-assets", missing };
  }
  return decision;
}

export function createStepRegistry() {
  return [
    {
      id: "tts",
      inputs: ["scene_specs.json", "repo:src/pipeline/tts/**", "repo:src/pipeline/core/mock.mjs"],
      outputs: ["audio_meta.json", "assets/audio/*.mp3"],
      run: ttsRun,
      skipWhen: defaultSkipWhen
    },
    {
      id: "images",
      inputs: ["scene_specs.json", "design-tokens.json", "repo:src/pipeline/images/**"],
      outputs: ["versions.json", IMAGE_MANIFEST_FILE],
      run: imagesRun,
      skipWhen: imagesSkipWhen
    },
    {
      id: "compile",
      inputs: [
        "scene_specs.json",
        "audio_meta.json",
        "versions.json",
        "assets/audio/*.mp3",
        `repo:${DEFAULT_PRESET}`,
        "repo:src/compiler/**",
        "repo:blocks/**",
        "repo:package.json"
      ],
      outputs: ["build/index.html", "build/render-manifest.json", "build/scenes/*.html"],
      run: runCompileStep,
      skipWhen: defaultSkipWhen
    },
    {
      id: "render",
      inputs: ["build/**"],
      outputs: ["out/main.mp4"],
      run: runRenderStep,
      skipWhen: defaultSkipWhen
    },
    {
      id: "gate",
      inputs: [
        "scene_specs.json",
        "audio_meta.json",
        "versions.json",
        "build/**",
        "out/main.mp4",
        "repo:src/pipeline/core/**",
        "repo:src/pipeline/images/**",
        "repo:src/pipeline/tts/**",
        "repo:src/pipeline/versions-impl/**",
        "repo:src/compiler/**",
        "repo:blocks/**",
        `repo:${DEFAULT_PRESET}`,
        "repo:package.json"
      ],
      outputs: [PIPELINE_GATE_REPORT],
      run: runGateStep,
      skipWhen: defaultSkipWhen
    }
  ];
}

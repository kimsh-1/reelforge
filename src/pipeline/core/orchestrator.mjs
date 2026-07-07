import path from "node:path";
import { DirtyPipelineError, assertPipelineClean } from "../versions-impl/index.mjs";
import { hashPatterns, outputsExist } from "./globs.mjs";
import { normalizeRelPath } from "./io.mjs";
import {
  emptyPipelineState,
  loadPipelineState,
  markStepCompleted,
  markStepFailed,
  writePipelineState
} from "./state.mjs";
import { PIPELINE_STEP_ORDER, createStepRegistry } from "./steps.mjs";
import { resolveSelectedResource } from "./versions.mjs";

function selectedSteps({ steps, only, until }) {
  if (only && until) throw new Error("--only and --until cannot be used together");
  const byId = new Map(steps.map((step) => [step.id, step]));
  if (only) {
    if (!byId.has(only)) throw new Error(`unknown pipeline step: ${only}`);
    return [byId.get(only)];
  }
  const stop = until ?? steps.at(-1).id;
  if (!byId.has(stop)) throw new Error(`unknown pipeline step: ${stop}`);
  return steps.slice(0, steps.findIndex((step) => step.id === stop) + 1);
}

function assertStepOutputs(ctx, step) {
  const status = outputsExist({ repoRoot: ctx.repoRoot, projectDir: ctx.projectDir, patterns: step.outputs });
  if (!status.pass) {
    throw new Error(`step ${step.id} did not produce required outputs: ${status.missing.join(", ")}`);
  }
}

function formatResult(result) {
  if (!result || typeof result !== "object") return "";
  const fields = [];
  if (result.provider) fields.push(`provider=${result.provider}`);
  if (Number.isInteger(result.scenes)) fields.push(`scenes=${result.scenes}`);
  if (Number.isInteger(result.generated)) fields.push(`generated=${result.generated}`);
  if (Number.isInteger(result.reused)) fields.push(`reused=${result.reused}`);
  if (result.output) fields.push(`output=${result.output}`);
  if (result.manifest) fields.push(`manifest=${result.manifest}`);
  if (result.report) fields.push(`report=${result.report}`);
  if (Number.isInteger(result.bytes)) fields.push(`bytes=${result.bytes}`);
  return fields.length > 0 ? ` ${fields.join(" ")}` : "";
}

function isPendingStepError(error) {
  return Boolean(error && typeof error === "object" && error.pending === true);
}

function projectDisplayPath(projectDir, value) {
  if (!value) return null;
  const absolute = path.isAbsolute(value)
    ? value
    : path.resolve(projectDir, String(value).replace(/^\.\//, ""));
  const relative = path.relative(projectDir, absolute);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return normalizeRelPath(relative);
  }
  return normalizeRelPath(String(value));
}

function formatPendingResult(ctx, error) {
  const fields = [];
  if (Array.isArray(error.missing)) fields.push(`pending=${error.missing.length}`);
  const prompts = projectDisplayPath(ctx.projectDir, error.promptsPath);
  const results = projectDisplayPath(ctx.projectDir, error.resultsDir);
  if (prompts) fields.push(`prompts=${prompts}`);
  if (results) fields.push(`resultsDir=${results}`);
  return fields.length > 0 ? ` ${fields.join(" ")}` : "";
}

export function runPipeline({
  repoRoot,
  projectDir,
  profile = "mock",
  until = null,
  only = null,
  force = false,
  forceDirty = false,
  command = "vf pipeline run",
  log = (line) => console.log(line)
}) {
  if (!["mock", "real"].includes(profile)) throw new Error("--profile must be mock or real");
  const absoluteProjectDir = path.resolve(projectDir);
  try {
    assertPipelineClean({ projectDir: absoluteProjectDir, forceDirty, log });
  } catch (error) {
    if (error instanceof DirtyPipelineError) log(`pipeline: WARN ${error.message}`);
    throw error;
  }

  const steps = createStepRegistry();
  const planned = selectedSteps({ steps, only, until });
  const startedAt = new Date().toISOString();
  const priorState = force ? null : loadPipelineState(absoluteProjectDir);
  const state = priorState ?? emptyPipelineState(startedAt);
  if (force) {
    state.completedSteps = [];
    state.failedSteps = {};
    state.stepHashes = {};
    state.startedAt = startedAt;
  }
  state.finishedAt = null;

  const ctx = {
    repoRoot,
    projectDir: absoluteProjectDir,
    profile,
    force,
    command,
    state,
    resolveSelectedResource: (resourceType, fallbackPath = null) =>
      resolveSelectedResource({ projectDir: absoluteProjectDir, resourceType, fallbackPath })
  };

  writePipelineState({ repoRoot, projectDir: absoluteProjectDir, state });

  const events = [];
  log(`pipeline: START project=${normalizeRelPath(path.relative(repoRoot, absoluteProjectDir) || absoluteProjectDir)} profile=${profile} steps=${planned.map((step) => step.id).join(",")}`);

  for (const step of planned) {
    const input = hashPatterns({ repoRoot, projectDir: absoluteProjectDir, patterns: step.inputs });
    const skipDecision = step.skipWhen(ctx, step, input.hash);
    if (skipDecision.skip) {
      markStepCompleted(state, step.id, input.hash);
      writePipelineState({ repoRoot, projectDir: absoluteProjectDir, state });
      events.push({ step: step.id, action: "skip", reason: skipDecision.reason });
      log(`pipeline: SKIP ${step.id} reason=${skipDecision.reason} inputHash=${input.hash.slice(0, 12)}`);
      continue;
    }

    log(`pipeline: RUN ${step.id} reason=${skipDecision.reason} inputHash=${input.hash.slice(0, 12)}`);
    try {
      const result = step.run(ctx);
      assertStepOutputs(ctx, step);
      markStepCompleted(state, step.id, input.hash);
      writePipelineState({ repoRoot, projectDir: absoluteProjectDir, state });
      events.push({ step: step.id, action: "run", result });
      log(`pipeline: DONE ${step.id}${formatResult(result)}`);
    } catch (error) {
      if (isPendingStepError(error)) {
        state.completedSteps = state.completedSteps.filter((stepId) => stepId !== step.id);
        delete state.failedSteps[step.id];
        writePipelineState({ repoRoot, projectDir: absoluteProjectDir, state });
        events.push({ step: step.id, action: "pending", missing: error.missing ?? [] });
        log(`pipeline: WAIT ${step.id}${formatPendingResult(ctx, error)}`);
        log(`pipeline: WAIT completed=${state.completedSteps.filter((stepId) => PIPELINE_STEP_ORDER.includes(stepId)).join(",")}`);
        return {
          pass: false,
          pending: true,
          pendingStep: step.id,
          projectDir: absoluteProjectDir,
          profile,
          steps: events,
          state
        };
      }
      markStepFailed(state, step.id, error);
      writePipelineState({ repoRoot, projectDir: absoluteProjectDir, state });
      log(`pipeline: FAIL ${step.id} ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  state.finishedAt = new Date().toISOString();
  writePipelineState({ repoRoot, projectDir: absoluteProjectDir, state });
  log(`pipeline: PASS completed=${state.completedSteps.filter((stepId) => PIPELINE_STEP_ORDER.includes(stepId)).join(",")}`);

  return {
    pass: true,
    projectDir: absoluteProjectDir,
    profile,
    steps: events,
    state
  };
}

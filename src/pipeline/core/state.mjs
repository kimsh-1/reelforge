import { existsSync } from "node:fs";
import path from "node:path";
import { readJsonFile, writeJsonViaVf } from "./io.mjs";

export const PIPELINE_STATE_FILE = "pipeline_state.json";

export function statePath(projectDir) {
  return path.join(projectDir, PIPELINE_STATE_FILE);
}

export function emptyPipelineState(startedAt = new Date().toISOString()) {
  return {
    completedSteps: [],
    failedSteps: {},
    stepHashes: {},
    startedAt,
    finishedAt: null
  };
}

export function loadPipelineState(projectDir) {
  const filePath = statePath(projectDir);
  if (!existsSync(filePath)) return null;
  return readJsonFile(filePath);
}

export function markStepCompleted(state, stepId, inputHash) {
  state.completedSteps = state.completedSteps.filter((id) => id !== stepId);
  state.completedSteps.push(stepId);
  delete state.failedSteps[stepId];
  state.stepHashes[stepId] = inputHash;
}

export function markStepFailed(state, stepId, error) {
  state.completedSteps = state.completedSteps.filter((id) => id !== stepId);
  state.failedSteps[stepId] = {
    message: error instanceof Error ? error.message : String(error),
    at: new Date().toISOString()
  };
}

export function writePipelineState({ repoRoot, projectDir, state }) {
  return writeJsonViaVf({
    repoRoot,
    projectDir,
    filePath: statePath(projectDir),
    schemaName: "pipeline-state",
    data: state
  });
}

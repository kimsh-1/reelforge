import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { hashPatterns, outputsExist } from "../core/globs.mjs";
import {
  normalizeRelPath,
  readJsonFile,
  sha256File,
  sha256Json,
  writeJsonViaVf
} from "../core/io.mjs";
import { runPipeline } from "../core/orchestrator.mjs";
import { markStepCompleted } from "../core/state.mjs";
import { resolveSelectedResource } from "../core/versions.mjs";

export const VERSIONS_FILE = "versions.json";
export const SCENE_SPECS_RESOURCE = "scene_specs";

export class EditLockConflictError extends Error {
  constructor(message, lock = null) {
    super(message);
    this.name = "EditLockConflictError";
    this.lock = lock;
  }
}

export class DirtyPipelineError extends Error {
  constructor(message, versions = null) {
    super(message);
    this.name = "DirtyPipelineError";
    this.versions = versions;
  }
}

function assertResourceType(resourceType) {
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(resourceType)) {
    throw new Error(`invalid versions resource type: ${resourceType}`);
  }
}

function versionsPath(projectDir) {
  return path.join(projectDir, VERSIONS_FILE);
}

export function emptyVersions() {
  return {
    resources: {},
    editLock: null,
    dirty: false
  };
}

export function loadVersions(projectDir) {
  const filePath = versionsPath(projectDir);
  if (!existsSync(filePath)) return emptyVersions();
  const versions = readJsonFile(filePath);
  return normalizeVersions(versions);
}

function normalizeVersions(versions) {
  return {
    resources: versions?.resources ?? {},
    editLock: versions?.editLock ?? null,
    dirty: Boolean(versions?.dirty)
  };
}

function hasResources(versions) {
  return Object.keys(versions.resources ?? {}).length > 0;
}

function writeVersions({ repoRoot, projectDir, versions }) {
  const normalized = normalizeVersions(versions);
  if (!hasResources(normalized)) {
    throw new Error("versions.json must contain at least one resource before it can be written");
  }
  return writeJsonViaVf({
    repoRoot,
    projectDir,
    filePath: versionsPath(projectDir),
    schemaName: "versions",
    data: normalized
  });
}

function normalizeEntryPath(relPath) {
  const normalized = normalizeRelPath(relPath).replace(/^\.?\//, "");
  return `./${normalized}`;
}

function isPathInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveProjectPath(projectDir, value) {
  const resolved = path.isAbsolute(value) ? path.resolve(value) : path.resolve(projectDir, value);
  if (!isPathInside(projectDir, resolved)) {
    throw new Error(`path must stay inside projectDir: ${value}`);
  }
  return resolved;
}

function nextGen(entries) {
  const gens = entries
    .map((entry) => /^gen_(\d+)$/.exec(entry?.gen ?? ""))
    .filter(Boolean)
    .map((match) => match[1]);
  const width = Math.max(2, ...gens.map((digits) => digits.length));
  const max = gens.reduce((value, digits) => Math.max(value, Number(digits)), 0);
  return `gen_${String(max + 1).padStart(width, "0")}`;
}

function genNumber(gen) {
  const match = /^gen_(\d+)$/.exec(gen ?? "");
  return match ? Number(match[1]) : Number.NaN;
}

function entryForGen(history, gen) {
  return (history?.entries ?? []).find((entry) => entry?.gen === gen) ?? null;
}

function assertLockAvailable(versions, owner) {
  const lock = versions.editLock;
  if (!lock || lock.owner === owner) return;
  throw new EditLockConflictError(
    `versions editLock conflict: held by ${lock.owner}, requested by ${owner}`,
    lock
  );
}

function assertLockOwner(versions, owner) {
  const lock = versions.editLock;
  if (!lock) return;
  if (lock.owner !== owner) {
    throw new EditLockConflictError(
      `versions editLock conflict: held by ${lock.owner}, requested by ${owner}`,
      lock
    );
  }
}

function versionedTargetRelPath({ resourceType, gen, sourcePath, fileName }) {
  const basename = path.basename(fileName ?? sourcePath);
  return normalizeEntryPath(path.join("assets", "versions", resourceType, gen, basename));
}

function writeGenerationFile({ projectDir, relPath, bytes }) {
  const absolutePath = path.join(projectDir, relPath.replace(/^\.\//, ""));
  if (existsSync(absolutePath)) {
    throw new Error(`refusing to overwrite existing generation file: ${relPath}`);
  }
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, bytes, { flag: "wx" });
  return absolutePath;
}

function selectedResourceTypes(versions, resourceTypes) {
  const allTypes = Object.keys(versions.resources ?? {}).sort((a, b) => a.localeCompare(b));
  if (!resourceTypes) return allTypes;
  const requested = new Set(resourceTypes);
  return allTypes.filter((type) => requested.has(type));
}

export function snapshotResource({
  repoRoot,
  projectDir,
  resourceType,
  sourcePath,
  bytes = null,
  fileName = null,
  note = "resource snapshot",
  owner = null,
  dirty = null,
  select = true,
  createdAt = new Date().toISOString()
}) {
  assertResourceType(resourceType);
  if (!sourcePath && bytes === null) throw new Error("snapshotResource requires sourcePath or bytes");
  if (!sourcePath && !fileName) throw new Error("snapshotResource requires fileName when bytes are provided");

  const versions = loadVersions(projectDir);
  if (owner) assertLockAvailable(versions, owner);

  const history = versions.resources[resourceType] ?? { entries: [], selected: null };
  const entries = Array.isArray(history.entries) ? [...history.entries] : [];
  const gen = nextGen(entries);
  const sourceAbsolute = sourcePath ? resolveProjectPath(projectDir, sourcePath) : fileName;
  const relPath = versionedTargetRelPath({ resourceType, gen, sourcePath: sourceAbsolute, fileName });
  const payload = bytes === null ? readFileSync(sourceAbsolute) : Buffer.from(bytes);
  writeGenerationFile({ projectDir, relPath, bytes: payload });

  entries.push({
    gen,
    path: relPath,
    createdAt,
    note
  });
  versions.resources[resourceType] = {
    entries,
    selected: select ? gen : history.selected
  };
  if (owner) {
    versions.editLock = versions.editLock ?? { owner, acquiredAt: createdAt };
  }
  if (dirty !== null) versions.dirty = Boolean(dirty);

  writeVersions({ repoRoot, projectDir, versions });
  return {
    resourceType,
    gen,
    path: relPath,
    selected: versions.resources[resourceType].selected
  };
}

export function selectGeneration({ repoRoot, projectDir, resourceType, gen, owner = null }) {
  assertResourceType(resourceType);
  const versions = loadVersions(projectDir);
  if (owner) assertLockOwner(versions, owner);
  const history = versions.resources[resourceType];
  if (!history) throw new Error(`unknown versions resource: ${resourceType}`);
  if (!entryForGen(history, gen)) {
    throw new Error(`unknown generation for ${resourceType}: ${gen}`);
  }
  versions.resources[resourceType] = {
    entries: history.entries,
    selected: gen
  };
  writeVersions({ repoRoot, projectDir, versions });
  return resolveSelectedResource({ projectDir, resourceType });
}

export function rollbackGeneration({
  repoRoot,
  projectDir,
  resourceType,
  targetGen = null,
  owner = null,
  restorePath = null
}) {
  assertResourceType(resourceType);
  const versions = loadVersions(projectDir);
  if (owner) assertLockOwner(versions, owner);
  const history = versions.resources[resourceType];
  if (!history) throw new Error(`unknown versions resource: ${resourceType}`);

  const entries = [...(history.entries ?? [])].sort((a, b) => genNumber(a.gen) - genNumber(b.gen));
  const selected = history.selected;
  const selectedIndex = entries.findIndex((entry) => entry.gen === selected);
  const nextSelected = targetGen ?? (selectedIndex > 0 ? entries[selectedIndex - 1]?.gen : null);
  if (!nextSelected || !entryForGen(history, nextSelected)) {
    throw new Error(`no rollback target for ${resourceType} from ${selected}`);
  }

  const selectedEntry = selectGeneration({ repoRoot, projectDir, resourceType, gen: nextSelected, owner });
  if (restorePath) {
    const source = path.join(projectDir, selectedEntry.path.replace(/^\.\//, ""));
    const target = resolveProjectPath(projectDir, restorePath);
    writeFileSync(target, readFileSync(source));
  }
  return selectedEntry;
}

export function acquireEditLock({
  repoRoot,
  projectDir,
  owner,
  acquiredAt = new Date().toISOString()
}) {
  if (!owner) throw new Error("acquireEditLock requires owner");
  const versions = loadVersions(projectDir);
  assertLockAvailable(versions, owner);
  versions.editLock = { owner, acquiredAt };
  writeVersions({ repoRoot, projectDir, versions });
  return versions.editLock;
}

export function releaseEditLock({ repoRoot, projectDir, owner }) {
  if (!owner) throw new Error("releaseEditLock requires owner");
  const versions = loadVersions(projectDir);
  assertLockOwner(versions, owner);
  versions.editLock = null;
  writeVersions({ repoRoot, projectDir, versions });
  return null;
}

export function setDirty({ repoRoot, projectDir, dirty, owner = null }) {
  const versions = loadVersions(projectDir);
  if (owner) assertLockOwner(versions, owner);
  versions.dirty = Boolean(dirty);
  writeVersions({ repoRoot, projectDir, versions });
  return versions.dirty;
}

export function beforeSceneSpecsWrite({
  repoRoot,
  projectDir,
  owner,
  note = "scene_specs edit backup",
  createdAt = new Date().toISOString()
}) {
  if (!owner) throw new Error("beforeSceneSpecsWrite requires owner");
  const sceneSpecsPath = path.join(projectDir, "scene_specs.json");
  if (!existsSync(sceneSpecsPath)) {
    throw new Error("scene_specs.json must exist before safe edit backup");
  }
  return snapshotResource({
    repoRoot,
    projectDir,
    resourceType: SCENE_SPECS_RESOURCE,
    sourcePath: "scene_specs.json",
    note,
    owner,
    dirty: true,
    select: true,
    createdAt
  });
}

export function writeSceneSpecsWithBackup({
  repoRoot,
  projectDir,
  sceneSpecs,
  owner,
  note = "scene_specs edit backup"
}) {
  const backup = beforeSceneSpecsWrite({ repoRoot, projectDir, owner, note });
  const write = writeJsonViaVf({
    repoRoot,
    projectDir,
    filePath: path.join(projectDir, "scene_specs.json"),
    schemaName: "scene-specs",
    data: sceneSpecs
  });
  return { backup, write };
}

export function assertPipelineClean({
  projectDir,
  forceDirty = false,
  log = (line) => console.warn(line)
}) {
  const versionsFile = versionsPath(projectDir);
  if (!existsSync(versionsFile)) return { dirty: false, forced: false };
  const versions = loadVersions(projectDir);
  if (!versions.dirty) return { dirty: false, forced: false };

  const message = "versions.json dirty=true; rerun with --force-dirty after reconciling edits";
  if (!forceDirty) throw new DirtyPipelineError(message, versions);
  log(`pipeline: WARN ${message}`);
  return { dirty: true, forced: true };
}

export function runPipelineWithVersionGuard({
  repoRoot,
  projectDir,
  forceDirty = false,
  log = (line) => console.log(line),
  pipelineRunner = runPipeline,
  ...pipelineOptions
}) {
  if (pipelineRunner === runPipeline) {
    return pipelineRunner({
      repoRoot,
      projectDir,
      log,
      forceDirty,
      ...pipelineOptions
    });
  }

  assertPipelineClean({ projectDir, forceDirty, log });
  return pipelineRunner({
    repoRoot,
    projectDir,
    log,
    ...pipelineOptions
  });
}

export function selectedResourceSummary({ projectDir, resourceTypes = null }) {
  const versions = loadVersions(projectDir);
  const summary = [];
  for (const resourceType of selectedResourceTypes(versions, resourceTypes)) {
    const history = versions.resources[resourceType];
    const selected = history?.selected ?? null;
    const entry = selected ? entryForGen(history, selected) : null;
    const relPath = entry?.path ? normalizeEntryPath(entry.path) : null;
    const absolutePath = relPath ? path.join(projectDir, relPath.replace(/^\.\//, "")) : null;
    summary.push({
      resourceType,
      selected,
      path: relPath,
      sha256: absolutePath && existsSync(absolutePath) ? sha256File(absolutePath) : null
    });
  }
  return summary;
}

export function hashPatternsWithSelected({
  repoRoot,
  projectDir,
  patterns,
  resourceTypes = null
}) {
  const input = hashPatterns({ repoRoot, projectDir, patterns });
  const selected = selectedResourceSummary({ projectDir, resourceTypes });
  const entries = [
    ...input.entries,
    ...selected.map((item) => ({
      path: `versions:selected:${item.resourceType}`,
      type: "selected-resource",
      selected: item.selected,
      resourcePath: item.path,
      sha256: item.sha256
    }))
  ];
  return {
    entries,
    hash: sha256Json(entries),
    selected
  };
}

export function selectedAwareSkipDecision({
  repoRoot,
  projectDir,
  state,
  step,
  force = false,
  resourceTypes = null
}) {
  const input = hashPatternsWithSelected({
    repoRoot,
    projectDir,
    patterns: step.inputs,
    resourceTypes
  });
  if (force) return { skip: false, reason: "force", input };

  const outputStatus = step.outputs
    ? outputsExist({ repoRoot, projectDir, patterns: step.outputs })
    : { pass: true, missing: [] };
  if (!outputStatus.pass) {
    return { skip: false, reason: "missing-outputs", missing: outputStatus.missing, input };
  }

  const completed = state.completedSteps?.includes(step.id);
  const unchanged = state.stepHashes?.[step.id] === input.hash;
  if (completed && unchanged) return { skip: true, reason: "resume-state-selected", input };
  return {
    skip: false,
    reason: completed ? "selected-input-hash-changed" : "not-completed",
    input
  };
}

export function markSelectedAwareStepCompleted({
  repoRoot,
  projectDir,
  state,
  step,
  resourceTypes = null
}) {
  const input = hashPatternsWithSelected({
    repoRoot,
    projectDir,
    patterns: step.inputs,
    resourceTypes
  });
  markStepCompleted(state, step.id, input.hash);
  return input;
}

#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PATCH_FIELDS } from "../../src/studio/panel/form.js";
import { resolveSchema, sceneSchema } from "../../src/studio/panel/schema-loader.js";
import { startStudioServer } from "../../src/studio/server/index.mjs";
import { evidenceForPaths, main, readJson, repoRel, repoRoot } from "./helpers.mjs";
import {
  makeTempProject,
  requestJson,
  studioServerInputSet,
  waitForJob
} from "./p4-studio-helpers.mjs";

const self = repoRel(fileURLToPath(import.meta.url));
const e2TopLevelFields = new Set(["narration", "narration_tts"]);

function own(value, key) {
  return value !== null && typeof value === "object" && Object.hasOwn(value, key);
}

function valueAt(target, fieldPath) {
  return fieldPath.reduce((node, key) => (node && own(node, key) ? node[key] : undefined), target);
}

function setAt(target, fieldPath, value) {
  let node = target;
  for (let index = 0; index < fieldPath.length - 1; index += 1) {
    const key = fieldPath[index];
    if (!node[key] || typeof node[key] !== "object") node[key] = {};
    node = node[key];
  }
  node[fieldPath.at(-1)] = value;
}

function schemaForPath(rootSchema, fieldPath) {
  let schema = sceneSchema(rootSchema);
  for (const segment of fieldPath) {
    schema = resolveSchema(schema, rootSchema);
    schema = resolveSchema(schema.properties?.[segment] ?? {}, rootSchema);
  }
  return resolveSchema(schema, rootSchema);
}

function enumerateEditableLeafPaths(rootSchema) {
  const rootSceneSchema = sceneSchema(rootSchema);
  const paths = [];

  function walk(fieldPath, rawSchema) {
    const resolved = resolveSchema(rawSchema, rootSchema);
    if (Array.isArray(resolved.enum) || resolved.type === "array" || !resolved.properties) {
      paths.push(fieldPath);
      return;
    }
    for (const [key, childSchema] of Object.entries(resolved.properties)) {
      walk([...fieldPath, key], childSchema);
    }
  }

  for (const [key, rawSchema] of Object.entries(rootSceneSchema.properties ?? {})) {
    if (!PATCH_FIELDS.has(key)) continue;
    walk([key], rawSchema);
  }

  return paths.sort((left, right) => {
    const leftE2 = e2TopLevelFields.has(left[0]) ? 1 : 0;
    const rightE2 = e2TopLevelFields.has(right[0]) ? 1 : 0;
    return leftE2 - rightE2 || left.join(".").localeCompare(right.join("."));
  });
}

function enumNext(schema, current) {
  const candidates = schema.enum ?? [];
  return candidates.find((candidate) => JSON.stringify(candidate) !== JSON.stringify(current)) ?? candidates[0];
}

function numericValue(schema, current, index) {
  const min = Number.isFinite(schema.minimum) ? schema.minimum : 0;
  const max = Number.isFinite(schema.maximum) ? schema.maximum : min + 100;
  const candidate = Math.min(max, min + ((index % 9) + 1));
  if (candidate !== current) return candidate;
  return Math.min(max, candidate + 1);
}

function stringValue(fieldPath, index) {
  const name = fieldPath.join(".");
  if (name.includes("narration")) return `U2 narration ${index}.`;
  if (name === "caption") return `U2 caption ${index}`;
  if (name === "headline") return `U2 headline ${index}`;
  if (name === "source") return `u2-source-${index}`;
  if (name === "unit") return `u${index}`;
  if (name.endsWith("prompt")) return `U2 prompt ${index}`;
  if (name === "altText") return `U2 accessible alternate text ${index}`;
  return `U2 ${name} ${index}`;
}

function nextLeafValue({ rootSchema, fieldPath, current, index }) {
  const schema = schemaForPath(rootSchema, fieldPath);
  if (Array.isArray(schema.enum)) return enumNext(schema, current);
  if (schema.type === "boolean") return !Boolean(current);
  if (schema.type === "number" || schema.type === "integer") return numericValue(schema, current, index);
  if (schema.type === "array") {
    if (fieldPath.at(-1) === "values") return [index + 1, `v${index}`];
    return [`U2 item ${index}`];
  }
  return stringValue(fieldPath, index);
}

function baseObjectFor(topLevel, current) {
  if (current && typeof current === "object" && !Array.isArray(current)) return structuredClone(current);
  if (topLevel === "imageAsset") {
    return { prompt: "U2 prompt base", placement: "center" };
  }
  if (topLevel === "kenBurns") {
    return {
      enabled: false,
      zoomFactor: 1,
      zoomDirection: "in",
      panDirection: "none"
    };
  }
  if (topLevel === "overrides") return {};
  return {};
}

function patchForPath({ rootSchema, scene, fieldPath, index }) {
  const topLevel = fieldPath[0];
  const currentLeaf = valueAt(scene, fieldPath);
  const nextValue = nextLeafValue({ rootSchema, fieldPath, current: currentLeaf, index });
  if (fieldPath.length === 1) {
    return {
      fields: { [topLevel]: nextValue },
      expectedValue: nextValue
    };
  }

  const topLevelValue = baseObjectFor(topLevel, scene[topLevel]);
  setAt(topLevelValue, fieldPath.slice(1), nextValue);
  return {
    fields: { [topLevel]: topLevelValue },
    expectedValue: nextValue
  };
}

function expectedClass(fieldPath) {
  return e2TopLevelFields.has(fieldPath[0]) ? "E2" : "E1";
}

async function runSweepGroup({ studio, rootSchema, paths, specsHash, projectDir, sceneId }) {
  const rows = [];
  const compileJobIds = new Set();
  let currentHash = specsHash;

  for (const fieldPath of paths) {
    const projectBefore = await requestJson(studio.url, "GET", "/api/project");
    const scene = projectBefore.payload?.specs?.scenes?.find((candidate) => candidate.sceneId === sceneId);
    currentHash = projectBefore.payload?.specsHash ?? currentHash;
    const patch = patchForPath({ rootSchema, scene, fieldPath, index: rows.length + 1 });
    const response = await requestJson(
      studio.url,
      "PATCH",
      `/api/scenes/${sceneId}`,
      { fields: patch.fields },
      { "if-match": currentHash }
    );
    const projectAfter = await requestJson(studio.url, "GET", "/api/project");
    const savedScene = projectAfter.payload?.specs?.scenes?.find((candidate) => candidate.sceneId === sceneId);
    const savedValue = valueAt(savedScene, fieldPath);
    const classExpected = expectedClass(fieldPath);
    const classPass = response.status === 200 && response.payload?.class === classExpected;
    const savedPass = JSON.stringify(savedValue) === JSON.stringify(patch.expectedValue);
    if (response.payload?.compileJob?.id) compileJobIds.add(response.payload.compileJob.id);
    rows.push({
      field: fieldPath.join("."),
      status: response.status,
      expectedClass: classExpected,
      actualClass: response.payload?.class ?? null,
      changedFields: response.payload?.changedFields ?? [],
      specsHash: response.payload?.specsHash ?? null,
      savedPass,
      savedValue,
      expectedValue: patch.expectedValue,
      pass: classPass && savedPass
    });
    currentHash = projectAfter.payload?.specsHash ?? response.payload?.specsHash ?? currentHash;
  }

  const compileJobs = [];
  for (const jobId of compileJobIds) {
    compileJobs.push(await waitForJob(studio.url, jobId));
  }

  return {
    rows,
    compileJobs,
    finalSpecsPath: path.join(projectDir, "scene_specs.json")
  };
}

async function runGate() {
  const workspace = makeTempProject("minimal-3scene", "reelforge-u2-sweep-");
  let studio = null;
  const checks = [];
  const evidencePaths = [];

  try {
    const rootSchema = JSON.parse(readFileSync(path.join(repoRoot, "schemas", "scene-specs.schema.json"), "utf8"));
    const editablePaths = enumerateEditableLeafPaths(rootSchema);
    checks.push({
      id: "schema-editable-fields-enumerated",
      pass: editablePaths.length > 0 && editablePaths.every((fieldPath) => PATCH_FIELDS.has(fieldPath[0])),
      measured: {
        count: editablePaths.length,
        fields: editablePaths.map((fieldPath) => fieldPath.join("."))
      }
    });

    studio = await startStudioServer({
      repoRoot,
      projectDir: workspace.projectDir,
      port: 0,
      log: null
    });
    const project = await requestJson(studio.url, "GET", "/api/project");
    const sceneId = "s01";
    const e1Paths = editablePaths.filter((fieldPath) => !e2TopLevelFields.has(fieldPath[0]));
    const e2Paths = editablePaths.filter((fieldPath) => e2TopLevelFields.has(fieldPath[0]));
    const e1 = await runSweepGroup({
      studio,
      rootSchema,
      paths: e1Paths,
      specsHash: project.payload?.specsHash,
      projectDir: workspace.projectDir,
      sceneId
    });
    const e1JobsPass = e1.compileJobs.every((job) => job.status === "succeeded");
    checks.push({
      id: "rest-patch-e1-fields-class-and-persistence",
      pass: e1.rows.every((row) => row.pass),
      measured: {
        count: e1.rows.length,
        failures: e1.rows.filter((row) => !row.pass)
      }
    });
    checks.push({
      id: "e1-compile-jobs-succeeded",
      pass: e1JobsPass,
      measured: {
        jobs: e1.compileJobs.map((job) => ({
          id: job.id,
          status: job.status,
          error: job.error ?? null
        }))
      }
    });

    const afterE1 = await requestJson(studio.url, "GET", "/api/project");
    const e2 = await runSweepGroup({
      studio,
      rootSchema,
      paths: e2Paths,
      specsHash: afterE1.payload?.specsHash,
      projectDir: workspace.projectDir,
      sceneId
    });
    checks.push({
      id: "rest-patch-e2-fields-class-and-persistence",
      pass: e2.rows.every((row) => row.pass),
      measured: {
        count: e2.rows.length,
        failures: e2.rows.filter((row) => !row.pass)
      }
    });

    const finalSpecs = readJson(path.join(workspace.projectDir, "scene_specs.json"));
    const finalScene = finalSpecs.scenes.find((scene) => scene.sceneId === sceneId);
    checks.push({
      id: "final-scene-specs-readable-after-sweep",
      pass: Boolean(finalScene),
      measured: {
        sceneId,
        headline: finalScene?.headline ?? null,
        narration_tts: finalScene?.narration_tts ?? null
      }
    });

    const evidencePath = path.join(repoRoot, "tmp", "gate-work", "u2-studio-form-sweep", "evidence.json");
    mkdirSync(path.dirname(evidencePath), { recursive: true });
    writeFileSync(
      evidencePath,
      `${JSON.stringify(
        {
          sceneId,
          editableFields: editablePaths.map((fieldPath) => fieldPath.join(".")),
          e1Rows: e1.rows,
          e2Rows: e2.rows,
          compileJobs: e1.compileJobs.map((job) => ({
            id: job.id,
            status: job.status,
            error: job.error ?? null
          }))
        },
        null,
        2
      )}\n`
    );
    if (existsSync(evidencePath)) evidencePaths.push(repoRel(evidencePath));
  } finally {
    studio?.close();
    workspace.cleanup();
  }

  return {
    checks,
    inputSet: [
      self,
      "tests/gate-wrappers/p4-studio-helpers.mjs",
      ...studioServerInputSet
    ],
    evidence: evidenceForPaths(evidencePaths)
  };
}

main(runGate);

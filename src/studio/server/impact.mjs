export const SCENE_FIELD_ALLOWLIST = new Set([
  "narration",
  "narration_tts",
  "altText",
  "caption",
  "layout",
  "mood",
  "reveal",
  "emphasis",
  "headline",
  "items",
  "values",
  "unit",
  "source",
  "visual_kind",
  "imageAsset",
  "kenBurns",
  "subtitleMode",
  "ost",
  "overrides"
]);

const E1_FIELDS = new Set([
  "narration",
  "altText",
  "caption",
  "layout",
  "mood",
  "reveal",
  "emphasis",
  "headline",
  "items",
  "values",
  "unit",
  "source",
  "visual_kind",
  "imageAsset",
  "kenBurns",
  "subtitleMode",
  "ost",
  "overrides"
]);

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function changedSceneFields(beforeScene, afterScene, candidateFields) {
  return candidateFields
    .filter((field) => !jsonEqual(beforeScene?.[field], afterScene?.[field]))
    .sort((a, b) => a.localeCompare(b));
}

export function sceneStructureChanged(beforeSpecs, afterSpecs) {
  const beforeIds = (beforeSpecs?.scenes ?? []).map((scene) => scene?.sceneId);
  const afterIds = (afterSpecs?.scenes ?? []).map((scene) => scene?.sceneId);
  if (beforeIds.length !== afterIds.length) return true;
  return beforeIds.some((sceneId, index) => sceneId !== afterIds[index]);
}

export function classifyStudioImpact({ beforeSpecs, afterSpecs, changedFields = [], transitionsChanged = false }) {
  if (transitionsChanged || sceneStructureChanged(beforeSpecs, afterSpecs)) {
    return {
      class: "E3",
      actions: ["compile:full"],
      reason: transitionsChanged ? "transitions changed" : "scene structure changed"
    };
  }

  if (changedFields.includes("narration_tts")) {
    return {
      class: "E2",
      actions: ["pipeline:tts", "compile:full"],
      reason: "narration_tts sourceHash changed"
    };
  }

  const e1Fields = changedFields.filter((field) => E1_FIELDS.has(field));
  return {
    class: "E1",
    actions: e1Fields.length > 0 ? ["compile:scene"] : [],
    reason: e1Fields.length > 0 ? "scene presentation fields changed" : "no material field change"
  };
}

export function assertAllowedSceneFields(fields) {
  const invalid = Object.keys(fields ?? {}).filter((field) => !SCENE_FIELD_ALLOWLIST.has(field));
  if (invalid.length > 0) {
    const error = new Error(`unsupported scene fields: ${invalid.sort((a, b) => a.localeCompare(b)).join(", ")}`);
    error.statusCode = 400;
    throw error;
  }
}

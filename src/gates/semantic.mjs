import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function pointerSegment(value) {
  return String(value).replace(/~/g, "~0").replace(/\//g, "~1");
}

function normalizeRelPath(value) {
  return value.split(path.sep).join("/");
}

function repoRelative(repoRoot, absolutePath) {
  return normalizeRelPath(path.relative(repoRoot, absolutePath));
}

function violation(file, path, rule, measured = {}) {
  return { file, path, rule, measured };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sortedUnique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function sameStringSet(left, right) {
  const a = sortedUnique(left);
  const b = sortedUnique(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function readJsonFile(absolutePath) {
  return JSON.parse(readFileSync(absolutePath, "utf8"));
}

function collectSceneIds(file, data, arrayPath, violations) {
  const scenes = Array.isArray(data?.scenes) ? data.scenes : [];
  const seen = new Map();
  const ids = [];

  scenes.forEach((scene, index) => {
    const sceneId = scene?.sceneId;
    if (typeof sceneId !== "string") return;
    ids.push(sceneId);
    const currentPath = `${arrayPath}/${index}/sceneId`;
    const firstPath = seen.get(sceneId);
    if (firstPath) {
      violations.push(
        violation(file, currentPath, "sceneId must be unique", {
          sceneId,
          firstPath
        })
      );
    } else {
      seen.set(sceneId, currentPath);
    }
  });

  return new Set(ids);
}

function validateTransitions(file, data, sceneIds, violations) {
  const transitions = Array.isArray(data?.transitions) ? data.transitions : [];
  transitions.forEach((transition, index) => {
    const basePath = `/transitions/${index}`;
    const from = transition?.from;
    const to = transition?.to;

    if (typeof from === "string" && typeof to === "string" && from === to) {
      violations.push(
        violation(file, `${basePath}/to`, "transition must not be a self-loop", {
          from,
          to
        })
      );
    }
    if (typeof from === "string" && !sceneIds.has(from)) {
      violations.push(
        violation(file, `${basePath}/from`, "transition.from must reference an existing sceneId", {
          from
        })
      );
    }
    if (typeof to === "string" && !sceneIds.has(to)) {
      violations.push(
        violation(file, `${basePath}/to`, "transition.to must reference an existing sceneId", {
          to
        })
      );
    }
  });
}

function validateWords(file, words, basePath, violations, durationSec = null) {
  if (!Array.isArray(words)) return;

  let previousEnd = null;
  words.forEach((word, index) => {
    const start = word?.start;
    const end = word?.end;
    const wordPath = `${basePath}/${index}`;
    if (typeof start !== "number" || typeof end !== "number") return;

    if (end < start) {
      violations.push(
        violation(file, `${wordPath}/end`, "word timing end must be greater than or equal to start", {
          start,
          end
        })
      );
    }
    if (previousEnd !== null && start < previousEnd) {
      violations.push(
        violation(file, `${wordPath}/start`, "word timings must be monotonic by previous end", {
          previousEnd,
          start
        })
      );
    }
    if (typeof durationSec === "number" && Number.isFinite(durationSec) && end > durationSec) {
      violations.push(
        violation(file, `${wordPath}/end`, "word timing end must not exceed audioDurationSec", {
          audioDurationSec: durationSec,
          end
        })
      );
    }
    previousEnd = end;
  });
}

function validateSceneSpecs(file, data) {
  const violations = [];
  const sceneIds = collectSceneIds(file, data, "/scenes", violations);
  validateTransitions(file, data, sceneIds, violations);
  return violations;
}

function validateAudioMeta(file, data) {
  const violations = [];
  collectSceneIds(file, data, "/scenes", violations);

  const scenes = Array.isArray(data?.scenes) ? data.scenes : [];
  scenes.forEach((scene, index) => {
    validateWords(file, scene?.words, `/scenes/${index}/words`, violations, scene?.audioDurationSec);
  });

  return violations;
}

function validateVersions(file, data) {
  const violations = [];
  const resources = isObject(data?.resources) ? data.resources : {};

  for (const [resourceType, history] of Object.entries(resources)) {
    const basePath = `/resources/${pointerSegment(resourceType)}`;
    const entries = Array.isArray(history?.entries) ? history.entries : [];
    const entryGens = new Set();

    entries.forEach((entry, index) => {
      const gen = entry?.gen;
      if (typeof gen !== "string") return;
      if (entryGens.has(gen)) {
        violations.push(
          violation(file, `${basePath}/entries/${index}/gen`, "versions entries gen must be unique per resource", {
            resourceType,
            gen
          })
        );
      }
      entryGens.add(gen);
    });

    const selected = history?.selected;
    if (selected !== null && selected !== undefined && typeof selected === "string" && !entryGens.has(selected)) {
      violations.push(
        violation(file, `${basePath}/selected`, "versions selected must reference an entry gen", {
          resourceType,
          selected,
          entries: [...entryGens].sort((a, b) => a.localeCompare(b))
        })
      );
    }
  }

  return violations;
}

function validateRenderManifest(file, data) {
  const violations = [];
  const sceneIds = collectSceneIds(file, data, "/scenes", violations);
  validateTransitions(file, data, sceneIds, violations);

  const fps = data?.meta?.fps;
  const scenes = Array.isArray(data?.scenes) ? data.scenes : [];
  let previousStartFrame = null;

  scenes.forEach((scene, sceneIndex) => {
    const scenePath = `/scenes/${sceneIndex}`;
    const startFrame = scene?.startFrame;
    if (Number.isInteger(startFrame)) {
      if (previousStartFrame !== null && startFrame < previousStartFrame) {
        violations.push(
          violation(file, `${scenePath}/startFrame`, "render scene startFrame must be monotonic", {
            previousStartFrame,
            startFrame
          })
        );
      }
      previousStartFrame = startFrame;
    }

    const audioDurationSec = scene?.audioDurationSec;
    const durationFrames = scene?.durationFrames;
    if (
      typeof fps === "number" &&
      Number.isFinite(fps) &&
      typeof audioDurationSec === "number" &&
      Number.isFinite(audioDurationSec) &&
      Number.isInteger(durationFrames)
    ) {
      const expected = Math.ceil(audioDurationSec * fps);
      if (durationFrames !== expected) {
        violations.push(
          violation(file, `${scenePath}/durationFrames`, "durationFrames must equal ceil(audioDurationSec * fps)", {
            fps,
            audioDurationSec,
            durationFrames,
            expected
          })
        );
      }
    }

    const subtitles = Array.isArray(scene?.subtitles) ? scene.subtitles : [];
    subtitles.forEach((subtitle, subtitleIndex) => {
      const subtitlePath = `${scenePath}/subtitles/${subtitleIndex}`;
      const startSec = subtitle?.startSec;
      const endSec = subtitle?.endSec;
      if (typeof startSec === "number" && typeof endSec === "number" && endSec < startSec) {
        violations.push(
          violation(file, `${subtitlePath}/endSec`, "subtitle endSec must be greater than or equal to startSec", {
            startSec,
            endSec
          })
        );
      }
      if (
        typeof audioDurationSec === "number" &&
        Number.isFinite(audioDurationSec) &&
        typeof endSec === "number" &&
        endSec > audioDurationSec
      ) {
        violations.push(
          violation(file, `${subtitlePath}/endSec`, "subtitle endSec must not exceed scene audioDurationSec", {
            audioDurationSec,
            endSec
          })
        );
      }
      validateWords(file, subtitle?.words, `${subtitlePath}/words`, violations, audioDurationSec);
    });
  });

  return violations;
}

export function validateSemanticData({ schemaName, data, file }) {
  if (schemaName === "scene-specs") return validateSceneSpecs(file, data);
  if (schemaName === "audio-meta") return validateAudioMeta(file, data);
  if (schemaName === "versions") return validateVersions(file, data);
  if (schemaName === "render-manifest") return validateRenderManifest(file, data);
  return [];
}

export function validateSceneAudioSetMatch({ sceneSpecs, audioMeta, sceneSpecsFile, audioMetaFile }) {
  const sceneIds = Array.isArray(sceneSpecs?.scenes)
    ? sceneSpecs.scenes.map((scene) => scene?.sceneId).filter((sceneId) => typeof sceneId === "string")
    : [];
  const audioIds = Array.isArray(audioMeta?.scenes)
    ? audioMeta.scenes.map((scene) => scene?.sceneId).filter((sceneId) => typeof sceneId === "string")
    : [];

  if (sameStringSet(sceneIds, audioIds)) return [];

  return [
    violation(sceneSpecsFile, "/scenes", "audio_meta sceneId set must match scene_specs sceneId set", {
      sceneSpecsFile,
      audioMetaFile,
      sceneSpecsOnly: sortedUnique(sceneIds).filter((sceneId) => !new Set(audioIds).has(sceneId)),
      audioMetaOnly: sortedUnique(audioIds).filter((sceneId) => !new Set(sceneIds).has(sceneId))
    })
  ];
}

function findSiblingFile(dir, candidates) {
  return candidates.map((candidate) => path.join(dir, candidate)).find((candidate) => existsSync(candidate)) ?? null;
}

export function validateSemanticsForWrite({ repoRoot, schemaName, data, targetPath }) {
  const file = repoRelative(repoRoot, targetPath);
  const violations = [...validateSemanticData({ schemaName, data, file })];

  if (schemaName !== "scene-specs" && schemaName !== "audio-meta") {
    return { pass: violations.length === 0, violations };
  }

  const dir = path.dirname(targetPath);
  const sceneSpecsPath =
    schemaName === "scene-specs" ? targetPath : findSiblingFile(dir, ["scene_specs.json", "scene-specs.json"]);
  const audioMetaPath = schemaName === "audio-meta" ? targetPath : findSiblingFile(dir, ["audio_meta.json", "audio-meta.json"]);
  if (!sceneSpecsPath || !audioMetaPath) return { pass: violations.length === 0, violations };

  try {
    const sceneSpecs = schemaName === "scene-specs" ? data : readJsonFile(sceneSpecsPath);
    const audioMeta = schemaName === "audio-meta" ? data : readJsonFile(audioMetaPath);
    violations.push(
      ...validateSceneAudioSetMatch({
        sceneSpecs,
        audioMeta,
        sceneSpecsFile: repoRelative(repoRoot, sceneSpecsPath),
        audioMetaFile: repoRelative(repoRoot, audioMetaPath)
      })
    );
  } catch (error) {
    violations.push(
      violation(file, "/", "semantic sibling JSON must be readable", {
        error: error instanceof Error ? error.message : String(error)
      })
    );
  }

  return { pass: violations.length === 0, violations };
}

export function formatSemanticViolations(violations) {
  return violations.map((item) => {
    const measured = item.measured && Object.keys(item.measured).length > 0 ? ` ${JSON.stringify(item.measured)}` : "";
    return `${item.file}${item.path}: ${item.rule}${measured}`;
  });
}

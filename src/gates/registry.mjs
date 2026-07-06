import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  validateSceneAudioSetMatch,
  validateSemanticData
} from "./semantic.mjs";

export const requiredReportFields = [
  "gate",
  "pass",
  "checks",
  "inputSet",
  "canonicalInputMerkleHash",
  "evidenceHash",
  "gateScriptHash",
  "gitCommit",
  "command",
  "exitCode",
  "startedAt",
  "finishedAt"
];

export const schemaSpecs = {
  "scene-specs": "schemas/scene-specs.schema.json",
  "audio-meta": "schemas/audio-meta.schema.json",
  "design-tokens": "schemas/design-tokens.schema.json",
  versions: "schemas/versions.schema.json",
  "render-manifest": "schemas/render-manifest.schema.json"
};

export const schemaOrder = [
  "scene-specs",
  "audio-meta",
  "design-tokens",
  "versions",
  "render-manifest"
];

const schemaAliases = new Map([
  ["scene-specs", "scene-specs"],
  ["scene-spec", "scene-specs"],
  ["scenespecs", "scene-specs"],
  ["audio-meta", "audio-meta"],
  ["audiometa", "audio-meta"],
  ["design-tokens", "design-tokens"],
  ["designtokens", "design-tokens"],
  ["versions", "versions"],
  ["render-manifest", "render-manifest"],
  ["rendermanifest", "render-manifest"]
]);

const ignoredScanRoots = new Set([
  ".git",
  ".omc",
  "node_modules",
  "out",
  "poc",
  "reports",
  "research",
  "schemas",
  "tmp"
]);

const ignoredScanPrefixes = ["fixtures/negative"];

const assetSchemaNames = new Set(["audio-meta", "design-tokens", "versions", "render-manifest"]);

const forbiddenDurationKeys = new Set([
  "duration",
  "durationms",
  "durationsec",
  "durationsecs",
  "durationframes",
  "audioduration",
  "audiodurationms",
  "audiodurationsec",
  "rawaudiodurationsec",
  "totalduration",
  "totaldurationsec",
  "startframe",
  "endframe",
  "totalframes",
  "fps",
  "startsec",
  "endsec",
  "timesec"
]);

function sha256String(value) {
  return createHash("sha256").update(value).digest("hex");
}

function pointerSegment(value) {
  return String(value).replace(/~/g, "~0").replace(/\//g, "~1");
}

function normalizeRelPath(value) {
  return value.split(path.sep).join("/");
}

function relPath(repoRoot, absolutePath) {
  return normalizeRelPath(path.relative(repoRoot, absolutePath));
}

function readJsonFile(absolutePath) {
  return JSON.parse(readFileSync(absolutePath, "utf8"));
}

function loadSchemaEntries(repoRoot) {
  return schemaOrder.map((name) => {
    const relativePath = schemaSpecs[name];
    const absolutePath = path.join(repoRoot, relativePath);
    return {
      name,
      relativePath,
      absolutePath,
      schema: readJsonFile(absolutePath)
    };
  });
}

export function createAjv(repoRoot) {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    validateSchema: true,
    allowUnionTypes: false
  });
  addFormats(ajv);

  for (const { schema } of loadSchemaEntries(repoRoot)) {
    ajv.addSchema(schema);
  }

  return ajv;
}

export function inferSchemaNameFromPath(filePath) {
  const base = path.basename(filePath).toLowerCase();
  if (base === "scene_specs.json" || base === "scene-specs.json") return "scene-specs";
  if (base === "audio_meta.json" || base === "audio-meta.json") return "audio-meta";
  if (base === "design_tokens.json" || base === "design-tokens.json") return "design-tokens";
  if (base === "versions.json") return "versions";
  if (base === "render_manifest.json" || base === "render-manifest.json") return "render-manifest";
  return null;
}

export function normalizeSchemaName(value) {
  if (!value) return null;
  const base = path
    .basename(String(value).trim())
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\.schema\.json$/, "")
    .replace(/\.json$/, "");
  const compact = base.replace(/-/g, "");
  return schemaAliases.get(base) ?? schemaAliases.get(compact) ?? null;
}

export function resolveSchemaName(schemaArg, filePath) {
  if (!schemaArg || schemaArg === "auto") {
    const inferred = inferSchemaNameFromPath(filePath);
    if (!inferred) {
      throw new Error(`cannot infer schema for ${filePath}; pass --schema <${schemaOrder.join("|")}>`);
    }
    return inferred;
  }

  const normalized = normalizeSchemaName(schemaArg);
  if (!normalized) {
    throw new Error(`unknown schema: ${schemaArg}`);
  }
  return normalized;
}

export function schemaPathForName(schemaName) {
  const schemaPath = schemaSpecs[schemaName];
  if (!schemaPath) throw new Error(`unknown schema: ${schemaName}`);
  return schemaPath;
}

export function validateJsonForSchema(repoRoot, data, schemaName) {
  const schemaPath = schemaPathForName(schemaName);
  const schema = readJsonFile(path.join(repoRoot, schemaPath));
  const ajv = createAjv(repoRoot);
  const validate = ajv.getSchema(schema.$id) ?? ajv.compile(schema);
  const pass = validate(data);
  return {
    pass,
    errors: validate.errors ?? [],
    schemaName,
    schemaPath,
    schemaId: schema.$id
  };
}

export function formatAjvErrors(errors) {
  return errors.map((error) => {
    const at = error.instancePath || "/";
    const params =
      error.params && Object.keys(error.params).length > 0 ? ` ${JSON.stringify(error.params)}` : "";
    return `${at} ${error.message ?? "violates schema"} [${error.schemaPath}]${params}`;
  });
}

function shouldSkipDirectory(repoRoot, absolutePath) {
  const relative = relPath(repoRoot, absolutePath);
  if (!relative || relative === ".") return false;
  const first = relative.split("/")[0];
  if (ignoredScanRoots.has(first)) return true;
  return ignoredScanPrefixes.some((prefix) => relative === prefix || relative.startsWith(`${prefix}/`));
}

function walkFiles(repoRoot, absolutePath, files) {
  if (shouldSkipDirectory(repoRoot, absolutePath)) return;

  for (const entry of readdirSync(absolutePath, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name)
  )) {
    const next = path.join(absolutePath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(repoRoot, next, files);
    } else if (entry.isFile()) {
      files.push(next);
    }
  }
}

export function discoverContractFiles(repoRoot, schemaName = null) {
  const files = [];
  walkFiles(repoRoot, repoRoot, files);
  return files
    .filter((file) => path.extname(file).toLowerCase() === ".json")
    .map((file) => ({ absolutePath: file, relativePath: relPath(repoRoot, file), schemaName: inferSchemaNameFromPath(file) }))
    .filter((entry) => entry.schemaName && (!schemaName || entry.schemaName === schemaName))
    .map((entry) => entry.relativePath)
    .sort((a, b) => a.localeCompare(b));
}

function durationKeyKind(key) {
  const normalized = String(key).toLowerCase().replace(/[-_]/g, "");
  if (forbiddenDurationKeys.has(normalized)) return normalized;
  return normalized.includes("duration") ? normalized : null;
}

function isAllowedSceneSpecsDurationPath(pointer) {
  return /^\/transitions\/\d+\/duration$/.test(pointer);
}

function collectDurationViolations(value, file, pointer = "") {
  const violations = [];
  if (!value || typeof value !== "object") return violations;

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      violations.push(...collectDurationViolations(item, file, `${pointer}/${index}`));
    });
    return violations;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPointer = `${pointer}/${pointerSegment(key)}`;
    const keyKind = durationKeyKind(key);
    if (keyKind && !isAllowedSceneSpecsDurationPath(childPointer)) {
      violations.push({
        file,
        path: childPointer,
        key,
        rule: "scene_specs must not own derived duration/frame/timing fields"
      });
    }
    violations.push(...collectDurationViolations(child, file, childPointer));
  }

  return violations;
}

function addAssetRef(refs, file, pointer, field, value) {
  if (value === null || value === undefined) return;
  refs.push({ file, pointer, field, value });
}

function extractAudioMetaRefs(file, data) {
  const refs = [];
  const scenes = Array.isArray(data?.scenes) ? data.scenes : [];
  scenes.forEach((scene, index) => {
    addAssetRef(refs, file, `/scenes/${index}/audioPath`, "audioPath", scene?.audioPath);
  });
  return refs;
}

function extractDesignTokensRefs(file, data) {
  const refs = [];
  for (const [role, roleConfig] of Object.entries(data?.fonts ?? {})) {
    const files = Array.isArray(roleConfig?.files) ? roleConfig.files : [];
    files.forEach((fontFile, index) => {
      addAssetRef(
        refs,
        file,
        `/fonts/${pointerSegment(role)}/files/${index}/path`,
        "fonts[].files[].path",
        fontFile?.path
      );
    });
  }
  return refs;
}

function extractVersionsRefs(file, data) {
  const refs = [];
  for (const [resourceType, history] of Object.entries(data?.resources ?? {})) {
    const entries = Array.isArray(history?.entries) ? history.entries : [];
    entries.forEach((entry, index) => {
      addAssetRef(
        refs,
        file,
        `/resources/${pointerSegment(resourceType)}/entries/${index}/path`,
        "resources[].entries[].path",
        entry?.path
      );
    });
  }
  return refs;
}

function extractRenderManifestRefs(file, data) {
  const refs = [];
  const scenes = Array.isArray(data?.scenes) ? data.scenes : [];
  scenes.forEach((scene, index) => {
    addAssetRef(refs, file, `/scenes/${index}/path`, "scenes[].path", scene?.path);
    addAssetRef(refs, file, `/scenes/${index}/audioPath`, "scenes[].audioPath", scene?.audioPath);
    addAssetRef(refs, file, `/scenes/${index}/imagePath`, "scenes[].imagePath", scene?.imagePath);
  });
  addAssetRef(refs, file, "/bgm/path", "bgm.path", data?.bgm?.path);

  for (const [format, override] of Object.entries(data?.formatOverrides ?? {})) {
    for (const [sceneId, sceneOverride] of Object.entries(override?.scenes ?? {})) {
      addAssetRef(
        refs,
        file,
        `/formatOverrides/${pointerSegment(format)}/scenes/${pointerSegment(sceneId)}/path`,
        "formatOverrides[].scenes[].path",
        sceneOverride?.path
      );
    }
  }
  return refs;
}

function extractAssetRefs(file, schemaName, data) {
  if (schemaName === "audio-meta") return extractAudioMetaRefs(file, data);
  if (schemaName === "design-tokens") return extractDesignTokensRefs(file, data);
  if (schemaName === "versions") return extractVersionsRefs(file, data);
  if (schemaName === "render-manifest") return extractRenderManifestRefs(file, data);
  return [];
}

function validateAssetRef(repoRoot, ref) {
  if (typeof ref.value !== "string") {
    return {
      ...ref,
      rule: "asset path must be a string",
      exists: false
    };
  }
  if (path.isAbsolute(ref.value) || ref.value.includes("\\") || !ref.value.startsWith("./assets/")) {
    return {
      ...ref,
      rule: "asset path must be relative and start with ./assets/",
      exists: false
    };
  }

  const segments = ref.value.split("/");
  if (segments.includes("..") || segments.includes("")) {
    return {
      ...ref,
      rule: "asset path must not contain empty or parent directory segments",
      exists: false
    };
  }

  const contractDir = path.dirname(path.join(repoRoot, ref.file));
  const assetRoot = path.resolve(contractDir, "assets");
  const resolved = path.resolve(contractDir, ref.value);
  const insideRepo = resolved === repoRoot || resolved.startsWith(`${repoRoot}${path.sep}`);
  const insideAssetRoot = resolved === assetRoot || resolved.startsWith(`${assetRoot}${path.sep}`);

  if (!insideRepo) {
    return {
      ...ref,
      resolved: relPath(repoRoot, resolved),
      rule: "asset path must stay inside repository root after resolve",
      exists: false
    };
  }
  if (!insideAssetRoot) {
    return {
      ...ref,
      rule: "asset path must stay inside ./assets/",
      exists: false
    };
  }
  if (!existsSync(resolved)) {
    return {
      ...ref,
      resolved: relPath(repoRoot, resolved),
      rule: "asset path must exist",
      exists: false
    };
  }

  const linkStats = lstatSync(resolved);
  if (linkStats.isSymbolicLink()) {
    return {
      ...ref,
      resolved: relPath(repoRoot, resolved),
      rule: "asset path must not be a symbolic link",
      exists: false
    };
  }

  const stats = statSync(resolved);
  if (!stats.isFile()) {
    return {
      ...ref,
      resolved: relPath(repoRoot, resolved),
      rule: "asset path must resolve to a regular file",
      exists: false
    };
  }

  if (stats.size === 0) {
    return {
      ...ref,
      resolved: relPath(repoRoot, resolved),
      rule: "asset path must not be a 0-byte file",
      exists: false
    };
  }

  return {
    ...ref,
    resolved: relPath(repoRoot, resolved),
    exists: true
  };
}

function runL01({ repoRoot }) {
  const statuses = [];
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    validateSchema: true,
    allowUnionTypes: false
  });
  addFormats(ajv);

  for (const name of schemaOrder) {
    const relativePath = schemaSpecs[name];
    const absolutePath = path.join(repoRoot, relativePath);
    const status = {
      name,
      path: relativePath,
      schemaId: null,
      jsonReadable: false,
      schemaValid: false,
      compiled: false,
      errors: []
    };

    try {
      status.schema = readJsonFile(absolutePath);
      status.schemaId = status.schema.$id ?? null;
      status.jsonReadable = true;
      status.schemaValid = ajv.validateSchema(status.schema);
      if (!status.schemaValid) status.errors.push(...formatAjvErrors(ajv.errors ?? []));
    } catch (error) {
      status.errors.push(error instanceof Error ? error.message : String(error));
    }

    statuses.push(status);
  }

  if (statuses.every((status) => status.jsonReadable && status.schemaValid)) {
    for (const status of statuses) {
      ajv.addSchema(status.schema);
    }
    for (const status of statuses) {
      try {
        ajv.compile(status.schema);
        status.compiled = true;
      } catch (error) {
        status.errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  }

  const checks = statuses.map(({ schema, ...status }) => ({
    id: `schema:${status.name}`,
    pass: status.jsonReadable && status.schemaValid && status.compiled,
    measured: status
  }));

  return {
    checks,
    inputSet: schemaOrder.map((name) => schemaSpecs[name]),
    evidence: checks
  };
}

function runL05({ repoRoot }) {
  const files = discoverContractFiles(repoRoot, "scene-specs");
  const violations = [];

  for (const file of files) {
    try {
      const data = readJsonFile(path.join(repoRoot, file));
      violations.push(...collectDurationViolations(data, file));
    } catch (error) {
      violations.push({
        file,
        path: "/",
        rule: "scene_specs must be readable JSON before duration intrusion checks",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const checks = [
    {
      id: "scene-specs-duration-intrusion",
      pass: violations.length === 0,
      measured: {
        filesChecked: files.length,
        allowedDurationPaths: ["/transitions/<index>/duration"],
        violations
      }
    }
  ];

  return {
    checks,
    inputSet: files,
    evidence: checks
  };
}

function runL06({ repoRoot }) {
  const files = discoverContractFiles(repoRoot).filter((file) =>
    assetSchemaNames.has(inferSchemaNameFromPath(file))
  );
  const refs = [];
  const violations = [];

  for (const file of files) {
    try {
      const schemaName = inferSchemaNameFromPath(file);
      const data = readJsonFile(path.join(repoRoot, file));
      refs.push(...extractAssetRefs(file, schemaName, data));
    } catch (error) {
      violations.push({
        file,
        path: "/",
        rule: "asset-bearing contract must be readable JSON",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const checkedRefs = refs.map((ref) => validateAssetRef(repoRoot, ref));
  violations.push(
    ...checkedRefs
      .filter((ref) => !ref.exists)
      .map(({ exists, resolved, ...ref }) => ({
        ...ref,
        ...(resolved ? { resolved } : {})
      }))
  );

  const assetInputs = checkedRefs
    .filter((ref) => ref.resolved)
    .map((ref) => ref.resolved)
    .sort((a, b) => a.localeCompare(b));

  const checks = [
    {
      id: "asset-paths-relative-assets-exist",
      pass: violations.length === 0,
      measured: {
        filesChecked: files.length,
        refsChecked: refs.length,
        requiredPrefix: "./assets/",
        violations
      }
    }
  ];

  return {
    checks,
    inputSet: [...new Set([...files, ...assetInputs])].sort((a, b) => a.localeCompare(b)),
    evidence: checks
  };
}

function runL012({ repoRoot }) {
  const files = discoverContractFiles(repoRoot);
  const violations = [];
  const parsed = new Map();

  for (const file of files) {
    const schemaName = inferSchemaNameFromPath(file);
    try {
      const data = readJsonFile(path.join(repoRoot, file));
      parsed.set(file, { schemaName, data });
      violations.push(...validateSemanticData({ schemaName, data, file }));
    } catch (error) {
      violations.push({
        file,
        path: "/",
        rule: "semantic contract must be readable JSON",
        measured: {
          error: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  for (const [file, entry] of parsed.entries()) {
    if (entry.schemaName !== "scene-specs") continue;
    const dir = path.dirname(file);
    const audioMetaFile = ["audio_meta.json", "audio-meta.json"]
      .map((candidate) => normalizeRelPath(path.join(dir, candidate)))
      .find((candidate) => parsed.get(candidate)?.schemaName === "audio-meta");
    if (!audioMetaFile) continue;

    violations.push(
      ...validateSceneAudioSetMatch({
        sceneSpecs: entry.data,
        audioMeta: parsed.get(audioMetaFile).data,
        sceneSpecsFile: file,
        audioMetaFile
      })
    );
  }

  const checks = [
    {
      id: "contract-semantic-integrity",
      pass: violations.length === 0,
      measured: {
        filesChecked: files.length,
        rules: [
          "sceneId unique",
          "transitions reference existing scenes and are not self-loops",
          "word timings are monotonic and end >= start",
          "versions selected references entries",
          "render subtitles stay within audio duration and startFrame is monotonic",
          "scene_specs and audio_meta sceneId sets match when paired"
        ],
        violations
      }
    }
  ];

  return {
    checks,
    inputSet: [...files, "src/gates/semantic.mjs"].sort((a, b) => a.localeCompare(b)),
    evidence: checks
  };
}

export const gateRegistry = {
  "l0-1": {
    gate: "L0-1",
    title: "five contract JSON Schemas validate and compile",
    kind: "native",
    script: "src/gates/registry.mjs",
    render: false,
    run: runL01
  },
  "l0-5": {
    gate: "L0-5",
    title: "scene_specs duration and timing field intrusion check",
    kind: "native",
    script: "src/gates/registry.mjs",
    render: false,
    run: runL05
  },
  "l0-6": {
    gate: "L0-6",
    title: "asset paths are relative ./assets/ references and exist",
    kind: "native",
    script: "src/gates/registry.mjs",
    render: false,
    run: runL06
  },
  "l0-12": {
    gate: "L0-12",
    title: "contract semantic integrity checks",
    kind: "native",
    script: "src/gates/semantic.mjs",
    render: false,
    run: runL012
  },
  p0a: {
    gate: "P0a",
    title: "environment and static render",
    kind: "legacy",
    script: "poc/scripts/gate-p0a.mjs",
    legacyReport: "poc/reports/P0a-report.json",
    render: false,
    inputSet: ["poc/fixtures/p0a", "poc/reports/doctor.json", "poc/scripts/gate-p0a.mjs"]
  },
  p0b: {
    gate: "P0b",
    title: "sub-composition mount and orphan behavior",
    kind: "legacy",
    script: "poc/scripts/gate-p0b.mjs",
    legacyReport: "poc/reports/P0b-report.json",
    render: true,
    inputSet: ["poc/fixtures/p0b", "poc/scripts/gate-p0b.mjs"]
  },
  p0c: {
    gate: "P0c",
    title: "Korean TTS, CJK render, OCR, and stress evidence",
    kind: "legacy",
    script: "poc/scripts/gate-p0c.mjs",
    legacyReport: "poc/reports/P0c-report.json",
    render: false,
    inputSet: [
      "poc/fixtures/p0c",
      "poc/reports/p0c-ocr.json",
      "poc/reports/p0c-stress.json",
      "poc/scripts/gate-p0c.mjs",
      "poc/scripts/p0c-ocr.mjs",
      "poc/scripts/p0c-stress.mjs"
    ]
  },
  p0d: {
    gate: "P0d",
    title: "edit loop, selective re-TTS, and full recompile",
    kind: "legacy",
    script: "poc/scripts/gate-p0d.mjs",
    legacyReport: "poc/reports/P0d-report.json",
    render: true,
    inputSet: ["poc/fixtures/p0d", "poc/scripts/compile-p0d.mjs", "poc/scripts/gate-p0d.mjs"]
  }
};

export function normalizeGateId(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function listGates() {
  return Object.entries(gateRegistry).map(([id, gate]) => ({
    id,
    gate: gate.gate,
    title: gate.title,
    kind: gate.kind,
    render: gate.render,
    script: gate.script,
    ...(gate.legacyReport ? { legacyReport: gate.legacyReport } : {})
  }));
}

export function hashGateEvidence(value) {
  return sha256String(JSON.stringify(value));
}

import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync
} from "node:fs";
import path from "node:path";
import { compileProject, DEFAULT_PRESET } from "../../compiler/compiler.mjs";
import {
  normalizeRelPath,
  readJsonFile,
  writeJsonViaVf
} from "../../pipeline/core/io.mjs";

function relFromRepo(repoRoot, filePath) {
  const rel = normalizeRelPath(path.relative(repoRoot, filePath));
  return rel || normalizeRelPath(filePath);
}

function sceneBuildReady(projectDir, sceneId) {
  return (
    existsSync(path.join(projectDir, "build", "render-manifest.json")) &&
    existsSync(path.join(projectDir, "build", "scenes", `scene-${sceneId}.html`))
  );
}

function copyProjectForCompile(projectDir, tmpProjectDir) {
  mkdirSync(tmpProjectDir, { recursive: true });
  for (const fileName of ["scene_specs.json", "audio_meta.json", "audio-meta.json"]) {
    const source = path.join(projectDir, fileName);
    if (existsSync(source)) copyFileSync(source, path.join(tmpProjectDir, fileName));
  }
  const assetsDir = path.join(projectDir, "assets");
  if (existsSync(assetsDir)) {
    cpSync(assetsDir, path.join(tmpProjectDir, "assets"), {
      recursive: true,
      dereference: true
    });
  }
}

function mergeFormatOverrides(current, replacement, sceneId) {
  const next = structuredClone(current ?? {});
  for (const [format, formatOverride] of Object.entries(replacement ?? {})) {
    const replacementScene = formatOverride?.scenes?.[sceneId];
    if (!replacementScene) continue;
    next[format] = next[format] ?? {};
    next[format].scenes = next[format].scenes ?? {};
    next[format].scenes[sceneId] = replacementScene;
  }
  return next;
}

function mergeSceneManifest({ repoRoot, projectDir, tmpProjectDir, sceneId }) {
  const manifestPath = path.join(projectDir, "build", "render-manifest.json");
  const current = readJsonFile(manifestPath);
  const replacement = readJsonFile(path.join(tmpProjectDir, "build", "render-manifest.json"));
  const replacementScene = (replacement.scenes ?? []).find((scene) => scene.sceneId === sceneId);
  if (!replacementScene) throw new Error(`compiled manifest did not include scene: ${sceneId}`);
  const index = (current.scenes ?? []).findIndex((scene) => scene.sceneId === sceneId);
  if (index < 0) throw new Error(`current manifest did not include scene: ${sceneId}`);

  const next = structuredClone(current);
  next.scenes[index] = replacementScene;
  next.formatOverrides = mergeFormatOverrides(current.formatOverrides, replacement.formatOverrides, sceneId);

  return writeJsonViaVf({
    repoRoot,
    projectDir,
    filePath: manifestPath,
    schemaName: "render-manifest",
    data: next
  });
}

function mergeSceneBuild({ repoRoot, projectDir, tmpProjectDir, sceneId }) {
  const sceneRel = path.join("scenes", `scene-${sceneId}.html`);
  const sourceScenePath = path.join(tmpProjectDir, "build", sceneRel);
  const targetScenePath = path.join(projectDir, "build", sceneRel);
  if (!existsSync(sourceScenePath)) throw new Error(`compiled scene artifact is missing: ${sceneRel}`);
  mkdirSync(path.dirname(targetScenePath), { recursive: true });
  copyFileSync(sourceScenePath, targetScenePath);
  const manifestWrite = mergeSceneManifest({ repoRoot, projectDir, tmpProjectDir, sceneId });
  return { sceneRel: normalizeRelPath(sceneRel), manifestWrite };
}

export function compileStudioProject({
  repoRoot,
  projectDir,
  presetPath = DEFAULT_PRESET,
  scope = "full",
  sceneId = null
}) {
  const absoluteProjectDir = path.resolve(projectDir);
  const buildDir = path.join(absoluteProjectDir, "build");
  if (scope !== "scene" || !sceneId || !sceneBuildReady(absoluteProjectDir, sceneId)) {
    const result = compileProject({
      repoRoot,
      projectDir: absoluteProjectDir,
      presetPath
    });
    return {
      ...result,
      studioCompile: {
        scope: scope === "scene" && sceneId ? "full-fallback" : "full",
        sceneId
      }
    };
  }

  const studioTmpParent = path.join(absoluteProjectDir, ".studio");
  mkdirSync(studioTmpParent, { recursive: true });
  const tmpRoot = mkdtempSync(path.join(studioTmpParent, "compile-"));
  const tmpProjectDir = path.join(tmpRoot, "project");
  try {
    copyProjectForCompile(absoluteProjectDir, tmpProjectDir);
    const compiled = compileProject({
      repoRoot,
      projectDir: tmpProjectDir,
      presetPath,
      runLint: false
    });
    const merge = mergeSceneBuild({ repoRoot, projectDir: absoluteProjectDir, tmpProjectDir, sceneId });
    return {
      ...compiled,
      projectDir: relFromRepo(repoRoot, absoluteProjectDir),
      buildDir: relFromRepo(repoRoot, buildDir),
      scenes: compiled.scenes.filter((scene) => scene.sceneId === sceneId),
      schemaValidation: {
        ...compiled.schemaValidation,
        renderManifest: {
          ...merge.manifestWrite,
          file: relFromRepo(repoRoot, path.join(buildDir, "render-manifest.json"))
        }
      },
      studioCompile: {
        scope: "scene",
        sceneId,
        merged: [merge.sceneRel, "render-manifest.json"]
      }
    };
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

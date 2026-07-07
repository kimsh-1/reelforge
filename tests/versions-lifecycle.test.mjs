import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  PipelineLockError,
  acquirePipelineLock
} from "../src/pipeline/core/lock.mjs";
import { resolveSelectedResource } from "../src/pipeline/core/versions.mjs";
import {
  DirtyPipelineError,
  EditLockConflictError,
  acquireEditLock,
  assertPipelineClean,
  hashPatternsWithSelected,
  loadVersions,
  markSelectedAwareStepCompleted,
  releaseEditLock,
  rollbackGeneration,
  selectGeneration,
  selectedAwareSkipDecision,
  selectedResourceSummary,
  setDirty,
  snapshotResource,
  writeSceneSpecsWithBackup
} from "../src/pipeline/versions-impl/index.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testRoot = path.join(repoRoot, "tmp");

function sceneSpecs(overrides = {}) {
  return {
    version: "1.0.0",
    projectId: "versions-lifecycle",
    scenes: [
      {
        sceneId: "s01",
        sceneNumber: 1,
        narration: "Opening narration.",
        narration_tts: "Opening narration.",
        altText: "Opening scene",
        layout: "headline_only",
        mood: "informative",
        reveal: "fade_in",
        emphasis: "keyword",
        headline: "Opening",
        items: [],
        values: [],
        unit: "",
        source: "",
        visual_kind: "none",
        kenBurns: {
          enabled: false,
          zoomFactor: 1,
          zoomDirection: "in",
          panDirection: "none"
        },
        subtitleMode: "keyword",
        ...(overrides.scene ?? {})
      }
    ],
    transitions: [],
    ...overrides.root
  };
}

async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

async function makeProject() {
  await mkdir(testRoot, { recursive: true });
  const projectDir = await mkdtemp(path.join(testRoot, "versions-lifecycle-"));
  await writeJson(path.join(projectDir, "scene_specs.json"), sceneSpecs());
  await mkdir(path.join(projectDir, "assets", "images"), { recursive: true });
  return projectDir;
}

async function readProjectFile(projectDir, relPath) {
  return readFile(path.join(projectDir, relPath.replace(/^\.\//, "")), "utf8");
}

async function writeCurrentImage(projectDir, value) {
  const imagePath = path.join(projectDir, "assets", "images", "current.txt");
  await writeFile(imagePath, value);
  return imagePath;
}

test("snapshot backs up resources into append-only generations and increments gen", async () => {
  const projectDir = await makeProject();
  try {
    await writeCurrentImage(projectDir, "image-v1");
    const first = snapshotResource({
      repoRoot,
      projectDir,
      resourceType: "image_s01",
      sourcePath: "assets/images/current.txt",
      note: "initial image"
    });

    await writeCurrentImage(projectDir, "image-v2");
    const second = snapshotResource({
      repoRoot,
      projectDir,
      resourceType: "image_s01",
      sourcePath: "assets/images/current.txt",
      note: "rerolled image"
    });

    assert.equal(first.gen, "gen_01");
    assert.equal(second.gen, "gen_02");
    assert.match(first.path, /^\.\/assets\/versions\/image_s01\/gen_01\/current\.txt$/);
    assert.match(second.path, /^\.\/assets\/versions\/image_s01\/gen_02\/current\.txt$/);
    assert.equal(await readProjectFile(projectDir, first.path), "image-v1");
    assert.equal(await readProjectFile(projectDir, second.path), "image-v2");

    const versions = loadVersions(projectDir);
    assert.equal(versions.resources.image_s01.entries.length, 2);
    assert.equal(versions.resources.image_s01.selected, "gen_02");
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("select switches the active generation without deleting older files", async () => {
  const projectDir = await makeProject();
  try {
    await writeCurrentImage(projectDir, "image-v1");
    const first = snapshotResource({
      repoRoot,
      projectDir,
      resourceType: "image_s01",
      sourcePath: "assets/images/current.txt"
    });
    await writeCurrentImage(projectDir, "image-v2");
    snapshotResource({
      repoRoot,
      projectDir,
      resourceType: "image_s01",
      sourcePath: "assets/images/current.txt"
    });

    const selected = selectGeneration({
      repoRoot,
      projectDir,
      resourceType: "image_s01",
      gen: first.gen
    });

    assert.equal(selected.gen, "gen_01");
    assert.equal(selected.path, first.path);
    assert.equal(loadVersions(projectDir).resources.image_s01.selected, "gen_01");
    assert.equal(await readProjectFile(projectDir, "./assets/versions/image_s01/gen_02/current.txt"), "image-v2");
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("rollback moves selected to the previous generation and can restore the active file", async () => {
  const projectDir = await makeProject();
  try {
    await writeCurrentImage(projectDir, "image-v1");
    snapshotResource({
      repoRoot,
      projectDir,
      resourceType: "image_s01",
      sourcePath: "assets/images/current.txt"
    });
    await writeCurrentImage(projectDir, "image-v2");
    snapshotResource({
      repoRoot,
      projectDir,
      resourceType: "image_s01",
      sourcePath: "assets/images/current.txt"
    });

    const rolledBack = rollbackGeneration({
      repoRoot,
      projectDir,
      resourceType: "image_s01",
      restorePath: "assets/images/current.txt"
    });

    assert.equal(rolledBack.gen, "gen_01");
    assert.equal(loadVersions(projectDir).resources.image_s01.selected, "gen_01");
    assert.equal(await readProjectFile(projectDir, "./assets/images/current.txt"), "image-v1");
    assert.equal(await readProjectFile(projectDir, "./assets/versions/image_s01/gen_02/current.txt"), "image-v2");
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("scene_specs safe-write hook snapshots first, marks dirty, and pipeline guard requires force", async () => {
  const projectDir = await makeProject();
  try {
    const nextSpecs = sceneSpecs({ scene: { headline: "Edited" } });
    const result = writeSceneSpecsWithBackup({
      repoRoot,
      projectDir,
      sceneSpecs: nextSpecs,
      owner: "studio"
    });

    assert.equal(result.backup.gen, "gen_01");
    assert.equal(JSON.parse(await readProjectFile(projectDir, "scene_specs.json")).scenes[0].headline, "Edited");
    assert.equal(JSON.parse(await readProjectFile(projectDir, result.backup.path)).scenes[0].headline, "Opening");

    const versions = loadVersions(projectDir);
    assert.equal(versions.dirty, true);
    assert.equal(versions.editLock.owner, "studio");
    assert.throws(
      () => assertPipelineClean({ projectDir, forceDirty: false }),
      DirtyPipelineError
    );

    const warnings = [];
    assert.deepEqual(
      assertPipelineClean({ projectDir, forceDirty: true, log: (line) => warnings.push(line) }),
      { dirty: true, forced: true }
    );
    assert.equal(warnings.length, 1);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("editLock acquisition, release, and conflict detection follow owner semantics", async () => {
  const projectDir = await makeProject();
  try {
    await writeCurrentImage(projectDir, "image-v1");
    snapshotResource({
      repoRoot,
      projectDir,
      resourceType: "image_s01",
      sourcePath: "assets/images/current.txt"
    });

    const lock = acquireEditLock({ repoRoot, projectDir, owner: "editor-a" });
    assert.equal(lock.owner, "editor-a");
    assert.throws(
      () => acquireEditLock({ repoRoot, projectDir, owner: "editor-b" }),
      EditLockConflictError
    );
    assert.throws(
      () => releaseEditLock({ repoRoot, projectDir, owner: "editor-b" }),
      EditLockConflictError
    );

    setDirty({ repoRoot, projectDir, dirty: true, owner: "editor-a" });
    assert.equal(loadVersions(projectDir).dirty, true);
    releaseEditLock({ repoRoot, projectDir, owner: "editor-a" });
    setDirty({ repoRoot, projectDir, dirty: false });
    const versions = loadVersions(projectDir);
    assert.equal(versions.editLock, null);
    assert.equal(versions.dirty, false);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("pipeline lock rejects a concurrent project run before state or versions writes", async () => {
  const projectDir = await makeProject();
  try {
    const first = acquirePipelineLock({ projectDir, command: "first pipeline" });
    try {
      assert.throws(
        () => acquirePipelineLock({ projectDir, command: "second pipeline" }),
        (error) => error instanceof PipelineLockError && error.message === "다른 실행 진행 중"
      );
      assert.equal(existsSync(path.join(projectDir, "pipeline_state.json")), false);
      assert.equal(loadVersions(projectDir).dirty, false);
    } finally {
      first.release();
    }

    const afterRelease = acquirePipelineLock({ projectDir, command: "third pipeline" });
    afterRelease.release();
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("selected-aware resume state invalidates a completed step when selected changes", async () => {
  const projectDir = await makeProject();
  try {
    await mkdir(path.join(projectDir, "build"), { recursive: true });
    await writeFile(path.join(projectDir, "build", "render-manifest.json"), "{}\n");
    await writeCurrentImage(projectDir, "image-v1");
    snapshotResource({
      repoRoot,
      projectDir,
      resourceType: "image_s01",
      sourcePath: "assets/images/current.txt"
    });

    const step = {
      id: "compile",
      inputs: ["scene_specs.json", "versions.json"],
      outputs: ["build/render-manifest.json"]
    };
    const state = { completedSteps: [], failedSteps: {}, stepHashes: {} };
    const firstHash = markSelectedAwareStepCompleted({ repoRoot, projectDir, state, step }).hash;
    assert.equal(selectedAwareSkipDecision({ repoRoot, projectDir, state, step }).skip, true);

    await writeCurrentImage(projectDir, "image-v2");
    snapshotResource({
      repoRoot,
      projectDir,
      resourceType: "image_s01",
      sourcePath: "assets/images/current.txt"
    });

    const decision = selectedAwareSkipDecision({ repoRoot, projectDir, state, step });
    assert.equal(decision.skip, false);
    assert.equal(decision.reason, "selected-input-hash-changed");
    assert.notEqual(decision.input.hash, firstHash);
    assert.equal(decision.input.selected.find((item) => item.resourceType === "image_s01").selected, "gen_02");
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("L3-5 mock image reroll preserves gen_01 and compiles with selected gen_02", async () => {
  const projectDir = await makeProject();
  try {
    await mkdir(path.join(projectDir, "build"), { recursive: true });
    await writeCurrentImage(projectDir, "image-v1");
    snapshotResource({
      repoRoot,
      projectDir,
      resourceType: "image_s01",
      sourcePath: "assets/images/current.txt",
      note: "initial image"
    });

    const compileStep = {
      id: "compile",
      inputs: ["scene_specs.json", "versions.json"],
      outputs: ["build/compiled-image.txt"]
    };
    const state = { completedSteps: [], failedSteps: {}, stepHashes: {} };

    async function mockCompile() {
      const selected = resolveSelectedResource({ projectDir, resourceType: "image_s01" });
      const selectedAbs = path.join(projectDir, selected.path.replace(/^\.\//, ""));
      const content = existsSync(selectedAbs) ? await readFile(selectedAbs, "utf8") : "";
      await writeFile(path.join(projectDir, "build", "compiled-image.txt"), `${selected.gen}\n${selected.path}\n${content}`);
    }

    await mockCompile();
    markSelectedAwareStepCompleted({ repoRoot, projectDir, state, step: compileStep });
    assert.equal(selectedAwareSkipDecision({ repoRoot, projectDir, state, step: compileStep }).skip, true);

    await writeCurrentImage(projectDir, "image-v2");
    const reroll = snapshotResource({
      repoRoot,
      projectDir,
      resourceType: "image_s01",
      sourcePath: "assets/images/current.txt",
      note: "reroll image"
    });

    assert.equal(reroll.gen, "gen_02");
    assert.equal(await readProjectFile(projectDir, "./assets/versions/image_s01/gen_01/current.txt"), "image-v1");
    assert.equal(await readProjectFile(projectDir, "./assets/versions/image_s01/gen_02/current.txt"), "image-v2");
    assert.equal(selectedAwareSkipDecision({ repoRoot, projectDir, state, step: compileStep }).skip, false);

    await mockCompile();
    const compiled = await readProjectFile(projectDir, "build/compiled-image.txt");
    assert.match(compiled, /^gen_02\n\.\/assets\/versions\/image_s01\/gen_02\/current\.txt\nimage-v2$/);

    const selectedSummary = selectedResourceSummary({ projectDir });
    const selectedInput = hashPatternsWithSelected({
      repoRoot,
      projectDir,
      patterns: compileStep.inputs
    });
    assert.equal(selectedSummary.find((item) => item.resourceType === "image_s01").selected, "gen_02");
    assert.equal(
      selectedInput.entries.find((entry) => entry.path === "versions:selected:image_s01").selected,
      "gen_02"
    );
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

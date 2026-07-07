import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import {
  IMAGE_MANIFEST_FILE,
  IMAGE_RUNNER_CONTRACT_VERSION,
  ImagePipelinePendingError,
  readImageManifest,
  runImagesStep,
  validateImageManifestContract
} from "../src/pipeline/images/index.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = path.join(repoRoot, "fixtures", "golden-specs", "full-8types");
const expectedImageScenes = ["s04", "s08"];
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mP8z8BQDwAFgwJ/lCkmWQAAAABJRU5ErkJggg==",
  "base64"
);

async function makeFull8TypesProject() {
  const projectDir = await mkdtemp(path.join(tmpdir(), "reelforge-images-"));
  const specs = JSON.parse(await readFile(path.join(fixtureDir, "scene_specs.json"), "utf8"));
  const byScene = new Map(specs.scenes.map((scene) => [scene.sceneId, scene]));
  Object.assign(byScene.get("s04"), {
    visual_kind: "generate_image",
    imageAsset: {
      prompt: "Editorial product image of an operations checklist on a clean work desk",
      placement: "fullscreen"
    }
  });
  Object.assign(byScene.get("s08"), {
    visual_kind: "generate_image",
    imageAsset: {
      prompt: "Quiet interview room with note cards and soft window light, no readable text",
      placement: "center"
    }
  });

  await writeFile(path.join(projectDir, "scene_specs.json"), `${JSON.stringify(specs, null, 2)}\n`);
  await copyFile(path.join(repoRoot, "fixtures", "presets", "light.json"), path.join(projectDir, "design-tokens.json"));
  return projectDir;
}

function ctx(projectDir, force = false, profile = "mock") {
  return {
    repoRoot,
    projectDir,
    profile,
    force,
    command: `images-pipeline-test ${profile}${force ? " --force" : ""}`
  };
}

function readVersions(projectDir) {
  return JSON.parse(readFileSync(path.join(projectDir, "versions.json"), "utf8"));
}

function assertPng(pathname) {
  const signature = readFileSync(pathname).subarray(0, 8);
  assert.deepEqual([...signature], [137, 80, 78, 71, 13, 10, 26, 10]);
}

function assertVersionsPointTo(projectDir, gen) {
  const versions = readVersions(projectDir);
  for (const sceneId of expectedImageScenes) {
    const resource = versions.resources[`image_${sceneId}`];
    assert.ok(resource, `missing versions resource for ${sceneId}`);
    assert.equal(resource.selected, gen);
    assert.ok(resource.entries.some((entry) => entry.gen === gen), `missing ${gen} entry for ${sceneId}`);
    const selected = resource.entries.find((entry) => entry.gen === resource.selected);
    assert.ok(existsSync(path.join(projectDir, selected.path.slice(2))), `selected file missing for ${sceneId}`);
  }
  return versions;
}

test("mock image pipeline writes manifest, selected versions, and reuses unchanged generations", async () => {
  const projectDir = await makeFull8TypesProject();
  try {
    const first = runImagesStep(ctx(projectDir));
    assert.equal(first.provider, "mock-image");
    assert.equal(first.scenes, expectedImageScenes.length);
    assert.equal(first.generated, expectedImageScenes.length);
    assert.equal(first.reused, 0);

    const manifest = readImageManifest(projectDir);
    const validation = validateImageManifestContract(manifest, expectedImageScenes);
    assert.deepEqual(validation, { pass: true, errors: [] });
    assert.equal(manifest.status, "complete");
    assert.deepEqual(manifest.assets.map((asset) => asset.sceneId).sort(), expectedImageScenes);
    assert.ok(manifest.assets.every((asset) => asset.prompt.includes("Scene mood:")));
    assert.ok(manifest.filters.ocr.every((entry) => entry.pass === true && entry.status === "stub"));
    assert.ok(manifest.filters.composition.every((entry) => entry.pass === true && entry.status === "stub"));
    for (const asset of manifest.assets) assertPng(path.join(projectDir, asset.path.slice(2)));

    const versions01 = assertVersionsPointTo(projectDir, "gen_01");
    for (const sceneId of expectedImageScenes) {
      assert.equal(versions01.resources[`image_${sceneId}`].entries.length, 1);
    }

    const second = runImagesStep(ctx(projectDir));
    assert.equal(second.generated, 0);
    assert.equal(second.reused, expectedImageScenes.length);
    const versionsAfterReuse = assertVersionsPointTo(projectDir, "gen_01");
    for (const sceneId of expectedImageScenes) {
      assert.equal(versionsAfterReuse.resources[`image_${sceneId}`].entries.length, 1);
    }

    const forced = runImagesStep(ctx(projectDir, true));
    assert.equal(forced.generated, expectedImageScenes.length);
    assert.equal(forced.reused, 0);
    const versions02 = assertVersionsPointTo(projectDir, "gen_02");
    const forcedManifest = readImageManifest(projectDir);
    assert.deepEqual(forcedManifest.assets.map((asset) => asset.gen), ["gen_02", "gen_02"]);
    for (const sceneId of expectedImageScenes) {
      const entries = versions02.resources[`image_${sceneId}`].entries;
      assert.deepEqual(entries.map((entry) => entry.gen), ["gen_01", "gen_02"]);
      for (const entry of entries) assert.ok(existsSync(path.join(projectDir, entry.path.slice(2))));
    }
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("real runner mode writes prompts.jsonl and stops pending when PNG results are absent", async () => {
  const projectDir = await makeFull8TypesProject();
  try {
    assert.throws(
      () => runImagesStep(ctx(projectDir, false, "real")),
      (error) => error instanceof ImagePipelinePendingError && error.pending === true
    );

    const promptsPath = path.join(projectDir, "assets", "images", "runner", "prompts.jsonl");
    const lines = readFileSync(promptsPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    assert.equal(lines.length, expectedImageScenes.length);
    assert.ok(lines.every((line) => line.contractVersion === IMAGE_RUNNER_CONTRACT_VERSION));
    assert.ok(lines.every((line) => line.resultPath.startsWith("./assets/images/runner/results/")));
    assert.ok(lines.every((line) => line.finalPath.startsWith("./assets/images/")));

    const pendingManifest = JSON.parse(readFileSync(path.join(projectDir, IMAGE_MANIFEST_FILE), "utf8"));
    assert.equal(pendingManifest.status, "pending");
    assert.deepEqual(pendingManifest.pending.map((item) => item.sceneId).sort(), expectedImageScenes);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("runner mode recovers completed PNG results into append-only selected versions", async () => {
  const projectDir = await makeFull8TypesProject();
  try {
    try {
      runImagesStep(ctx(projectDir, false, "real"));
    } catch (error) {
      assert.ok(error instanceof ImagePipelinePendingError);
    }

    const promptsPath = path.join(projectDir, "assets", "images", "runner", "prompts.jsonl");
    const lines = readFileSync(promptsPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    const resultsDir = path.join(projectDir, "assets", "images", "runner", "results");
    await mkdir(resultsDir, { recursive: true });
    for (const line of lines) {
      await writeFile(path.join(resultsDir, `${line.id}.png`), tinyPng);
    }

    const recovered = runImagesStep(ctx(projectDir, false, "real"));
    assert.equal(recovered.provider, "codex-imagegen-runner");
    assert.equal(recovered.generated, expectedImageScenes.length);
    const manifest = readImageManifest(projectDir);
    const validation = validateImageManifestContract(manifest, expectedImageScenes);
    assert.equal(validation.pass, true, validation.errors.join("; "));
    for (const asset of manifest.assets) assertPng(path.join(projectDir, asset.path.slice(2)));
    assertVersionsPointTo(projectDir, "gen_01");
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test("runner mode keeps 0-byte PNG results pending and does not select them", async () => {
  const projectDir = await makeFull8TypesProject();
  try {
    try {
      runImagesStep(ctx(projectDir, false, "real"));
    } catch (error) {
      assert.ok(error instanceof ImagePipelinePendingError);
    }

    const promptsPath = path.join(projectDir, "assets", "images", "runner", "prompts.jsonl");
    const lines = readFileSync(promptsPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    const resultsDir = path.join(projectDir, "assets", "images", "runner", "results");
    await mkdir(resultsDir, { recursive: true });
    for (const line of lines) {
      await writeFile(path.join(resultsDir, `${line.id}.png`), Buffer.alloc(0));
    }

    assert.throws(
      () => runImagesStep(ctx(projectDir, false, "real")),
      (error) => {
        assert.ok(error instanceof ImagePipelinePendingError);
        assert.equal(error.pending, true);
        assert.equal(error.missing.length, expectedImageScenes.length);
        assert.ok(error.missing.every((item) => item.reason === "empty" && item.bytes === 0));
        assert.equal(error.warnings.length, expectedImageScenes.length);
        return true;
      }
    );

    const manifest = readImageManifest(projectDir);
    assert.equal(manifest.status, "pending");
    assert.deepEqual(manifest.assets, []);
    assert.equal(existsSync(path.join(projectDir, "versions.json")), false);
    for (const line of lines) {
      assert.equal(existsSync(path.join(projectDir, line.finalPath.slice(2))), false);
    }
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

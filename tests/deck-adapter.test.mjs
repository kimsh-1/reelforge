import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import {
  durationFramesToMs,
  renderManifestToMotionManifest,
  writeMotionManifest
} from "../src/pipeline/deck-adapter.mjs";

const REQUIRED_DECK_FIELDS = [
  "id",
  "path",
  "kind",
  "engine",
  "width",
  "height",
  "tokensRef",
  "altText",
  "durationMs",
  "durationFrames",
  "fps"
];

function mockRenderManifest(overrides = {}) {
  return {
    meta: {
      resolution: { width: 1920, height: 1080 },
      fps: 30,
      videoTheme: "dark",
      designTokens: {
        version: "1.0.0",
        presetId: "deck-adapter-test",
        colors: {
          background: "#102030",
          accent: "#f0c040"
        },
        moods: {},
        subtitle: {},
        fonts: {}
      },
      subtitleConfig: {}
    },
    scenes: [
      {
        sceneId: "s01",
        path: "./assets/scenes/s01.mp4",
        audioPath: "audio/s01.mp3",
        audioDurationSec: 4,
        durationFrames: 120,
        subtitles: [],
        vizAnimation: { stagger: 0, itemSyncPoints: [] },
        imagePath: null,
        kenBurns: { enabled: false, zoomFactor: 1, zoomDirection: "in", panDirection: "none" },
        startFrame: 0
      },
      {
        sceneId: "s02",
        path: "./assets/scenes/s02.mp4",
        audioPath: "audio/s02.mp3",
        audioDurationSec: 2.5,
        durationFrames: 75,
        subtitles: [],
        vizAnimation: { stagger: 0, itemSyncPoints: [] },
        imagePath: null,
        kenBurns: { enabled: false, zoomFactor: 1, zoomDirection: "in", panDirection: "none" },
        startFrame: 120
      }
    ],
    transitions: [],
    bgm: null,
    formatOverrides: {},
    ...overrides
  };
}

function mockSceneSpecs() {
  return {
    version: "1.0.0",
    projectId: "deck-adapter-test",
    scenes: [
      { sceneId: "s01", altText: "Opening motion clip with the headline build." },
      { sceneId: "s02", altText: "Second motion clip with a metric reveal." }
    ],
    transitions: []
  };
}

test("converts render-manifest scenes into complete deck motion assets", () => {
  const manifest = renderManifestToMotionManifest(mockRenderManifest(), mockSceneSpecs());

  assert.equal(manifest.assets.length, 2);
  for (const asset of manifest.assets) {
    for (const field of REQUIRED_DECK_FIELDS) {
      assert.ok(Object.hasOwn(asset, field), `missing ${field}`);
    }
    assert.equal(asset.kind, "motion");
    assert.equal(asset.engine, "hyperframes");
    assert.equal(asset.width, 1920);
    assert.equal(asset.height, 1080);
    assert.equal(asset.fps, 30);
    assert.equal(Math.round((asset.durationMs * asset.fps) / 1000), asset.durationFrames);
    assert.equal(asset.tokensRef, "deck-tokens:inline-background:#102030");
  }

  assert.deepEqual(
    manifest.assets.map((asset) => [asset.id, asset.path, asset.durationMs, asset.durationFrames, asset.altText]),
    [
      ["s01", "./assets/scenes/s01.mp4", 4000, 120, "Opening motion clip with the headline build."],
      ["s02", "./assets/scenes/s02.mp4", 2500, 75, "Second motion clip with a metric reveal."]
    ]
  );
});

test("fails when durationMs/fps cannot round-trip to durationFrames", () => {
  assert.throws(() => durationFramesToMs(1, 1500), /duration round-trip failed/);
});

test("fails when scene_specs lacks authored altText for a render scene", () => {
  assert.throws(
    () =>
      renderManifestToMotionManifest(mockRenderManifest(), {
        ...mockSceneSpecs(),
        scenes: [{ sceneId: "s01", altText: "Only the first scene is covered." }]
      }),
    /missing altText for sceneId s02/
  );
});

test("writes motion-manifest.json from file inputs", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "deck-adapter-"));
  try {
    const renderPath = path.join(dir, "render-manifest.json");
    const sceneSpecsPath = path.join(dir, "scene_specs.json");
    const outputPath = path.join(dir, "motion-manifest.json");

    await writeFile(renderPath, `${JSON.stringify(mockRenderManifest(), null, 2)}\n`);
    await writeFile(sceneSpecsPath, `${JSON.stringify(mockSceneSpecs(), null, 2)}\n`);

    const manifest = await writeMotionManifest({
      renderManifestPath: renderPath,
      sceneSpecsPath,
      outputPath
    });
    const written = JSON.parse(await readFile(outputPath, "utf8"));

    assert.deepEqual(written, manifest);
    assert.equal(written.assets[0].id, "s01");
    assert.equal(written.assets[0].durationFrames, 120);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

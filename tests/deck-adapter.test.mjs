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
        fonts: {
          headline: {
            family: "Pretendard Display",
            files: [{ path: "./assets/fonts/PretendardDisplay.woff2", weight: 700, style: "normal" }]
          },
          body: {
            family: "Pretendard",
            files: [{ path: "./assets/fonts/Pretendard.woff2", weight: 400, style: "normal" }]
          },
          mono: {
            family: "D2Coding",
            files: [{ path: "./assets/fonts/D2Coding.woff2", weight: 400, style: "normal" }]
          }
        }
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
  const tokenRefs = Object.keys(manifest.tokens);
  assert.equal(tokenRefs.length, 1);
  assert.match(tokenRefs[0], /^deck-tokens:inline:102030:[a-f0-9]{16}$/);
  assert.equal(manifest.tokens[tokenRefs[0]].palette.backgroundHex, "#102030");
  assert.deepEqual(manifest.tokens[tokenRefs[0]].palette.roles, {
    canvas: "#102030",
    accent: "#f0c040"
  });
  assert.equal(manifest.tokens[tokenRefs[0]].fonts.pair.display.family, "Pretendard Display");
  assert.equal(manifest.tokens[tokenRefs[0]].fonts.pair.body.family, "Pretendard");
  assert.equal(manifest.tokens[tokenRefs[0]].fonts.pair.mono.family, "D2Coding");

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
    assert.equal(asset.tokensRef, tokenRefs[0]);
  }

  assert.deepEqual(
    manifest.assets.map((asset) => [asset.id, asset.path, asset.durationMs, asset.durationFrames, asset.altText]),
    [
      ["s01", "./assets/scenes/s01.mp4", 4000, 120, "Opening motion clip with the headline build."],
      ["s02", "./assets/scenes/s02.mp4", 2500, 75, "Second motion clip with a metric reveal."]
    ]
  );
});

test("fails when render-manifest contains duplicate sceneId values", () => {
  const renderManifest = mockRenderManifest({
    scenes: [
      mockRenderManifest().scenes[0],
      {
        ...mockRenderManifest().scenes[1],
        sceneId: "s01"
      }
    ]
  });
  assert.throws(() => renderManifestToMotionManifest(renderManifest, mockSceneSpecs()), /duplicate render-manifest sceneId: s01/);
});

test("fails when durationMs/fps cannot round-trip to durationFrames", () => {
  assert.throws(() => durationFramesToMs(1, 1500), /duration round-trip failed/);
});

test("fails when scene_specs lacks authored altText for a render scene", () => {
  assert.throws(
    () =>
      renderManifestToMotionManifest(mockRenderManifest(), {
        ...mockSceneSpecs(),
        scenes: [{ sceneId: "s01", altText: "Only the first scene is covered." }, { sceneId: "s02" }]
      }),
    /scene_specs\.scenes\[1\]\.altText/
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

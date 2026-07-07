#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTtsStep, runRealTtsJob } from "../src/pipeline/tts/index.mjs";
import { isRetryableTtsError } from "../src/pipeline/tts/real.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpRoot = path.join(repoRoot, "tmp", "tts-adapter-test");

function sha256Text(value) {
  return createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

function sceneSpecs(scenes) {
  return {
    version: "1.0.0",
    projectId: `tts-adapter-${Date.now()}`,
    scenes: scenes.map((scene, index) => ({
      sceneId: scene.sceneId,
      sceneNumber: index + 1,
      narration: scene.text,
      narration_tts: scene.text,
      altText: "TTS adapter test scene",
      layout: "headline_only",
      mood: "informative",
      reveal: "fade_in",
      emphasis: "keyword",
      headline: "TTS",
      items: [],
      values: [],
      unit: "",
      source: "test:tts-adapter",
      visual_kind: "none",
      kenBurns: {
        enabled: false,
        zoomFactor: 1,
        zoomDirection: "in",
        panDirection: "none"
      },
      subtitleMode: "keyword"
    })),
    transitions: []
  };
}

function makeProject(name, scenes) {
  const projectDir = path.join(tmpRoot, name);
  rmSync(projectDir, { recursive: true, force: true });
  mkdirSync(projectDir, { recursive: true });
  writeFileSync(path.join(projectDir, "scene_specs.json"), `${JSON.stringify(sceneSpecs(scenes), null, 2)}\n`);
  return projectDir;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function ffprobeDuration(filePath) {
  const result = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", filePath],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr);
  const duration = Number(result.stdout.trim());
  assert(Number.isFinite(duration) && duration > 0, `invalid ffprobe duration: ${result.stdout}`);
  return duration;
}

function assertWords(words, durationSec) {
  assert(Array.isArray(words), "words must be an array");
  assert(words.length > 0, "words must not be empty");
  let previousEnd = 0;
  for (const word of words) {
    assert.equal(typeof word.word, "string");
    assert(word.word.length > 0);
    assert(word.start >= previousEnd, `word start is not monotonic: ${JSON.stringify(word)}`);
    assert(word.end >= word.start, `word end precedes start: ${JSON.stringify(word)}`);
    assert(word.end <= durationSec + 0.05, `word exceeds duration: ${JSON.stringify(word)} > ${durationSec}`);
    previousEnd = word.end;
  }
}

function writeToneMp3(outputPath, durationSec = 1.4) {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  const result = spawnSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=880:sample_rate=24000:duration=${durationSec}`,
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "64k",
      "-y",
      outputPath
    ],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr);
}

function fakeProvider(counter) {
  return {
    async synthesize({ text, outputPath }) {
      counter.calls += 1;
      writeToneMp3(outputPath);
      const parts = text.trim().split(/\s+/).filter(Boolean);
      const words = parts.map((word, index) => ({
        word,
        start: Number((index * 0.2).toFixed(3)),
        end: Number((index * 0.2 + 0.16).toFixed(3))
      }));
      return {
        provider: "fake-edge",
        voice: "ko-KR-test",
        words
      };
    }
  };
}

function failingTmpProvider() {
  return {
    async synthesize({ outputPath }) {
      mkdirSync(path.dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, Buffer.alloc(0));
      throw new Error("injected provider failure after tmp create");
    }
  };
}

async function testFailureCleansTmpAudio() {
  const projectDir = makeProject("failure-cleans-tmp", [
    {
      sceneId: "s01",
      text: "첫 번째 실패 합성입니다."
    },
    {
      sceneId: "s02",
      text: "두 번째 실패 합성입니다."
    }
  ]);
  const ctx = {
    repoRoot,
    projectDir,
    profile: "real",
    force: false,
    command: "failure-cleans-tmp"
  };

  await assert.rejects(
    () =>
      runRealTtsJob(ctx, {
        provider: "edge",
        concurrency: 2,
        providers: { edge: failingTmpProvider() }
      }),
    /injected provider failure/
  );

  const audioDir = path.join(projectDir, "assets", "audio");
  const names = existsSync(audioDir) ? readdirSync(audioDir) : [];
  assert.deepEqual(names.filter((name) => name.includes(".tmp.mp3")), [], "failed TTS must clean tmp mp3 files");
  const zeroMp3 = names
    .filter((name) => name.endsWith(".mp3"))
    .filter((name) => statSync(path.join(audioDir, name)).size === 0);
  assert.deepEqual(zeroMp3, [], "failed TTS must not leave 0-byte mp3 outputs");
  console.log("failure-cleans-tmp: PASS");
}

async function testLiveEdgeOrSkip() {
  const projectDir = makeProject("live-edge", [
    {
      sceneId: "s01",
      text: "안녕하세요, 오늘은 인공지능이 바꾸는 영상 제작의 미래를 살펴보겠습니다. 자막 싱크를 위해서는 단어 단위 타임스탬프가 반드시 필요합니다."
    }
  ]);

  try {
    await runRealTtsJob(
      {
        repoRoot,
        projectDir,
        profile: "real",
        force: false,
        command: "node tests/tts-adapter.test.mjs"
      },
      {
        provider: "edge",
        concurrency: 4,
        edgeTimeoutMs: 60000
      }
    );
  } catch (error) {
    if (isRetryableTtsError(error)) {
      console.log(`edge-live: SKIP ${error.message.split("\n")[0]}`);
      return;
    }
    throw error;
  }

  const audioMeta = readJson(path.join(projectDir, "audio_meta.json"));
  assert.equal(audioMeta.scenes.length, 1);
  const scene = audioMeta.scenes[0];
  assert.equal(scene.provider, "edge-tts");
  assert.equal(scene.voice, "ko-KR-SunHiNeural");
  assert.equal(scene.sourceHash, sha256Text(sceneSpecsText(projectDir)));
  const audioPath = path.join(projectDir, scene.audioPath);
  assert(existsSync(audioPath), "edge mp3 missing");
  const probed = ffprobeDuration(audioPath);
  assert(Math.abs(probed - scene.audioDurationSec) < 0.05, "audioDurationSec must match ffprobe");
  assertWords(scene.words, scene.audioDurationSec);
  assert(scene.words.length >= 8, "expected Korean WordBoundary entries");
  console.log(`edge-live: PASS words=${scene.words.length} duration=${scene.audioDurationSec}`);
}

function sceneSpecsText(projectDir) {
  return readJson(path.join(projectDir, "scene_specs.json")).scenes[0].narration_tts;
}

async function testSourceHashSkip() {
  const projectDir = makeProject("sourcehash-skip", [
    {
      sceneId: "s01",
      text: "같은 내레이션은 다시 합성하지 않습니다."
    }
  ]);
  const counter = { calls: 0 };
  const ctx = {
    repoRoot,
    projectDir,
    profile: "real",
    force: false,
    command: "sourcehash-skip"
  };

  const first = await runRealTtsJob(ctx, {
    provider: "edge",
    providers: { edge: fakeProvider(counter) }
  });
  assert.equal(first.generated, 1);
  assert.equal(first.reused, 0);
  const firstMeta = readJson(path.join(projectDir, "audio_meta.json"));
  const firstScene = firstMeta.scenes[0];
  const firstAudio = path.join(projectDir, firstScene.audioPath);
  const firstMtime = statSync(firstAudio).mtimeMs;

  const second = await runRealTtsJob(ctx, {
    provider: "edge",
    providers: { edge: fakeProvider(counter) }
  });
  const secondMeta = readJson(path.join(projectDir, "audio_meta.json"));
  assert.equal(counter.calls, 1, "unchanged sourceHash should skip provider call");
  assert.equal(second.generated, 0);
  assert.equal(second.reused, 1);
  assert.equal(secondMeta.scenes[0].audioPath, firstScene.audioPath);
  assert.equal(statSync(firstAudio).mtimeMs, firstMtime, "reused audio file should not be rewritten");
  assert.equal(secondMeta.scenes[0].sourceHash, sha256Text("같은 내레이션은 다시 합성하지 않습니다."));
  console.log("sourcehash-skip: PASS");
}

function testMockProfileDispatch() {
  const projectDir = makeProject("mock-dispatch", [
    {
      sceneId: "s01",
      text: "목 프로파일은 기존 목 티티에스를 사용합니다."
    }
  ]);
  const result = runTtsStep({
    repoRoot,
    projectDir,
    profile: "mock",
    force: false,
    command: "mock-dispatch"
  });
  assert.equal(result.provider, "mock-tts");
  const audioMeta = readJson(path.join(projectDir, "audio_meta.json"));
  assert.equal(audioMeta.scenes[0].provider, "mock-tts:ffmpeg-anullsrc");
  assert(existsSync(path.join(projectDir, audioMeta.scenes[0].audioPath)));
  assertWords(audioMeta.scenes[0].words, audioMeta.scenes[0].audioDurationSec);
  console.log("mock-dispatch: PASS");
}

rmSync(tmpRoot, { recursive: true, force: true });
mkdirSync(tmpRoot, { recursive: true });

await testLiveEdgeOrSkip();
await testFailureCleansTmpAudio();
await testSourceHashSkip();
testMockProfileDispatch();

console.log("tts-adapter: PASS");

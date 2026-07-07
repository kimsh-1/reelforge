#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileProject } from "../compiler/compiler.mjs";
import { runMockTtsStep } from "../pipeline/core/mock.mjs";
import { runPipeline } from "../pipeline/core/orchestrator.mjs";
import {
  IMAGE_MANIFEST_FILE,
  runImagesStep,
  validateImageManifestContract
} from "../pipeline/images/index.mjs";
import { runRealTtsJob } from "../pipeline/tts/index.mjs";
import {
  DirtyPipelineError,
  writeSceneSpecsWithBackup
} from "../pipeline/versions-impl/index.mjs";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const self = repoRel(fileURLToPath(import.meta.url));
const workRoot = path.join(repoRoot, "tmp", "gate-work", "p3");
const fps = 30;
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mP8z8BQDwAFgwJ/lCkmWQAAAABJRU5ErkJggg==",
  "base64"
);

function normalizeRelPath(value) {
  return value.split(path.sep).join("/");
}

function repoRel(filePath) {
  return normalizeRelPath(path.relative(repoRoot, filePath));
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function resetDir(dir) {
  rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sha256Text(value) {
  return sha256Bytes(Buffer.from(String(value ?? ""), "utf8"));
}

function check(pass, id, measured = {}) {
  return {
    id,
    pass: Boolean(pass),
    measured
  };
}

function stableEvidence(checks) {
  return checks.map((item) => ({
    id: item.id,
    pass: item.pass
  }));
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    maxBuffer: options.maxBuffer ?? 512 * 1024 * 1024,
    env: {
      ...process.env,
      ...(options.env ?? {})
    },
    timeout: options.timeout
  });
  return {
    command: [command, ...args].join(" "),
    exitCode: result.status ?? (result.signal ? 128 : 1),
    signal: result.signal ?? null,
    error: result.error?.message ?? null,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

function tail(value, max = 3000) {
  const text = String(value ?? "");
  return text.length > max ? text.slice(text.length - max) : text;
}

function ffprobeDuration(filePath) {
  const result = run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "stream=index,codec_type,codec_name,sample_rate",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    filePath
  ]);
  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    parsed = null;
  }
  const durationSec = Number.parseFloat(parsed?.format?.duration ?? "NaN");
  return {
    result,
    parsed,
    durationSec: Number.isFinite(durationSec) ? durationSec : null
  };
}

function wordsStatus(words, durationSec) {
  const violations = [];
  let previousEnd = 0;
  if (!Array.isArray(words) || words.length === 0) {
    violations.push({ rule: "words must be a non-empty array" });
    return { pass: false, violations };
  }
  words.forEach((word, index) => {
    if (!word || typeof word.word !== "string" || word.word.length === 0) {
      violations.push({ index, rule: "word text missing" });
    }
    if (!Number.isFinite(word.start) || !Number.isFinite(word.end)) {
      violations.push({ index, rule: "word timing must be finite numbers" });
      return;
    }
    if (word.end < word.start) violations.push({ index, rule: "word end before start", word });
    if (word.start < previousEnd) violations.push({ index, rule: "word start before previous end", previousEnd, word });
    if (Number.isFinite(durationSec) && word.end > durationSec) {
      violations.push({ index, rule: "word end exceeds audioDurationSec", durationSec, word });
    }
    previousEnd = Math.max(previousEnd, word.end);
  });
  return { pass: violations.length === 0, violations };
}

function copySceneSpecsOnly(fixtureName, targetDir, mutator = null) {
  rmSync(targetDir, { recursive: true, force: true });
  ensureDir(targetDir);
  const specs = readJson(path.join(repoRoot, "fixtures", "golden-specs", fixtureName, "scene_specs.json"));
  mutator?.(specs);
  writeJson(path.join(targetDir, "scene_specs.json"), specs);
  return specs;
}

function baseScene(index = 1, override = {}) {
  const sceneId = `s${String(index).padStart(2, "0")}`;
  return {
    sceneId,
    sceneNumber: index,
    narration: `테스트 장면 ${index} 내레이션입니다.`,
    narration_tts: `테스트 장면 ${index} 내레이션입니다.`,
    altText: `테스트 장면 ${index}`,
    layout: "headline_only",
    mood: "informative",
    reveal: "fade_in",
    emphasis: "keyword",
    headline: `테스트 ${index}`,
    items: [],
    values: [],
    unit: "",
    source: "gate:p3",
    visual_kind: "none",
    kenBurns: {
      enabled: false,
      zoomFactor: 1,
      zoomDirection: "in",
      panDirection: "none"
    },
    subtitleMode: "keyword",
    ...override
  };
}

function writeOneSceneProject(projectDir, sceneOverride = {}) {
  resetDir(projectDir);
  writeJson(path.join(projectDir, "scene_specs.json"), {
    version: "1.0.0",
    projectId: path.basename(projectDir).replace(/[^A-Za-z0-9_.-]/g, "-"),
    scenes: [baseScene(1, sceneOverride)],
    transitions: []
  });
}

function makeGeneratedImageProject(projectDir) {
  return copySceneSpecsOnly("minimal-3scene", projectDir, (specs) => {
    specs.projectId = `p3-image-${Date.now()}`;
    Object.assign(specs.scenes[0], {
      visual_kind: "generate_image",
      imageAsset: {
        prompt: "Clean editorial dashboard background without readable text",
        placement: "fullscreen"
      }
    });
    specs.scenes = [specs.scenes[0]];
    specs.transitions = [];
  });
}

function pipelineLogRunner(logs) {
  return (line) => logs.push(String(line));
}

function relativeProject(projectDir) {
  return repoRel(projectDir);
}

function pipelineCli(projectDir, args = [], options = {}) {
  return run(process.execPath, ["bin/vf", "pipeline", "run", relativeProject(projectDir), ...args], options);
}

function parseNodeTestSummary(stdout) {
  const summary = {};
  for (const line of stdout.split(/\r?\n/)) {
    const match = /^# (tests|pass|fail|skipped|todo|cancelled) (\d+)/.exec(line.trim());
    if (match) summary[match[1]] = Number(match[2]);
  }
  return summary;
}

async function runL13SubtitleBuilder() {
  const gateRoot = path.join(workRoot, "l1-3-subtitle-builder");
  resetDir(gateRoot);
  const p0c = readJson(path.join(repoRoot, "poc", "fixtures", "p0c", "audio_meta.json"));
  const p0Scene = p0c.scenes[0];
  const narration = "영상 공장이 가동을 시작했습니다.\n모든 자막은 실제 음성에 맞춰 정렬됩니다.";
  const checks = [];

  const realWords = wordsStatus(p0Scene.words, p0Scene.audioDurationSec);
  checks.push(
    check(realWords.pass, "real-audio-meta-fixture-words", {
      fixture: "poc/fixtures/p0c/audio_meta.json",
      provider: p0c.tts?.provider ?? null,
      voice: p0c.tts?.voice ?? null,
      wordCount: p0Scene.words.length,
      audioDurationSec: p0Scene.audioDurationSec,
      violations: realWords.violations
    })
  );

  for (const mode of ["keyword", "karaoke"]) {
    const projectDir = path.join(gateRoot, mode);
    resetDir(projectDir);
    ensureDir(path.join(projectDir, "assets", "audio"));
    copyFileSync(
      path.join(repoRoot, "poc", "fixtures", "p0c", p0Scene.audioPath),
      path.join(projectDir, "assets", "audio", "scene-01.mp3")
    );
    writeJson(path.join(projectDir, "scene_specs.json"), {
      version: "1.0.0",
      projectId: `l1-3-${mode}`,
      scenes: [
        baseScene(1, {
          narration,
          narration_tts: narration,
          headline: "실제 음성 자막",
          subtitleMode: mode
        })
      ],
      transitions: []
    });
    writeJson(path.join(projectDir, "audio_meta.json"), {
      scenes: [
        {
          sceneId: "s01",
          audioPath: "./assets/audio/scene-01.mp3",
          audioDurationSec: p0Scene.audioDurationSec,
          words: p0Scene.words,
          sourceHash: sha256Text(narration),
          provider: p0c.tts?.provider ?? "edge-tts",
          voice: p0c.tts?.voice ?? "ko-KR-SunHiNeural"
        }
      ]
    });

    let compiled = null;
    let compileError = null;
    try {
      compiled = compileProject({ repoRoot, projectDir });
    } catch (error) {
      compileError = error instanceof Error ? error.message : String(error);
    }
    checks.push(
      check(compiled?.pass === true, `compile:${mode}`, {
        project: relativeProject(projectDir),
        buildDir: compiled?.buildDir ?? null,
        error: compileError,
        warnings: compiled?.warnings ?? null
      })
    );
    if (compiled?.pass === true) {
      const manifest = readJson(path.join(projectDir, "build", "render-manifest.json"));
      const sceneHtml = readFileSync(path.join(projectDir, "build", "scenes", "scene-s01.html"), "utf8");
      const subtitle = manifest.scenes[0].subtitles[0];
      const subtitleWords = wordsStatus(subtitle.words, manifest.scenes[0].audioDurationSec);
      const hasMode = sceneHtml.includes(`data-subtitle-mode="${mode}"`);
      const hasModeRenderer =
        mode === "karaoke"
          ? sceneHtml.includes("&quot;renderer&quot;:&quot;gsap-karaoke&quot;")
          : sceneHtml.includes("&quot;renderer&quot;:&quot;keyword-spans&quot;");
      checks.push(
        check(
          subtitleWords.pass &&
            subtitle.endSec <= manifest.scenes[0].audioDurationSec &&
            hasMode &&
            hasModeRenderer,
          `subtitle-output:${mode}`,
          {
            mode,
            wordCount: subtitle.words.length,
            endSec: subtitle.endSec,
            audioDurationSec: manifest.scenes[0].audioDurationSec,
            hasMode,
            hasModeRenderer,
            violations: subtitleWords.violations
          }
        )
      );
    }
  }

  return {
    checks,
    inputSet: [
      self,
      "src/compiler/subtitles.mjs",
      "src/compiler/compiler.mjs",
      "poc/fixtures/p0c/audio_meta.json",
      "poc/fixtures/p0c/audio/scene-01.mp3",
      "fixtures/presets/light.json"
    ],
    evidence: stableEvidence(checks)
  };
}

async function runL14TtsContract({ profile }) {
  const gateRoot = path.join(workRoot, "l1-4-tts-contract");
  resetDir(gateRoot);
  const checks = [];

  const mockProject = path.join(gateRoot, "mock-roundtrip");
  writeOneSceneProject(mockProject, {
    narration: "목 티티에스 계약 왕복을 확인합니다.",
    narration_tts: "목 티티에스 계약 왕복을 확인합니다."
  });
  let mockResult = null;
  let mockError = null;
  try {
    mockResult = runMockTtsStep({
      repoRoot,
      projectDir: mockProject,
      profile: "mock",
      force: false,
      command: "l1-4 mock roundtrip"
    });
  } catch (error) {
    mockError = error instanceof Error ? error.message : String(error);
  }
  const mockMeta = existsSync(path.join(mockProject, "audio_meta.json"))
    ? readJson(path.join(mockProject, "audio_meta.json"))
    : null;
  const mockScene = mockMeta?.scenes?.[0] ?? null;
  const mockAudioPath = mockScene?.audioPath
    ? path.join(mockProject, mockScene.audioPath.replace(/^\.\//, ""))
    : null;
  const mockWords = wordsStatus(mockScene?.words, mockScene?.audioDurationSec);
  checks.push(
    check(
      mockResult?.provider === "mock-tts" &&
        mockScene?.provider === "mock-tts:ffmpeg-anullsrc" &&
        existsSync(mockAudioPath ?? "") &&
        statSync(mockAudioPath).size > 0 &&
        mockWords.pass,
      "mock-audio-request-to-audio-meta",
      {
        provider: mockResult?.provider ?? null,
        audioPath: mockScene?.audioPath ?? null,
        audioBytes: existsSync(mockAudioPath ?? "") ? statSync(mockAudioPath).size : 0,
        wordCount: mockScene?.words?.length ?? 0,
        sourceHashMatches: mockScene?.sourceHash === sha256Text("목 티티에스 계약 왕복을 확인합니다."),
        violations: mockWords.violations,
        error: mockError
      }
    )
  );

  if (profile !== "full") {
    checks.push(
      check(true, "edge-tts-real-one-sentence", {
        skipped: true,
        reason: "edge-tts live synthesis runs with --profile full"
      })
    );
  } else {
    const realProject = path.join(gateRoot, "edge-one-sentence");
    const realText = "무료 기본 티티에스 경로로 한 문장을 실제 합성합니다.";
    writeOneSceneProject(realProject, {
      narration: realText,
      narration_tts: realText
    });
    let realResult = null;
    let realError = null;
    try {
      realResult = await runRealTtsJob(
        {
          repoRoot,
          projectDir: realProject,
          profile: "real",
          force: true,
          command: "l1-4 edge-tts real one sentence"
        },
        {
          provider: "edge",
          concurrency: 1,
          edgeTimeoutMs: 90000
        }
      );
    } catch (error) {
      realError = error instanceof Error ? error.message : String(error);
    }
    const realMeta = existsSync(path.join(realProject, "audio_meta.json"))
      ? readJson(path.join(realProject, "audio_meta.json"))
      : null;
    const realScene = realMeta?.scenes?.[0] ?? null;
    const realAudioPath = realScene?.audioPath
      ? path.join(realProject, realScene.audioPath.replace(/^\.\//, ""))
      : null;
    const realWords = wordsStatus(realScene?.words, realScene?.audioDurationSec);
    checks.push(
      check(
        realResult?.provider === "edge-tts" &&
          realScene?.provider === "edge-tts" &&
          existsSync(realAudioPath ?? "") &&
          statSync(realAudioPath).size > 0 &&
          realWords.pass &&
          realScene.sourceHash === sha256Text(realText),
        "edge-tts-real-one-sentence",
        {
          provider: realResult?.provider ?? null,
          voice: realScene?.voice ?? null,
          audioPath: realScene?.audioPath ?? null,
          audioBytes: existsSync(realAudioPath ?? "") ? statSync(realAudioPath).size : 0,
          audioDurationSec: realScene?.audioDurationSec ?? null,
          wordCount: realScene?.words?.length ?? 0,
          violations: realWords.violations,
          error: realError ? tail(realError, 2000) : null
        }
      )
    );
  }

  return {
    checks,
    inputSet: [
      self,
      "src/pipeline/tts/index.mjs",
      "src/pipeline/tts/real.mjs",
      "src/pipeline/tts/providers.mjs",
      "src/pipeline/tts/edge_synth.py",
      "src/pipeline/core/mock.mjs",
      "schemas/audio-meta.schema.json"
    ],
    evidence: stableEvidence(checks)
  };
}

async function runL15AudioMeasure() {
  const gateRoot = path.join(workRoot, "l1-5-audio-measure");
  resetDir(gateRoot);
  const samples = [
    { name: "tone-1000.wav", durationSec: 1.0, args: ["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=1.0", "-codec:a", "pcm_s16le"] },
    { name: "silence-1750.wav", durationSec: 1.75, args: ["-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", "1.75", "-codec:a", "pcm_s16le"] },
    { name: "tone-1300.mp3", durationSec: 1.3, args: ["-f", "lavfi", "-i", "sine=frequency=660:sample_rate=24000:duration=1.3", "-codec:a", "libmp3lame", "-b:a", "64k"] }
  ];
  const checks = [];
  const manifest = { scenes: [] };

  for (const [index, sample] of samples.entries()) {
    const filePath = path.join(gateRoot, sample.name);
    const ffmpeg = run("ffmpeg", ["-v", "error", ...sample.args, "-y", filePath]);
    const initialProbe = ffprobeDuration(filePath);
    manifest.scenes.push({
      sceneId: `s${String(index + 1).padStart(2, "0")}`,
      audioPath: `./${sample.name}`,
      audioDurationSec: Number((initialProbe.durationSec ?? sample.durationSec).toFixed(6))
    });
    checks.push(
      check(ffmpeg.exitCode === 0 && initialProbe.result.exitCode === 0 && initialProbe.durationSec !== null, `sample-created:${sample.name}`, {
        command: ffmpeg.command,
        ffmpegExitCode: ffmpeg.exitCode,
        ffprobeExitCode: initialProbe.result.exitCode,
        durationSec: initialProbe.durationSec,
        codecNames: initialProbe.parsed?.streams?.map((stream) => stream.codec_name) ?? [],
        stderr: tail(ffmpeg.stderr || initialProbe.result.stderr, 1000)
      })
    );
  }

  writeJson(path.join(gateRoot, "audio-measure-manifest.json"), manifest);
  for (const scene of manifest.scenes) {
    const audioPath = path.join(gateRoot, scene.audioPath.replace(/^\.\//, ""));
    const probe = ffprobeDuration(audioPath);
    const deltaSec = probe.durationSec === null ? null : Math.abs(probe.durationSec - scene.audioDurationSec);
    checks.push(
      check(probe.result.exitCode === 0 && deltaSec !== null && deltaSec <= 0.01, `ffprobe-manifest-match:${scene.sceneId}`, {
        audioPath: scene.audioPath,
        manifestDurationSec: scene.audioDurationSec,
        ffprobeDurationSec: probe.durationSec,
        deltaSec,
        toleranceSec: 0.01,
        streams: probe.parsed?.streams?.map((stream) => ({
          codec_type: stream.codec_type,
          codec_name: stream.codec_name,
          sample_rate: stream.sample_rate ?? null
        })) ?? []
      })
    );
  }

  return {
    checks,
    inputSet: [self],
    evidence: stableEvidence(checks)
  };
}

async function runL16Versioning() {
  const result = run(process.execPath, ["--test", "tests/versions-lifecycle.test.mjs"], {
    timeout: 120000
  });
  const summary = parseNodeTestSummary(result.stdout);
  const requiredNames = [
    "snapshot backs up resources into append-only generations and increments gen",
    "select switches the active generation without deleting older files",
    "rollback moves selected to the previous generation and can restore the active file",
    "selected-aware resume state invalidates a completed step when selected changes",
    "pipeline lock rejects a concurrent project run before state or versions writes"
  ];
  const checks = [
    check(result.exitCode === 0 && summary.fail === 0, "versions-lifecycle-node-test", {
      command: result.command,
      exitCode: result.exitCode,
      summary,
      stderrTail: tail(result.stderr)
    }),
    check(requiredNames.every((name) => result.stdout.includes(name)), "versioning-wave1-cases-present", {
      requiredNames,
      missing: requiredNames.filter((name) => !result.stdout.includes(name))
    })
  ];
  return {
    checks,
    inputSet: [
      self,
      "tests/versions-lifecycle.test.mjs",
      "src/pipeline/core/lock.mjs",
      "src/pipeline/versions-impl/index.mjs",
      "src/pipeline/versions-impl/lifecycle.mjs",
      "src/pipeline/core/versions.mjs"
    ],
    evidence: stableEvidence(checks)
  };
}

async function runL17Resume() {
  const projectDir = path.join(workRoot, "l1-7-resume", "project");
  copySceneSpecsOnly("minimal-3scene", projectDir);
  const logs1 = [];
  const logs2 = [];
  const logs3 = [];
  const first = runPipeline({
    repoRoot,
    projectDir,
    profile: "mock",
    until: "images",
    command: "l1-7 first until images",
    log: pipelineLogRunner(logs1)
  });
  const second = runPipeline({
    repoRoot,
    projectDir,
    profile: "mock",
    until: "compile",
    command: "l1-7 resume until compile",
    log: pipelineLogRunner(logs2)
  });
  const third = runPipeline({
    repoRoot,
    projectDir,
    profile: "mock",
    until: "compile",
    command: "l1-7 idempotent resume until compile",
    log: pipelineLogRunner(logs3)
  });

  const checks = [
    check(first.pass === true && first.state.completedSteps.includes("tts") && first.state.completedSteps.includes("images"), "initial-run-flushes-completed-state", {
      completedSteps: first.state.completedSteps.filter((step) => ["tts", "images", "compile"].includes(step)),
      actions: first.steps.map((step) => `${step.step}:${step.action}`)
    }),
    check(
      second.pass === true &&
        second.steps.some((step) => step.step === "tts" && step.action === "skip") &&
        second.steps.some((step) => step.step === "images" && step.action === "skip") &&
        second.steps.some((step) => step.step === "compile" && step.action === "run"),
      "resume-skips-complete-and-runs-incomplete",
      {
        actions: second.steps.map((step) => `${step.step}:${step.action}`),
        logs: logs2.filter((line) => /SKIP|RUN|PASS/.test(line))
      }
    ),
    check(
      third.pass === true && third.steps.every((step) => step.action === "skip"),
      "second-resume-is-idempotent",
      {
        actions: third.steps.map((step) => `${step.step}:${step.action}`),
        logs: logs3.filter((line) => /SKIP|RUN|PASS/.test(line))
      }
    )
  ];
  return {
    checks,
    inputSet: [
      self,
      "src/pipeline/core/orchestrator.mjs",
      "src/pipeline/core/state.mjs",
      "src/pipeline/core/steps.mjs",
      "fixtures/golden-specs/minimal-3scene/scene_specs.json"
    ],
    evidence: stableEvidence(checks)
  };
}

async function runL31MockE2e() {
  const projectDir = path.join(workRoot, "l3-1-mock-e2e", "project");
  copySceneSpecsOnly("minimal-3scene", projectDir);
  const result = pipelineCli(projectDir, ["--profile", "mock"], { timeout: 240000 });
  const mp4Path = path.join(projectDir, "out", "main.mp4");
  const reportPath = path.join(projectDir, "reports", "pipeline-gate-report.json");
  const report = existsSync(reportPath) ? readJson(reportPath) : null;
  const checks = [
    check(result.exitCode === 0, "pipeline-cli-mock-completes", {
      command: result.command,
      exitCode: result.exitCode,
      stdoutSummary: result.stdout.split(/\r?\n/).filter((line) => /pipeline: (START|RUN|DONE|PASS|SKIP|FAIL|WAIT)/.test(line)),
      stderrTail: tail(result.stderr)
    }),
    check(existsSync(mp4Path) && statSync(mp4Path).size > 0, "final-mp4-exists", {
      output: repoRel(mp4Path),
      bytes: existsSync(mp4Path) ? statSync(mp4Path).size : 0
    }),
    check(report?.pass === true && report?.exitCode === 0, "project-pipeline-gate-report-pass", {
      report: repoRel(reportPath),
      pass: report?.pass ?? null,
      exitCode: report?.exitCode ?? null,
      checks: report?.checks?.length ?? 0
    })
  ];
  return {
    checks,
    inputSet: [
      self,
      "bin/vf",
      "src/pipeline/core/orchestrator.mjs",
      "src/pipeline/core/steps.mjs",
      "src/compiler/compiler.mjs",
      "fixtures/golden-specs/minimal-3scene/scene_specs.json"
    ],
    evidence: stableEvidence(checks)
  };
}

async function runL32RealTtsSmoke({ profile }) {
  const checks = [];
  if (profile !== "full") {
    checks.push(
      check(true, "real-tts-smoke-full-only", {
        skipped: true,
        reason: "real TTS smoke is registered for --profile full"
      })
    );
    return { checks, inputSet: [self], evidence: stableEvidence(checks) };
  }

  const projectDir = path.join(workRoot, "l3-2-real-tts-smoke", "project");
  const text = "실제 무료 티티에스로 워드 싱크를 검증합니다.";
  writeOneSceneProject(projectDir, {
    narration: text,
    narration_tts: text
  });
  const result = pipelineCli(projectDir, ["--profile", "real", "--until", "tts", "--force"], {
    timeout: 180000
  });
  const audioMeta = existsSync(path.join(projectDir, "audio_meta.json"))
    ? readJson(path.join(projectDir, "audio_meta.json"))
    : null;
  const scene = audioMeta?.scenes?.[0] ?? null;
  const audioPath = scene?.audioPath ? path.join(projectDir, scene.audioPath.replace(/^\.\//, "")) : null;
  const words = wordsStatus(scene?.words, scene?.audioDurationSec);
  const probe = audioPath && existsSync(audioPath) ? ffprobeDuration(audioPath) : null;
  const durationDelta = probe?.durationSec === null || !scene ? null : Math.abs(probe.durationSec - scene.audioDurationSec);
  checks.push(
    check(result.exitCode === 0, "pipeline-real-until-tts", {
      command: result.command,
      exitCode: result.exitCode,
      stdoutSummary: result.stdout.split(/\r?\n/).filter((line) => /pipeline: (START|RUN|DONE|PASS|FAIL)/.test(line)),
      stderrTail: tail(result.stderr)
    })
  );
  checks.push(
    check(scene?.provider === "edge-tts" && existsSync(audioPath ?? "") && statSync(audioPath).size > 0, "actual-edge-audio-meta", {
      provider: scene?.provider ?? null,
      voice: scene?.voice ?? null,
      audioPath: scene?.audioPath ?? null,
      audioBytes: existsSync(audioPath ?? "") ? statSync(audioPath).size : 0,
      sourceHashMatches: scene?.sourceHash === sha256Text(text)
    })
  );
  checks.push(
    check(durationDelta !== null && durationDelta <= 0.05, "l2-6-real-tts-audio-duration-recheck", {
      audioDurationSec: scene?.audioDurationSec ?? null,
      ffprobeDurationSec: probe?.durationSec ?? null,
      deltaSec: durationDelta,
      toleranceSec: 0.05
    })
  );
  checks.push(
    check(words.pass && (scene?.words?.length ?? 0) >= 3, "l2-9-real-tts-word-sync-recheck", {
      wordCount: scene?.words?.length ?? 0,
      firstWord: scene?.words?.[0] ?? null,
      lastWord: scene?.words?.at?.(-1) ?? null,
      violations: words.violations
    })
  );
  return {
    checks,
    inputSet: [
      self,
      "bin/vf",
      "src/pipeline/tts/real.mjs",
      "src/pipeline/tts/providers.mjs",
      "src/pipeline/tts/edge_synth.py",
      "src/pipeline/core/orchestrator.mjs"
    ],
    evidence: stableEvidence(checks)
  };
}

async function runL35Reroll() {
  const projectDir = path.join(workRoot, "l3-5-reroll", "project");
  makeGeneratedImageProject(projectDir);
  const ctx = {
    repoRoot,
    projectDir,
    profile: "mock",
    force: false,
    command: "l3-5 initial image generation"
  };
  const first = runImagesStep(ctx);
  const second = runImagesStep({ ...ctx, force: true, command: "l3-5 forced image reroll" });
  const versions = readJson(path.join(projectDir, "versions.json"));
  const manifest = readJson(path.join(projectDir, IMAGE_MANIFEST_FILE));
  const resource = versions.resources.image_s01;
  const gen01 = resource.entries.find((entry) => entry.gen === "gen_01");
  const gen02 = resource.entries.find((entry) => entry.gen === "gen_02");
  const checks = [
    check(first.generated === 1 && first.reused === 0, "initial-generation-gen-01", {
      generated: first.generated,
      reused: first.reused,
      assets: first.assets
    }),
    check(second.generated === 1 && second.reused === 0, "reroll-generates-gen-02", {
      generated: second.generated,
      reused: second.reused,
      assets: second.assets
    }),
    check(
      resource.selected === "gen_02" &&
        existsSync(path.join(projectDir, gen01.path.replace(/^\.\//, ""))) &&
        existsSync(path.join(projectDir, gen02.path.replace(/^\.\//, ""))),
      "selected-switches-and-preserves-prior-generation",
      {
        selected: resource.selected,
        entries: resource.entries.map((entry) => ({ gen: entry.gen, path: entry.path })),
        manifestAssets: manifest.assets.map((asset) => ({ sceneId: asset.sceneId, gen: asset.gen, path: asset.path }))
      }
    )
  ];
  return {
    checks,
    inputSet: [
      self,
      "src/pipeline/images/index.mjs",
      "src/pipeline/versions-impl/index.mjs",
      "fixtures/golden-specs/minimal-3scene/scene_specs.json"
    ],
    evidence: stableEvidence(checks)
  };
}

function runKillOnRender(projectDir) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["bin/vf", "pipeline", "run", relativeProject(projectDir), "--profile", "mock"], {
      cwd: repoRoot,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let killed = false;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        // Process may have already exited.
      }
    }, 180000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (!killed && stdout.includes("pipeline: RUN render")) {
        killed = true;
        setTimeout(() => {
          try {
            process.kill(-child.pid, "SIGTERM");
          } catch {
            // Process may have already exited.
          }
        }, 50);
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? (signal ? 128 : 1),
        signal,
        stdout,
        stderr,
        killed,
        timedOut
      });
    });
  });
}

async function runL36KillResume() {
  const projectDir = path.join(workRoot, "l3-6-kill-resume", "project");
  copySceneSpecsOnly("minimal-3scene", projectDir);
  const killed = await runKillOnRender(projectDir);
  const stateAfterKill = existsSync(path.join(projectDir, "pipeline_state.json"))
    ? readJson(path.join(projectDir, "pipeline_state.json"))
    : null;
  const resumed = pipelineCli(projectDir, ["--profile", "mock"], { timeout: 240000 });
  const stateAfterResume = existsSync(path.join(projectDir, "pipeline_state.json"))
    ? readJson(path.join(projectDir, "pipeline_state.json"))
    : null;
  const mp4Path = path.join(projectDir, "out", "main.mp4");
  const reportPath = path.join(projectDir, "reports", "pipeline-gate-report.json");
  const checks = [
    check(
      killed.killed &&
        killed.exitCode !== 0 &&
        stateAfterKill?.completedSteps?.includes("tts") &&
        stateAfterKill.completedSteps.includes("images") &&
        stateAfterKill.completedSteps.includes("compile") &&
        !stateAfterKill.completedSteps.includes("render"),
      "kill-after-render-start-preserves-completed-prefix",
      {
        exitCode: killed.exitCode,
        signal: killed.signal,
        timedOut: killed.timedOut,
        completedSteps: stateAfterKill?.completedSteps ?? null,
        stdoutSummary: killed.stdout.split(/\r?\n/).filter((line) => /pipeline: (START|RUN|DONE|SKIP|PASS|FAIL)/.test(line))
      }
    ),
    check(
      resumed.exitCode === 0 &&
        resumed.stdout.includes("pipeline: SKIP tts") &&
        resumed.stdout.includes("pipeline: SKIP images") &&
        resumed.stdout.includes("pipeline: SKIP compile") &&
        resumed.stdout.includes("pipeline: RUN render") &&
        resumed.stdout.includes("pipeline: RUN gate"),
      "resume-skips-completed-and-finishes",
      {
        exitCode: resumed.exitCode,
        stdoutSummary: resumed.stdout.split(/\r?\n/).filter((line) => /pipeline: (START|RUN|DONE|SKIP|PASS|FAIL)/.test(line)),
        stderrTail: tail(resumed.stderr)
      }
    ),
    check(
      existsSync(mp4Path) &&
        statSync(mp4Path).size > 0 &&
        existsSync(reportPath) &&
        readJson(reportPath).pass === true &&
        stateAfterResume?.completedSteps?.includes("gate"),
      "resumed-final-artifacts-exist",
      {
        output: repoRel(mp4Path),
        bytes: existsSync(mp4Path) ? statSync(mp4Path).size : 0,
        report: repoRel(reportPath),
        completedSteps: stateAfterResume?.completedSteps ?? null
      }
    )
  ];
  return {
    checks,
    inputSet: [
      self,
      "bin/vf",
      "src/pipeline/core/orchestrator.mjs",
      "src/pipeline/core/state.mjs",
      "src/pipeline/core/steps.mjs",
      "fixtures/golden-specs/minimal-3scene/scene_specs.json"
    ],
    evidence: stableEvidence(checks)
  };
}

function imagePromptLines(projectDir) {
  const promptsPath = path.join(projectDir, "assets", "images", "runner", "prompts.jsonl");
  if (!existsSync(promptsPath)) return [];
  return readFileSync(promptsPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function u3CaseBrokenAudioMetaResume(root) {
  const projectDir = path.join(root, "u3p-01-broken-audio-meta-resume");
  copySceneSpecsOnly("minimal-3scene", projectDir);
  runPipeline({ repoRoot, projectDir, profile: "mock", until: "tts", command: "u3p-01 setup", log: () => {} });
  const meta = readJson(path.join(projectDir, "audio_meta.json"));
  meta.scenes[0].words[0].end = 0;
  meta.scenes[0].words[0].start = 1;
  writeJson(path.join(projectDir, "audio_meta.json"), meta);
  let rejected = false;
  let message = "";
  try {
    runPipeline({ repoRoot, projectDir, profile: "mock", until: "compile", command: "u3p-01 resume", log: () => {} });
  } catch (error) {
    rejected = true;
    message = error instanceof Error ? error.message : String(error);
  }
  return check(rejected && /semantic validation failed|word timing/.test(message), "U3P-01 broken audio_meta injection rejected on resume", {
    rejected,
    message: tail(message, 1000)
  });
}

async function u3CaseSceneEditDirtyGuard(root) {
  const projectDir = path.join(root, "u3p-02-scene-edit-dirty-guard");
  copySceneSpecsOnly("minimal-3scene", projectDir);
  runPipeline({ repoRoot, projectDir, profile: "mock", until: "tts", command: "u3p-02 setup", log: () => {} });
  const specs = readJson(path.join(projectDir, "scene_specs.json"));
  specs.scenes[0].headline = "파이프라인 중 편집";
  writeSceneSpecsWithBackup({ repoRoot, projectDir, sceneSpecs: specs, owner: "u3-pipeline" });
  let rejected = false;
  let isDirty = false;
  let message = "";
  try {
    runPipeline({ repoRoot, projectDir, profile: "mock", until: "images", command: "u3p-02 resume", log: () => {} });
  } catch (error) {
    rejected = true;
    isDirty = error instanceof DirtyPipelineError;
    message = error instanceof Error ? error.message : String(error);
  }
  return check(rejected && isDirty, "U3P-02 scene_specs edit during pipeline blocked by dirty guard", {
    rejected,
    isDirty,
    message
  });
}

async function u3CaseDeletedSelectedRegenerates(root) {
  const projectDir = path.join(root, "u3p-03-deleted-selected-regenerates");
  makeGeneratedImageProject(projectDir);
  const logs1 = [];
  const logs2 = [];
  runPipeline({ repoRoot, projectDir, profile: "mock", until: "images", command: "u3p-03 setup", log: pipelineLogRunner(logs1) });
  const versionsBefore = readJson(path.join(projectDir, "versions.json"));
  const selectedBefore = versionsBefore.resources.image_s01.entries.find(
    (entry) => entry.gen === versionsBefore.resources.image_s01.selected
  );
  rmSync(path.join(projectDir, selectedBefore.path.replace(/^\.\//, "")), { force: true });
  const resumed = runPipeline({
    repoRoot,
    projectDir,
    profile: "mock",
    until: "images",
    command: "u3p-03 resume",
    log: pipelineLogRunner(logs2)
  });
  const versionsAfter = readJson(path.join(projectDir, "versions.json"));
  const selectedAfter = versionsAfter.resources.image_s01.entries.find(
    (entry) => entry.gen === versionsAfter.resources.image_s01.selected
  );
  return check(
    resumed.pass === true &&
      versionsAfter.resources.image_s01.selected === "gen_02" &&
      existsSync(path.join(projectDir, selectedAfter.path.replace(/^\.\//, ""))) &&
      logs2.some((line) => line.includes("missing-manifest-assets")),
    "U3P-03 deleted selected image is regenerated safely",
    {
      before: selectedBefore,
      after: selectedAfter,
      logs: logs2.filter((line) => /SKIP|RUN|DONE|missing-manifest-assets/.test(line))
    }
  );
}

async function u3CaseRunnerTrashIgnored(root) {
  const projectDir = path.join(root, "u3p-04-runner-trash-ignored");
  makeGeneratedImageProject(projectDir);
  let firstPending = false;
  try {
    runImagesStep({ repoRoot, projectDir, profile: "real", force: false, command: "u3p-04 pending" });
  } catch (error) {
    firstPending = error?.pending === true;
  }
  const trashPath = path.join(projectDir, "assets", "images", "runner", "results", "trash.png");
  ensureDir(path.dirname(trashPath));
  writeFileSync(trashPath, tinyPng);
  let secondPending = false;
  let missing = [];
  try {
    runImagesStep({ repoRoot, projectDir, profile: "real", force: false, command: "u3p-04 rerun" });
  } catch (error) {
    secondPending = error?.pending === true;
    missing = error?.missing ?? [];
  }
  return check(firstPending && secondPending && missing.length === 1, "U3P-04 runner recovery trash PNG is ignored", {
    firstPending,
    secondPending,
    missing,
    trash: repoRel(trashPath)
  });
}

async function u3CasePendingRerunStaysPending(root) {
  const projectDir = path.join(root, "u3p-05-pending-rerun-stays-pending");
  makeGeneratedImageProject(projectDir);
  const first = runPipeline({ repoRoot, projectDir, profile: "real", only: "images", command: "u3p-05 first", log: () => {} });
  const second = runPipeline({ repoRoot, projectDir, profile: "real", only: "images", command: "u3p-05 second", log: () => {} });
  const state = readJson(path.join(projectDir, "pipeline_state.json"));
  const manifest = readJson(path.join(projectDir, IMAGE_MANIFEST_FILE));
  return check(
    first.pending === true &&
      second.pending === true &&
      second.pendingStep === "images" &&
      !state.completedSteps.includes("images") &&
      manifest.status === "pending",
    "U3P-05 rerun while image runner is pending remains resumable",
    {
      firstPending: first.pending,
      secondPending: second.pending,
      completedSteps: state.completedSteps,
      manifestStatus: manifest.status
    }
  );
}

async function u3CasePendingRecovery(root) {
  const projectDir = path.join(root, "u3p-06-pending-recovery");
  makeGeneratedImageProject(projectDir);
  const first = runPipeline({ repoRoot, projectDir, profile: "real", only: "images", command: "u3p-06 first", log: () => {} });
  for (const line of imagePromptLines(projectDir)) {
    const resultPath = path.join(projectDir, line.resultPath.replace(/^\.\//, ""));
    ensureDir(path.dirname(resultPath));
    writeFileSync(resultPath, tinyPng);
  }
  const second = runPipeline({ repoRoot, projectDir, profile: "real", only: "images", command: "u3p-06 recover", log: () => {} });
  const manifest = readJson(path.join(projectDir, IMAGE_MANIFEST_FILE));
  const validation = validateImageManifestContract(manifest, ["s01"]);
  return check(
    first.pending === true && second.pass === true && manifest.status === "complete" && validation.pass === true,
    "U3P-06 pending runner recovers when requested PNG appears",
    {
      firstPending: first.pending,
      secondPass: second.pass,
      manifestStatus: manifest.status,
      validationErrors: validation.errors
    }
  );
}

async function u3CaseDirtyReject(root) {
  const projectDir = path.join(root, "u3p-07-dirty-reject");
  copySceneSpecsOnly("minimal-3scene", projectDir);
  writeJson(path.join(projectDir, "versions.json"), { resources: {}, editLock: null, dirty: true });
  let rejected = false;
  let message = "";
  try {
    runPipeline({ repoRoot, projectDir, profile: "mock", until: "tts", command: "u3p-07", log: () => {} });
  } catch (error) {
    rejected = true;
    message = error instanceof Error ? error.message : String(error);
  }
  return check(rejected && /dirty=true/.test(message), "U3P-07 dirty versions rejects blind pipeline run", {
    rejected,
    message
  });
}

async function u3CaseForceDirtyAllows(root) {
  const projectDir = path.join(root, "u3p-08-force-dirty-allows");
  copySceneSpecsOnly("minimal-3scene", projectDir);
  writeJson(path.join(projectDir, "versions.json"), { resources: {}, editLock: null, dirty: true });
  const logs = [];
  const result = runPipeline({
    repoRoot,
    projectDir,
    profile: "mock",
    until: "tts",
    forceDirty: true,
    command: "u3p-08",
    log: pipelineLogRunner(logs)
  });
  return check(result.pass === true && logs.some((line) => line.includes("WARN")), "U3P-08 force-dirty proceeds with explicit warning", {
    pass: result.pass,
    warning: logs.find((line) => line.includes("WARN")) ?? null,
    completedSteps: result.state.completedSteps
  });
}

async function u3CaseMissingOutputReruns(root) {
  const projectDir = path.join(root, "u3p-09-missing-output-reruns");
  copySceneSpecsOnly("minimal-3scene", projectDir);
  runPipeline({ repoRoot, projectDir, profile: "mock", until: "tts", command: "u3p-09 setup", log: () => {} });
  rmSync(path.join(projectDir, "audio_meta.json"), { force: true });
  const result = runPipeline({ repoRoot, projectDir, profile: "mock", until: "tts", command: "u3p-09 rerun", log: () => {} });
  return check(
    result.pass === true && result.steps.some((step) => step.step === "tts" && step.action === "run"),
    "U3P-09 missing completed-step output forces rerun instead of skip",
    {
      actions: result.steps.map((step) => `${step.step}:${step.action}`),
      audioMetaExists: existsSync(path.join(projectDir, "audio_meta.json"))
    }
  );
}

async function u3CaseCorruptStateHashReruns(root) {
  const projectDir = path.join(root, "u3p-10-corrupt-state-hash-reruns");
  copySceneSpecsOnly("minimal-3scene", projectDir);
  runPipeline({ repoRoot, projectDir, profile: "mock", until: "tts", command: "u3p-10 setup", log: () => {} });
  const state = readJson(path.join(projectDir, "pipeline_state.json"));
  state.stepHashes.tts = "0".repeat(64);
  writeJson(path.join(projectDir, "pipeline_state.json"), state);
  const result = runPipeline({ repoRoot, projectDir, profile: "mock", until: "tts", command: "u3p-10 rerun", log: () => {} });
  return check(
    result.pass === true && result.steps.some((step) => step.step === "tts" && step.action === "run"),
    "U3P-10 corrupt completed-step hash forces rerun",
    {
      actions: result.steps.map((step) => `${step.step}:${step.action}`),
      completedSteps: result.state.completedSteps
    }
  );
}

async function u3CaseStaleAudioSourceHashRejected(root) {
  const projectDir = path.join(root, "u3p-11-stale-audio-sourcehash");
  copySceneSpecsOnly("minimal-3scene", projectDir);
  runPipeline({ repoRoot, projectDir, profile: "mock", until: "tts", command: "u3p-11 setup", log: () => {} });
  const specs = readJson(path.join(projectDir, "scene_specs.json"));
  specs.scenes[0].narration_tts = `${specs.scenes[0].narration_tts} 직접 편집`;
  writeJson(path.join(projectDir, "scene_specs.json"), specs);
  let rejected = false;
  let message = "";
  const logs = [];
  try {
    runPipeline({ repoRoot, projectDir, profile: "mock", only: "gate", command: "u3p-11 gate", log: pipelineLogRunner(logs) });
  } catch (error) {
    rejected = true;
    message = error instanceof Error ? error.message : String(error);
  }
  const reportPath = path.join(projectDir, "reports", "pipeline-gate-report.json");
  const report = existsSync(reportPath) ? readJson(reportPath) : null;
  const sourceHashCheck = report?.checks?.find((item) => item.id === "l0-12:scene-audio-sourcehash") ?? null;
  return check(
    rejected && sourceHashCheck?.pass === false && /sourceHash/.test(JSON.stringify(sourceHashCheck)),
    "U3P-11 stale audio_meta sourceHash is rejected by gate-only run",
    {
      rejected,
      message: tail(message, 1000),
      sourceHashCheck,
      logs: logs.filter((line) => /RUN|FAIL/.test(line))
    }
  );
}

export async function runU3PipelineSuite() {
  const root = path.join(workRoot, "u3-pipeline");
  resetDir(root);
  const cases = [
    u3CaseBrokenAudioMetaResume,
    u3CaseSceneEditDirtyGuard,
    u3CaseDeletedSelectedRegenerates,
    u3CaseRunnerTrashIgnored,
    u3CasePendingRerunStaysPending,
    u3CasePendingRecovery,
    u3CaseDirtyReject,
    u3CaseForceDirtyAllows,
    u3CaseMissingOutputReruns,
    u3CaseCorruptStateHashReruns,
    u3CaseStaleAudioSourceHashRejected
  ];
  const checks = [];
  for (const runCase of cases) {
    try {
      checks.push(await runCase(root));
    } catch (error) {
      checks.push(
        check(false, runCase.name, {
          error: error instanceof Error ? error.message : String(error)
        })
      );
    }
  }
  checks.push(
    check(checks.filter((item) => item.id.startsWith("U3P-") && item.pass).length === 11, "u3-pipeline-suite-complete", {
      cases: checks.filter((item) => item.id.startsWith("U3P-")).length,
      passed: checks.filter((item) => item.id.startsWith("U3P-") && item.pass).length
    })
  );
  return {
    checks,
    inputSet: [
      self,
      "tests/scenarios/u3-pipeline-suite.mjs",
      "tests/scenarios/u3-pipeline.md",
      "src/pipeline/core/orchestrator.mjs",
      "src/pipeline/core/steps.mjs",
      "src/gates/semantic.mjs",
      "src/pipeline/images/index.mjs",
      "src/pipeline/versions-impl/index.mjs",
      "fixtures/golden-specs/minimal-3scene/scene_specs.json"
    ],
    evidence: stableEvidence(checks)
  };
}

async function runL35WaveWrapper() {
  const result = run(process.execPath, ["--test", "tests/versions-lifecycle.test.mjs"], {
    timeout: 120000
  });
  const summary = parseNodeTestSummary(result.stdout);
  const checks = [
    check(result.exitCode === 0 && summary.fail === 0, "versions-lifecycle-node-test", {
      command: result.command,
      exitCode: result.exitCode,
      summary,
      stderrTail: tail(result.stderr)
    }),
    check(result.stdout.includes("L3-5 mock image reroll preserves gen_01 and compiles with selected gen_02"), "l3-5-wave1-case-present", {
      present: result.stdout.includes("L3-5 mock image reroll preserves gen_01 and compiles with selected gen_02")
    })
  ];
  return {
    checks,
    inputSet: [
      self,
      "tests/versions-lifecycle.test.mjs",
      "src/pipeline/versions-impl/index.mjs",
      "src/pipeline/versions-impl/lifecycle.mjs"
    ],
    evidence: stableEvidence(checks)
  };
}

const gateRunners = new Map([
  ["l1-3-subtitle-builder", runL13SubtitleBuilder],
  ["l1-4-tts-contract", runL14TtsContract],
  ["l1-5-audio-measure", runL15AudioMeasure],
  ["l1-6-versioning", runL16Versioning],
  ["l1-7-resume", runL17Resume],
  ["l3-1-mock-e2e", runL31MockE2e],
  ["l3-2-real-tts-smoke", runL32RealTtsSmoke],
  ["l3-5-reroll", runL35Reroll],
  ["l3-5-reroll-wave1", runL35WaveWrapper],
  ["l3-6-kill-resume", runL36KillResume],
  ["u3-pipeline", runU3PipelineSuite]
]);

function optionValue(args, optionName) {
  const index = args.indexOf(optionName);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${optionName} requires a value`);
  return value;
}

export async function runGateById({ gateId, profile = "fast" }) {
  const runner = gateRunners.get(gateId);
  if (!runner) throw new Error(`unknown P3 gate runner: ${gateId}`);
  return runner({ profile });
}

export async function printGateResult(runGate, { profile = "fast", json = false } = {}) {
  let result;
  try {
    result = await runGate({ profile });
  } catch (error) {
    result = {
      checks: [
        {
          id: "p3-gate-runner-error",
          pass: false,
          measured: {
            error: error instanceof Error ? error.stack ?? error.message : String(error)
          }
        }
      ],
      inputSet: [self],
      evidence: []
    };
  }

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const item of result.checks ?? []) {
      console.log(`${item.id}: ${item.pass ? "PASS" : "FAIL"}`);
    }
  }
  if (!Array.isArray(result.checks) || result.checks.length === 0 || result.checks.some((item) => item.pass !== true)) {
    process.exitCode = 1;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const gateId = optionValue(args, "--gate");
  const profile = optionValue(args, "--profile") ?? "fast";
  const json = args.includes("--json");
  if (!gateId) throw new Error("--gate is required");
  await printGateResult((options) => runGateById({ gateId, ...options }), { profile, json });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}

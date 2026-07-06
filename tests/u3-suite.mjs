#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatAjvErrors, validateJsonForSchema } from "../src/gates/registry.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpRoot = path.join(repoRoot, "tmp", "u3-suite");
const gateRoot = path.join(repoRoot, ".u3-suite-gate");
const commandTimeoutMs = 15_000;
const hash64 = "a".repeat(64);

const schemaTargets = {
  "scene-specs": "scene_specs.json",
  "audio-meta": "audio_meta.json",
  versions: "versions.json"
};

function clone(value) {
  return structuredClone(value);
}

function deepMerge(base, override) {
  const next = clone(base);
  for (const [key, value] of Object.entries(override ?? {})) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      next[key] &&
      typeof next[key] === "object" &&
      !Array.isArray(next[key])
    ) {
      next[key] = deepMerge(next[key], value);
    } else {
      next[key] = value;
    }
  }
  return next;
}

function baseScene(index = 1, override = {}) {
  const id = `s${String(index).padStart(2, "0")}`;
  return deepMerge(
    {
      sceneId: id,
      sceneNumber: index,
      narration: `Narration for ${id}.`,
      narration_tts: `Narration for ${id}.`,
      altText: `Alt text for ${id}`,
      layout: "headline_only",
      mood: "informative",
      reveal: "fade_in",
      emphasis: "keyword",
      headline: `Headline ${id}`,
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
      subtitleMode: "keyword"
    },
    override
  );
}

function sceneSpecs({ scenes = [baseScene()], transitions = [], projectId = "u3-suite" } = {}) {
  return {
    version: "1.0.0",
    projectId,
    scenes,
    transitions
  };
}

function baseAudioScene(override = {}) {
  return deepMerge(
    {
      sceneId: "s01",
      audioPath: "./assets/audio/s01.mp3",
      audioDurationSec: 1.25,
      words: [{ word: "hello", start: 0, end: 0.4 }],
      sourceHash: hash64,
      provider: "mock",
      voice: "ko-test"
    },
    override
  );
}

function audioMeta({ scene = {}, scenes = [baseAudioScene(scene)] } = {}) {
  return { scenes };
}

function versions(override = {}) {
  return deepMerge(
    {
      resources: {
        image: {
          entries: [
            {
              gen: "gen_01",
              path: "./assets/images/gen_01.txt",
              createdAt: "2026-07-07T00:00:00.000Z",
              note: "u3 fixture"
            }
          ],
          selected: "gen_01"
        }
      },
      editLock: null,
      dirty: false
    },
    override
  );
}

function rawJson(value) {
  return JSON.stringify(value);
}

function transition(from, to) {
  return { from, to, type: "fade", duration: 0.25 };
}

function makeAudioGateFixture(dir, data, setupAssets) {
  setupAssets?.(dir);
  writeFileSync(path.join(dir, "audio_meta.json"), `${JSON.stringify(data, null, 2)}\n`);
}

function makeVersionsGateFixture(dir, data, setupAssets) {
  setupAssets?.(dir);
  writeFileSync(path.join(dir, "versions.json"), `${JSON.stringify(data, null, 2)}\n`);
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

const cases = [
  {
    id: "U3-01",
    name: "빈 narration",
    schema: "scene-specs",
    input: "scene_specs.scenes[0].narration = \"\"",
    expected: "narration minLength 위반 반려",
    raw: () => rawJson(sceneSpecs({ scenes: [baseScene(1, { narration: "" })] }))
  },
  {
    id: "U3-02",
    name: "3만자 초장문 narration",
    schema: "scene-specs",
    input: "scene_specs narration/narration_tts 30,000 chars",
    expected: "비정상 장문 입력 반려",
    raw: () => {
      const longText = "가".repeat(30_000);
      return rawJson(sceneSpecs({ scenes: [baseScene(1, { narration: longText, narration_tts: longText })] }));
    }
  },
  {
    id: "U3-03",
    name: "이모지·제로폭 문자 씬 제목",
    schema: "scene-specs",
    input: "scene_specs.scenes[0].headline contains U+200B and emoji",
    expected: "제로폭 제목 문자 반려, emoji 자체는 허용",
    raw: () => rawJson(sceneSpecs({ scenes: [baseScene(1, { headline: "제로\u200b폭 🚀 제목" })] }))
  },
  {
    id: "U3-04",
    name: "특수문자 sceneId",
    schema: "scene-specs",
    input: "scene_specs.scenes[0].sceneId = \"s@01\"",
    expected: "sceneId pattern 위반 반려",
    raw: () => rawJson(sceneSpecs({ scenes: [baseScene(1, { sceneId: "s@01" })] }))
  },
  {
    id: "U3-05",
    name: "순환 transition",
    schema: "scene-specs",
    input: "transitions[0].from == transitions[0].to",
    expected: "self-loop transition 반려",
    raw: () => rawJson(sceneSpecs({ scenes: [baseScene(1)], transitions: [transition("s01", "s01")] }))
  },
  {
    id: "U3-06",
    name: "존재하지 않는 sceneId 전환",
    schema: "scene-specs",
    input: "transition.to points to absent s99",
    expected: "존재하지 않는 sceneId 참조 반려",
    raw: () => rawJson(sceneSpecs({ scenes: [baseScene(1)], transitions: [transition("s01", "s99")] }))
  },
  {
    id: "U3-07",
    name: "words end < start",
    schema: "audio-meta",
    input: "audio_meta.scenes[0].words[0].end < start",
    expected: "word timing 역전 반려",
    raw: () =>
      rawJson(
        audioMeta({
          scene: { words: [{ word: "bad", start: 1.2, end: 0.8 }] }
        })
      )
  },
  {
    id: "U3-08",
    name: "sourceHash 대소문자 변형",
    schema: "audio-meta",
    input: "audio_meta.scenes[0].sourceHash uppercase SHA-256",
    expected: "sourceHash lowercase hex pattern 위반 반려",
    raw: () => rawJson(audioMeta({ scene: { sourceHash: "A".repeat(64) } }))
  },
  {
    id: "U3-09",
    name: "음수 audioDurationSec",
    schema: "audio-meta",
    input: "audio_meta.scenes[0].audioDurationSec = -0.1",
    expected: "audioDurationSec minimum 위반 반려",
    raw: () => rawJson(audioMeta({ scene: { audioDurationSec: -0.1 } }))
  },
  {
    id: "U3-10",
    name: "0바이트 audio 파일+실존 검사",
    schema: "audio-meta",
    input: "audioPath points at existing 0-byte ./assets/audio/zero.mp3",
    expected: "0-byte asset 반려",
    raw: () => rawJson(audioMeta({ scene: { audioPath: "./assets/audio/zero.mp3", words: [] } })),
    gate: {
      id: "l0-6",
      setup: (dir) =>
        makeAudioGateFixture(
          dir,
          audioMeta({ scene: { audioPath: "./assets/audio/zero.mp3", words: [] } }),
          (root) => {
            const assetDir = path.join(root, "assets", "audio");
            ensureDir(assetDir);
            writeFileSync(path.join(assetDir, "zero.mp3"), "");
          }
        )
    }
  },
  {
    id: "U3-11",
    name: "JSON 깨진 파일을 vf write에 투입",
    schema: "scene-specs",
    input: "malformed JSON stdin",
    expected: "JSON parse error로 반려",
    raw: () => "{\"version\":\"1.0.0\",\"scenes\":["
  },
  {
    id: "U3-12",
    name: "심볼릭 링크 경로",
    schema: "audio-meta",
    input: "audioPath is ./assets/audio/link.mp3 symlink to repo file",
    expected: "symlink asset path 반려",
    raw: () => rawJson(audioMeta({ scene: { audioPath: "./assets/audio/link.mp3", words: [] } })),
    gate: {
      id: "l0-6",
      setup: (dir) =>
        makeAudioGateFixture(
          dir,
          audioMeta({ scene: { audioPath: "./assets/audio/link.mp3", words: [] } }),
          (root) => {
            const assetDir = path.join(root, "assets", "audio");
            ensureDir(assetDir);
            symlinkSync(path.join(repoRoot, "package.json"), path.join(assetDir, "link.mp3"));
          }
        )
    }
  },
  {
    id: "U3-13",
    name: "../ 경로 탈출 시도",
    schema: "audio-meta",
    input: "audioPath = ./assets/../outside.mp3",
    expected: "path traversal 반려",
    raw: () => rawJson(audioMeta({ scene: { audioPath: "./assets/../outside.mp3", words: [] } })),
    gate: {
      id: "l0-6",
      setup: (dir) =>
        makeAudioGateFixture(
          dir,
          audioMeta({ scene: { audioPath: "./assets/../outside.mp3", words: [] } }),
          (root) => {
            writeFileSync(path.join(root, "outside.mp3"), "not audio");
          }
        )
    }
  },
  {
    id: "U3-14",
    name: "null 주입",
    schema: "scene-specs",
    input: "scene_specs.scenes[0].headline = null",
    expected: "required string type 위반 반려",
    raw: () => rawJson(sceneSpecs({ scenes: [baseScene(1, { headline: null })] }))
  },
  {
    id: "U3-15",
    name: "거대 배열(씬 500개)",
    schema: "scene-specs",
    input: "scene_specs.scenes length = 500",
    expected: "비정상 대량 입력 반려",
    raw: () => rawJson(sceneSpecs({ scenes: Array.from({ length: 500 }, (_, index) => baseScene(index + 1)) }))
  },
  {
    id: "U3-16",
    name: "중복 sceneId",
    schema: "scene-specs",
    input: "two scenes share sceneId s01",
    expected: "duplicate sceneId 반려",
    raw: () =>
      rawJson(
        sceneSpecs({
          scenes: [baseScene(1), baseScene(2, { sceneId: "s01" })]
        })
      )
  },
  {
    id: "U3-17",
    name: "versions selected가 없는 gen 참조",
    schema: "versions",
    input: "resources.image.selected = gen_99 but entries only contain gen_01",
    expected: "selected gen missing from entries 반려",
    raw: () =>
      rawJson(
        versions({
          resources: {
            image: {
              selected: "gen_99"
            }
          }
        })
      ),
    gate: {
      id: "l0-12",
      setup: (dir) =>
        makeVersionsGateFixture(
          dir,
          versions({
            resources: {
              image: {
                selected: "gen_99"
              }
            }
          }),
          (root) => {
            const assetDir = path.join(root, "assets", "images");
            ensureDir(assetDir);
            writeFileSync(path.join(assetDir, "gen_01.txt"), "fixture");
          }
        )
    }
  },
  {
    id: "U3-18",
    name: "overrides 200% 좌표",
    schema: "scene-specs",
    input: "scene_specs.scenes[0].overrides.headline.x = 200",
    expected: "percent maximum 위반 반려",
    raw: () =>
      rawJson(
        sceneSpecs({
          scenes: [baseScene(1, { overrides: { headline: { x: 200 } } })]
        })
      )
  },
  {
    id: "U3-19",
    name: "미지 subtitleMode",
    schema: "scene-specs",
    input: "scene_specs.scenes[0].subtitleMode = mystery",
    expected: "subtitleMode enum 위반 반려",
    raw: () => rawJson(sceneSpecs({ scenes: [baseScene(1, { subtitleMode: "mystery" })] }))
  },
  {
    id: "U3-20",
    name: "BOM 붙은 JSON",
    schema: "scene-specs",
    input: "stdin starts with UTF-8 BOM",
    expected: "JSON parse error로 반려",
    raw: () => `\uFEFF${rawJson(sceneSpecs())}`
  }
];

function summarizeErrors(errors) {
  const messages = formatAjvErrors(errors);
  return messages.slice(0, 2).join("; ");
}

function runAjv(schema, raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    return {
      surface: "ajv",
      outcome: "reject",
      detail: `JSON parse failed: ${error.message}`
    };
  }

  const validation = validateJsonForSchema(repoRoot, data, schema);
  if (!validation.pass) {
    return {
      surface: "ajv",
      outcome: "reject",
      detail: summarizeErrors(validation.errors)
    };
  }

  return {
    surface: "ajv",
    outcome: "accept",
    detail: "schema validation passed"
  };
}

function commandResult(surface, result, acceptedDetail, rejectedDetail) {
  if (result.error?.code === "ETIMEDOUT") {
    return {
      surface,
      outcome: "timeout",
      detail: `timed out after ${commandTimeoutMs}ms`
    };
  }
  if (result.error || result.signal) {
    return {
      surface,
      outcome: "crash",
      detail: result.error?.message ?? `terminated by ${result.signal}`
    };
  }
  if (result.status === 0) {
    return {
      surface,
      outcome: "accept",
      detail: acceptedDetail(result)
    };
  }

  const detail = rejectedDetail(result);
  return {
    surface,
    outcome: detail ? "reject" : "crash",
    detail: detail || `non-zero exit ${result.status} without diagnostic output`
  };
}

function firstOutputLine(result) {
  const text = `${result.stderr ?? ""}${result.stdout ?? ""}`.trim();
  return text.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
}

function runVfWrite(testCase, raw) {
  const target = path.join("tmp", "u3-suite", "write", testCase.id, schemaTargets[testCase.schema]);
  rmSync(path.join(repoRoot, path.dirname(target)), { recursive: true, force: true });
  const result = spawnSync(process.execPath, ["bin/vf", "write", target, "--schema", testCase.schema], {
    cwd: repoRoot,
    input: raw,
    encoding: "utf8",
    timeout: commandTimeoutMs,
    maxBuffer: 64 * 1024 * 1024
  });

  return commandResult(
    "vf write",
    result,
    () => "exit 0 validation=passed",
    (child) => firstOutputLine(child)
  );
}

function withReportRestored(gateId, callback) {
  const reportPath = path.join(repoRoot, "reports", `${gateId}-report.json`);
  const hadReport = existsSync(reportPath);
  const original = hadReport ? readFileSync(reportPath) : null;
  try {
    return callback();
  } finally {
    if (hadReport) {
      writeFileSync(reportPath, original);
    } else {
      rmSync(reportPath, { force: true });
    }
  }
}

function summarizeGate(result) {
  let report = null;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    return firstOutputLine(result);
  }

  if (report.pass === true) return "exit 0 pass=true";
  const failed = Array.isArray(report.checks) ? report.checks.filter((check) => check.pass !== true) : [];
  if (failed.length === 0) return `pass=false exit=${result.status}`;
  return failed
    .slice(0, 2)
    .map((check) => {
      const violations = check.measured?.violations;
      const suffix = Array.isArray(violations) ? ` violations=${violations.length}` : "";
      return `${check.id}${suffix}`;
    })
    .join("; ");
}

function runGate(testCase) {
  if (!testCase.gate) return null;

  rmSync(gateRoot, { recursive: true, force: true });
  const caseDir = path.join(gateRoot, testCase.id);
  mkdirSync(caseDir, { recursive: true });
  testCase.gate.setup(caseDir);

  return withReportRestored(testCase.gate.id, () => {
    const result = spawnSync(process.execPath, ["bin/vf", "gate", testCase.gate.id, "--json"], {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: commandTimeoutMs,
      maxBuffer: 64 * 1024 * 1024
    });

    return commandResult(
      `vf gate ${testCase.gate.id}`,
      result,
      () => summarizeGate(result),
      () => summarizeGate(result)
    );
  });
}

function verdictFor(checks) {
  if (checks.some((check) => check.outcome === "timeout")) return "결함(무한대기)";
  if (checks.some((check) => check.outcome === "crash")) return "결함(크래시)";
  if (checks.some((check) => check.outcome === "reject")) return "반려 확인";
  if (checks.some((check) => check.outcome === "accept")) return "결함(조용한 수용)";
  return "반려 확인";
}

function compact(check) {
  if (!check) return "vf gate n/a";
  return `${check.surface}: ${check.outcome} (${check.detail})`;
}

function runCase(testCase) {
  const raw = testCase.raw();
  const ajv = runAjv(testCase.schema, raw);
  const write = runVfWrite(testCase, raw);
  const gate = runGate(testCase);
  const checks = [ajv, write, gate].filter(Boolean);
  const verdict = verdictFor(checks);
  return {
    ...testCase,
    checks,
    verdict,
    measured: [compact(ajv), compact(write), compact(gate)].join("; ")
  };
}

function printResults(results) {
  const rejected = results.filter((result) => result.verdict === "반려 확인").length;
  const defects = results.filter((result) => result.verdict !== "반려 확인");

  console.log(`u3-suite: completed ${results.length} cases`);
  console.log(`clear rejections: ${rejected}/${results.length}`);
  console.log(`vf defects: ${defects.length}`);

  for (const result of results) {
    const status = result.verdict === "반려 확인" ? "PASS" : "DEFECT";
    console.log(`[${status}] ${result.id} ${result.name} :: ${result.measured}`);
  }

  if (defects.length > 0) {
    console.log("defect list:");
    for (const result of defects) {
      const accepted = result.checks
        .filter((check) => check.outcome === "accept")
        .map((check) => check.surface)
        .join(", ");
      const crashed = result.checks
        .filter((check) => check.outcome === "crash" || check.outcome === "timeout")
        .map((check) => `${check.surface}:${check.outcome}`)
        .join(", ");
      const why = accepted ? `silent accept: ${accepted}` : crashed;
      console.log(`- ${result.id} ${result.name}: ${why}`);
    }
    process.exitCode = 1;
  }
}

rmSync(tmpRoot, { recursive: true, force: true });
rmSync(gateRoot, { recursive: true, force: true });
mkdirSync(tmpRoot, { recursive: true });

let results = [];
try {
  results = cases.map(runCase);
  printResults(results);
} finally {
  rmSync(gateRoot, { recursive: true, force: true });
  rmSync(tmpRoot, { recursive: true, force: true });
}

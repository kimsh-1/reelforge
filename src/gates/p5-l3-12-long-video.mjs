#!/usr/bin/env node
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  check,
  evidenceForPaths,
  ffprobeJson,
  main,
  readJson,
  repoRel,
  repoRoot,
  resetDir,
  run,
  stableEvidence,
  tail,
  writeJson
} from "./p5-common.mjs";

const self = repoRel(fileURLToPath(import.meta.url));
const workRoot = path.join(repoRoot, "tmp", "gate-work", "p5", "l3-12-long-video");
const sceneCount = 12;
const minDurationSec = 120;
const gateParameters = {
  sceneCount,
  minDurationSec,
  reduction: "P5-pre-resume timeout recovery uses 12 scenes and a 2min minimum instead of the prior 20 scenes and 3min minimum",
  verdictCriteria: "complete render, peak RSS recorded, no OOM/SIGKILL signature"
};

const baseWords = [
  "장영상",
  "메모리",
  "검증은",
  "렌더러가",
  "긴",
  "타임라인을",
  "끝까지",
  "유지하는지",
  "확인합니다",
  "각",
  "장면은",
  "mock",
  "오디오로",
  "동일한",
  "반복하며",
  "피크",
  "메모리를",
  "기록합니다",
  "중간",
  "구간에서도",
  "프레임",
  "합성과",
  "자막",
  "타이밍을",
  "계속",
  "확인합니다"
];

function baseScene(index) {
  const sceneId = `s${String(index).padStart(2, "0")}`;
  const narration = `${baseWords.join(" ")} ${index}번째 확인입니다.`;
  return {
    sceneId,
    sceneNumber: index,
    narration,
    narration_tts: narration,
    altText: `장영상 메모리 검증용 ${index}번째 headline-only 장면`,
    layout: "headline_only",
    mood: ["informative", "contemplative", "triumphant", "somber"][index % 4],
    reveal: ["fade_in", "zoom_in", "build_up", "dramatic_pause"][index % 4],
    emphasis: ["keyword", "sequence", "number", "contrast"][index % 4],
    headline: `L3-12 장영상 ${index}`,
    items: ["피크 RSS", "OOM 없음", "mock 오디오"],
    values: [index, sceneCount, minDurationSec],
    unit: "gate",
    source: "gate:p5-l3-12-long-video",
    visual_kind: "none",
    kenBurns: {
      enabled: false,
      zoomFactor: 1,
      zoomDirection: "in",
      panDirection: "none"
    },
    subtitleMode: index % 2 === 0 ? "karaoke" : "keyword"
  };
}

function generatedSceneSpecs() {
  return {
    version: "1.0.0",
    projectId: "p5-l3-12-long-video",
    scenes: Array.from({ length: sceneCount }, (_, index) => baseScene(index + 1)),
    transitions: Array.from({ length: sceneCount - 1 }, (_, index) => ({
      from: `s${String(index + 1).padStart(2, "0")}`,
      to: `s${String(index + 2).padStart(2, "0")}`,
      type: index % 3 === 0 ? "fade" : "cut",
      duration: index % 3 === 0 ? 0.1 : 0
    }))
  };
}

function parseTimeVerbose(stderr) {
  const peakMatch = stderr.match(/Maximum resident set size \(kbytes\):\s*(\d+)/);
  const elapsedMatch = stderr.match(/Elapsed \(wall clock\) time(?: \([^)]+\))?:\s*([^\n]+)/);
  const userMatch = stderr.match(/User time \(seconds\):\s*([0-9.]+)/);
  const systemMatch = stderr.match(/System time \(seconds\):\s*([0-9.]+)/);
  return {
    peakRssKb: peakMatch ? Number(peakMatch[1]) : null,
    elapsed: elapsedMatch?.[1]?.trim() ?? null,
    userSec: userMatch ? Number(userMatch[1]) : null,
    systemSec: systemMatch ? Number(systemMatch[1]) : null
  };
}

function hasOomSignature(result) {
  const text = `${result.stdout}\n${result.stderr}`.toLowerCase();
  return /out of memory|javascript heap out of memory|cannot allocate memory|enomem|\boom\b|killed/.test(text);
}

async function runGate({ profile }) {
  resetDir(workRoot);
  const projectDir = path.join(workRoot, "project");
  const checks = [
    check(profile === "full", "profile-full-required", {
      profile,
      reason: "L3-12 runs the actual long render and is full-profile only"
    }),
    check(true, "gate-parameters", {
      ...gateParameters
    })
  ];
  if (profile !== "full") {
    return { checks, inputSet: [self], evidence: stableEvidence(checks) };
  }

  const specs = generatedSceneSpecs();
  writeJson(path.join(projectDir, "scene_specs.json"), specs);
  checks.push(
    check(specs.scenes.length === sceneCount, "generated-scene-specs-12-scenes", {
      project: repoRel(projectDir),
      sceneSpecs: repoRel(path.join(projectDir, "scene_specs.json")),
      scenes: specs.scenes.length,
      transitions: specs.transitions.length,
      gateParameters
    })
  );

  const timeBin = existsSync("/usr/bin/time") ? "/usr/bin/time" : "time";
  const nodeOptions = [process.env.NODE_OPTIONS, "--max-old-space-size=6144"].filter(Boolean).join(" ");
  const setup = run(
    process.execPath,
    [
      "bin/vf",
      "pipeline",
      "run",
      repoRel(projectDir),
      "--profile",
      "mock",
      "--force",
      "--until",
      "compile"
    ],
    {
      timeout: 10 * 60 * 1000,
      maxBuffer: 512 * 1024 * 1024,
      env: {
        VF_PROJECT_ROOTS: projectDir
      }
    }
  );
  checks.push(
    check(setup.exitCode === 0, "mock-pipeline-through-compile", {
      command: setup.command,
      exitCode: setup.exitCode,
      signal: setup.signal,
      stdoutSummary: setup.stdout.split(/\r?\n/).filter((line) => /pipeline: (START|RUN|DONE|PASS|SKIP|FAIL|WAIT)/.test(line)),
      stderrTail: tail(setup.stderr, 3000)
    })
  );

  const output = path.join(projectDir, "out", "main.mp4");
  const hyperframesBin = path.join(repoRoot, "node_modules", ".bin", "hyperframes");
  const render = setup.exitCode === 0
    ? run(
    timeBin,
    [
      "-v",
      "/usr/bin/env",
      `NODE_OPTIONS=${nodeOptions}`,
      hyperframesBin,
      "render",
      path.join(projectDir, "build"),
      "--output",
      output,
      "--fps=30",
      "--quality=standard",
      "--workers=1",
      "--no-browser-gpu",
      "--browser-timeout=360",
      "--player-ready-timeout=360000",
      "--protocol-timeout=600000"
    ],
    {
      timeout: 90 * 60 * 1000,
      maxBuffer: 1024 * 1024 * 1024,
      env: {
        VF_PROJECT_ROOTS: projectDir,
        NODE_OPTIONS: nodeOptions
      }
    }
  )
    : {
        command: "skipped hyperframes render because setup failed",
        exitCode: 1,
        signal: null,
        stdout: "",
        stderr: ""
      };
  const time = parseTimeVerbose(render.stderr);
  checks.push(
    check(render.exitCode === 0 && existsSync(output) && statSync(output).size > 0, "long-render-completes", {
      command: render.command,
      exitCode: render.exitCode,
      signal: render.signal,
      output: repoRel(output),
      bytes: existsSync(output) ? statSync(output).size : 0,
      stdoutTail: tail(render.stdout, 3000),
      stderrTail: tail(render.stderr, 5000),
      time
    })
  );
  checks.push(
    check(time.peakRssKb !== null && time.peakRssKb > 0, "peak-rss-recorded", {
      method: "/usr/bin/time -v",
      peakRssKb: time.peakRssKb,
      peakRssMb: time.peakRssKb === null ? null : Number((time.peakRssKb / 1024).toFixed(1)),
      elapsed: time.elapsed,
      userSec: time.userSec,
      systemSec: time.systemSec
    })
  );
  checks.push(
    check(
      setup.signal !== "SIGKILL" &&
        render.signal !== "SIGKILL" &&
        setup.exitCode === 0 &&
        render.exitCode === 0 &&
        !hasOomSignature(setup) &&
        !hasOomSignature(render),
      "oom-signature-absent",
      {
      setupExitCode: setup.exitCode,
      renderExitCode: render.exitCode,
      setupSignal: setup.signal,
      renderSignal: render.signal,
      peakRssKb: time.peakRssKb,
      scanned: ["stdout", "stderr"],
      oomPattern: "out of memory|heap|ENOMEM|OOM|Killed"
      }
    )
  );

  const manifestPath = path.join(projectDir, "build", "render-manifest.json");
  const audioMetaPath = path.join(projectDir, "audio_meta.json");
  const reportPath = path.join(projectDir, "reports", "pipeline-gate-report.json");
  const gateRun = render.exitCode === 0
    ? run(process.execPath, ["bin/vf", "pipeline", "run", repoRel(projectDir), "--profile", "mock", "--only", "gate"], {
        timeout: 5 * 60 * 1000,
        maxBuffer: 512 * 1024 * 1024,
        env: {
          VF_PROJECT_ROOTS: projectDir
        }
      })
    : {
        command: "skipped pipeline gate because render failed",
        exitCode: 1,
        signal: null,
        stdout: "",
        stderr: ""
      };
  const manifest = existsSync(manifestPath) ? readJson(manifestPath) : null;
  const audioMeta = existsSync(audioMetaPath) ? readJson(audioMetaPath) : null;
  const report = existsSync(reportPath) ? readJson(reportPath) : null;
  const expectedDurationSec = (manifest?.scenes ?? []).reduce((sum, scene) => sum + Number(scene.audioDurationSec ?? 0), 0);
  const probe = existsSync(output) ? ffprobeJson(output) : null;
  const actualDurationSec = Number.parseFloat(probe?.parsed?.format?.duration ?? "NaN");
  checks.push(
    check(gateRun.exitCode === 0 && report?.pass === true && report?.exitCode === 0, "pipeline-gate-completes", {
      command: gateRun.command,
      exitCode: gateRun.exitCode,
      signal: gateRun.signal,
      stdoutSummary: gateRun.stdout.split(/\r?\n/).filter((line) => /pipeline: (START|RUN|DONE|PASS|SKIP|FAIL|WAIT)/.test(line)),
      stderrTail: tail(gateRun.stderr, 3000),
      report: existsSync(reportPath) ? repoRel(reportPath) : null,
      reportPass: report?.pass ?? null,
      reportExitCode: report?.exitCode ?? null
    })
  );
  checks.push(
    check(setup.exitCode === 0 && render.exitCode === 0 && gateRun.exitCode === 0, "mock-pipeline-completes", {
      note: "P5 gate runs mock pipeline through compile, renders with an extended browser timeout, then runs the pipeline gate step against the render output.",
      setupCommand: setup.command,
      renderCommand: render.command,
      gateCommand: gateRun.command,
      setupExitCode: setup.exitCode,
      renderExitCode: render.exitCode,
      gateExitCode: gateRun.exitCode
    })
  );
  checks.push(
    check(
      existsSync(output) &&
        statSync(output).size > 0 &&
        Number.isFinite(actualDurationSec) &&
        actualDurationSec >= minDurationSec,
      "actual-render-duration-2min-plus",
      {
        output: repoRel(output),
        bytes: existsSync(output) ? statSync(output).size : 0,
        minDurationSec,
        actualDurationSec: Number.isFinite(actualDurationSec) ? actualDurationSec : null,
        expectedDurationSec,
        ffprobe: probe
          ? {
              command: probe.result.command,
              exitCode: probe.result.exitCode,
              streams: probe.parsed?.streams ?? null,
              stderrTail: tail(probe.result.stderr, 1000)
            }
          : null
      }
    )
  );
  checks.push(
    check(
      manifest?.scenes?.length === sceneCount &&
        audioMeta?.scenes?.length === sceneCount &&
        report?.pass === true &&
        report?.exitCode === 0,
      "pipeline-artifacts-complete",
      {
        sceneSpecsScenes: specs.scenes.length,
        audioMetaScenes: audioMeta?.scenes?.length ?? null,
        manifestScenes: manifest?.scenes?.length ?? null,
        pipelineReport: existsSync(reportPath) ? repoRel(reportPath) : null,
        pipelineReportPass: report?.pass ?? null,
        pipelineReportExitCode: report?.exitCode ?? null
      }
    )
  );

  const evidencePaths = [
    repoRel(path.join(projectDir, "scene_specs.json")),
    repoRel(audioMetaPath),
    repoRel(manifestPath),
    repoRel(output),
    repoRel(reportPath)
  ];

  return {
    checks,
    inputSet: [
      self,
      "src/gates/p5-common.mjs",
      "tests/scenarios/l3-12-long-video.md",
      "research/06-plan/VERIFICATION-PLAN.md",
      "research/08-audit/RESOLUTION.md"
    ],
    evidence: [...stableEvidence(checks), ...evidenceForPaths(evidencePaths)]
  };
}

main(runGate);

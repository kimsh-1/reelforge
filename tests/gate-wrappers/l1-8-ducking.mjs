#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyDuckingToIndexHtml,
  applyDuckingToManifest,
  buildDuckingKeyframes,
  emitDuckingTimeline
} from "../../src/compiler/audio-duck.mjs";
import { emitKenBurnsTimeline } from "../../src/compiler/motion.mjs";
import {
  copyFixtureClean,
  ensureDir,
  evidenceForPaths,
  main,
  readJson,
  repoRel,
  repoRoot,
  resetDir,
  run,
  writeJson
} from "./helpers.mjs";

const self = repoRel(fileURLToPath(import.meta.url));
const workRoot = path.join(repoRoot, "tmp", "gate-work", "l1-8-ducking");

function sampleIndexHtml() {
  return `<!doctype html>
<html>
  <body>
    <div id="root" data-composition-id="main">
      <audio id="rf-bgm" src="assets/audio/bgm.wav" data-volume="0.35"></audio>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      (function () {
        const tl = gsap.timeline({ paused: true });
        window.__timelines["main"] = tl;
      })();
    </script>
  </body>
</html>
`;
}

function runFastChecks() {
  const keyframes = buildDuckingKeyframes({
    windows: [{ sceneId: "s01", startSec: 1, endSec: 2.6 }],
    totalDurationSec: 4
  });
  const timeline = emitDuckingTimeline({ keyframes });
  const patchedHtml = applyDuckingToIndexHtml({ html: sampleIndexHtml(), keyframes });
  const manifest = applyDuckingToManifest({
    manifest: {
      bgm: {
        path: "./assets/audio/bgm.wav",
        volume: 0.35,
        duckingKeyframes: []
      }
    },
    keyframes
  });
  const kenBurns = emitKenBurnsTimeline({
    sceneId: "s01",
    kenBurns: { enabled: true, zoomFactor: 1.18, zoomDirection: "in", panDirection: "right" },
    durationSec: 3.2
  });

  const sorted = keyframes.every((keyframe, index) => index === 0 || keyframes[index - 1].timeSec <= keyframe.timeSec);
  const hasSpeechDip = keyframes.some((keyframe) => keyframe.volume === 0.15);
  const restored = keyframes.at(-1)?.timeSec === 4 && keyframes.at(-1)?.volume === 0.35;

  return [
    {
      id: "ducking-keyframes-contract",
      pass: sorted && hasSpeechDip && restored,
      measured: { keyframes, sorted, hasSpeechDip, restored }
    },
    {
      id: "ducking-html-timeline-injection",
      pass: patchedHtml.includes('tl.to("#rf-bgm"') && patchedHtml.includes('data-volume="0.35"'),
      measured: {
        timelineLines: timeline,
        hasTimelineTween: patchedHtml.includes('tl.to("#rf-bgm"'),
        dataVolumePatched: patchedHtml.includes('data-volume="0.35"')
      }
    },
    {
      id: "ducking-manifest-contract",
      pass: JSON.stringify(manifest.bgm.duckingKeyframes) === JSON.stringify(keyframes),
      measured: manifest.bgm
    },
    {
      id: "kenburns-motion-contract",
      pass: kenBurns.length === 1 && kenBurns[0].includes("tl.fromTo"),
      measured: { lines: kenBurns }
    }
  ];
}

function runNoBgmNoWordsCompileCheck() {
  const projectDir = path.join(workRoot, "duck-edge-no-bgm-no-words");
  copyFixtureClean("minimal-3scene", projectDir);

  const audioPath = path.join(projectDir, "audio_meta.json");
  const audioMeta = readJson(audioPath);
  audioMeta.scenes = audioMeta.scenes.map((scene, index) => (index === 0 ? { ...scene, words: [] } : scene));
  writeJson(audioPath, audioMeta);

  const specsPath = path.join(projectDir, "scene_specs.json");
  const specs = readJson(specsPath);
  specs.scenes = specs.scenes.map((scene) => ({ ...scene, ost: null }));
  writeJson(specsPath, specs);

  const compile = run(process.execPath, ["bin/vf", "compile", repoRel(projectDir), "--json"]);
  let parsed = null;
  try {
    parsed = JSON.parse(compile.stdout);
  } catch {
    parsed = null;
  }

  const manifestPath = path.join(projectDir, "build", "render-manifest.json");
  const indexPath = path.join(projectDir, "build", "index.html");
  const manifest = parsed?.pass && readJson(manifestPath);
  const indexHtml = parsed?.pass ? readFileSync(indexPath, "utf8") : "";
  return {
    check: {
      id: "compile-edge:no-bgm-no-words",
      pass:
        compile.exitCode === 0 &&
        parsed?.pass === true &&
        manifest?.bgm === null &&
        !indexHtml.includes('id="rf-bgm"') &&
        !indexHtml.includes("#rf-bgm") &&
        parsed.warnings.length === 0,
      measured: {
        command: compile.command,
        exitCode: compile.exitCode,
        buildDir: parsed?.buildDir ?? null,
        bgm: manifest?.bgm ?? null,
        hasBgmAudio: indexHtml.includes('id="rf-bgm"'),
        hasBgmTween: indexHtml.includes("#rf-bgm"),
        warnings: parsed?.warnings ?? null,
        stderr: compile.stderr.trim()
      }
    },
    evidencePaths: parsed?.pass ? [repoRel(manifestPath), repoRel(indexPath)] : []
  };
}

function runFullExistingTest() {
  ensureDir(workRoot);
  const result = run(process.execPath, ["tests/motion-duck.mjs"]);
  const stdoutPath = path.join(workRoot, "motion-duck.stdout.txt");
  const stderrPath = path.join(workRoot, "motion-duck.stderr.txt");
  writeFileSync(stdoutPath, result.stdout);
  writeFileSync(stderrPath, result.stderr);
  return {
    check: {
      id: "existing-motion-duck-render-test",
      pass: result.exitCode === 0 && result.stdout.includes("motion-duck: PASS"),
      measured: {
        command: result.command,
        exitCode: result.exitCode,
        stdoutTail: result.stdout.slice(-4000),
        stderrTail: result.stderr.slice(-4000)
      }
    },
    evidencePaths: [repoRel(stdoutPath), repoRel(stderrPath)]
  };
}

async function runGate({ profile }) {
  resetDir(workRoot);
  const checks = runFastChecks();
  const evidencePaths = [];
  const noBgmNoWords = runNoBgmNoWordsCompileCheck();
  checks.push(noBgmNoWords.check);
  evidencePaths.push(...noBgmNoWords.evidencePaths);

  if (profile === "full") {
    const full = runFullExistingTest();
    checks.push(full.check);
    evidencePaths.push(...full.evidencePaths);
  } else {
    checks.push({
      id: "existing-motion-duck-render-test",
      pass: true,
      measured: { skipped: true, reason: "render/RMS ducking test runs only with --profile full" }
    });
  }

  return {
    checks,
    inputSet: [
      self,
      "tests/motion-duck.mjs",
      "src/compiler/compiler.mjs",
      "src/compiler/audio-duck.mjs",
      "src/compiler/motion.mjs",
      "fixtures/golden-specs/minimal-3scene/scene_specs.json",
      "fixtures/golden-specs/minimal-3scene/audio_meta.json",
      "fixtures/golden-specs/edit-scenario/scene_specs.json",
      "fixtures/golden-specs/edit-scenario/audio_meta.json"
    ],
    evidence: evidenceForPaths(evidencePaths)
  };
}

main(runGate);

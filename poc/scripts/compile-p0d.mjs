#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

const root = process.cwd();
const fixtureDir = path.join(root, "fixtures", "p0d");
const scenesDir = path.join(fixtureDir, "scenes");
const audioDir = path.join(fixtureDir, "audio");
const specsPath = path.join(fixtureDir, "scene_specs.json");
const audioMetaPath = path.join(fixtureDir, "audio_meta.json");
const manifestPath = path.join(fixtureDir, "render-manifest.json");
const indexPath = path.join(fixtureDir, "index.html");
const bgmPath = path.join(fixtureDir, "bgm.mp3");
const fps = 30;
const voice = "ko-KR-SunHiNeural";
const boundary = "WordBoundary";

function sha256Text(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function readJson(filePath, fallback) {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function htmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cssString(value) {
  return JSON.stringify(String(value));
}

function qFrameSeconds(frames) {
  return Number((frames / fps).toFixed(6));
}

function ceilFrames(seconds) {
  return Math.max(1, Math.ceil(seconds * fps - 1e-9));
}

function transitionFrames(seconds) {
  return Math.max(0, Math.round(seconds * fps));
}

function run(args, options = {}) {
  const result = spawnSync(args[0], args.slice(1), {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error(
      `${args.join(" ")} failed with ${result.status ?? result.signal}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`
    );
  }
  return result;
}

function probeDuration(filePath) {
  const result = run([
    "ffprobe",
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath
  ]);
  const duration = Number.parseFloat(result.stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`ffprobe returned invalid duration for ${filePath}: ${result.stdout}`);
  }
  return duration;
}

function ensureBgm() {
  if (existsSync(bgmPath) && statSync(bgmPath).size > 0) return false;
  run([
    "ffmpeg",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=220:duration=40",
    "-c:a",
    "libmp3lame",
    bgmPath
  ]);
  return true;
}

function synthesizeEdgeTts(text, audioPath, wordsPath) {
  const tmpAudio = `${audioPath}.tmp`;
  const tmpWords = `${wordsPath}.tmp`;
  const py = `
import asyncio
import json
import pathlib
import edge_tts

text = ${JSON.stringify(text)}
voice = ${JSON.stringify(voice)}
audio_path = pathlib.Path(${JSON.stringify(tmpAudio)})
words_path = pathlib.Path(${JSON.stringify(tmpWords)})

async def main():
    words = []
    communicate = edge_tts.Communicate(text, voice, boundary=${JSON.stringify(boundary)})
    with audio_path.open("wb") as audio:
        async for chunk in communicate.stream():
            ctype = chunk.get("type")
            if ctype == "audio":
                audio.write(chunk.get("data", b""))
            elif ctype == ${JSON.stringify(boundary)}:
                offset = float(chunk.get("offset", 0)) / 10000000.0
                duration = float(chunk.get("duration", 0)) / 10000000.0
                token = str(chunk.get("text", "")).strip()
                if token:
                    words.append({"word": token, "start": round(offset, 3), "end": round(offset + duration, 3)})
    words_path.write_text(json.dumps(words, ensure_ascii=False), encoding="utf-8")

asyncio.run(main())
`;
  run([path.join(root, ".venv-tts", "bin", "python"), "-c", py]);
  renameSync(tmpAudio, audioPath);
  renameSync(tmpWords, wordsPath);
}

function sceneTransitionMap(transitions) {
  const out = new Map();
  const incoming = new Map();
  for (const transition of transitions) {
    if (transition?.type !== "crossfade") continue;
    const dur = Number(transition.duration);
    if (!transition.from || !transition.to || !Number.isFinite(dur) || dur <= 0) continue;
    out.set(transition.from, transition);
    incoming.set(transition.to, transition);
  }
  return { out, incoming };
}

function sceneHtml(scene, meta) {
  const id = scene.sceneId;
  const title = htmlEscape(scene.headline);
  const subtitle = htmlEscape(scene.narration);
  const bg = scene.bgColor;
  const duration = meta.audioDurationSec;
  const firstWordStart = Math.max(0, Math.min(duration - 0.1, meta.words?.[0]?.start ?? 0));
  const audioSrc = `../${meta.audioPath}`;
  const styleBlock = `
      <style>
        #${id}-root {
          position: absolute;
          inset: 0;
          width: 1920px;
          height: 1080px;
          overflow: hidden;
          color: #fffdf7;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .${id}-stage {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          box-sizing: border-box;
          background:
            linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0) 42%),
            ${bg};
        }
        #${id}-panel {
          width: 1260px;
          min-height: 410px;
          display: grid;
          align-content: center;
          gap: 42px;
          padding: 78px 92px;
          box-sizing: border-box;
          border-left: 18px solid rgba(255,255,255,0.78);
          background: rgba(0,0,0,0.26);
        }
        #${id}-kicker {
          margin: 0;
          color: rgba(255,255,255,0.72);
          font-size: 34px;
          font-weight: 720;
          line-height: 1;
          letter-spacing: 0;
        }
        #${id}-headline {
          margin: 0;
          font-size: 124px;
          font-weight: 860;
          line-height: 1.05;
          letter-spacing: 0;
        }
        #${id}-subtitle {
          margin: 0;
          max-width: 1120px;
          color: rgba(255,255,255,0.88);
          font-size: 46px;
          font-weight: 620;
          line-height: 1.32;
          letter-spacing: 0;
        }
      </style>`;
  const rootBlock = `
      <div
        id="${id}-root"
        data-composition-id="${id}"
        data-width="1920"
        data-height="1080"
        data-start="0"
        data-duration="${duration}"
      >
        <section id="${id}-stage" class="${id}-stage" data-start="0" data-duration="${duration}" data-track-index="1">
          <div id="${id}-panel">
            <p id="${id}-kicker">P0d Scene ${htmlEscape(id.toUpperCase())}</p>
            <h1 id="${id}-headline">${title}</h1>
            <p id="${id}-subtitle">${subtitle}</p>
          </div>
        </section>
      </div>`;
  const scriptBlock = `
      <script>
        (function () {
          window.__timelines = window.__timelines || {};
          const tl = gsap.timeline({ paused: true });
          tl.fromTo(
            "#${id}-panel",
            { opacity: 0, y: 34, scale: 0.985 },
            { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: "power3.out" },
            0.12
          );
          tl.fromTo(
            "#${id}-subtitle",
            { opacity: 0, y: 18 },
            { opacity: 1, y: 0, duration: 0.34, ease: "power2.out" },
            ${firstWordStart.toFixed(3)}
          );
          tl.to({}, { duration: ${duration} }, 0);
          window.__timelines[${cssString(id)}] = tl;
        })();
      </script>`;

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>P0d ${htmlEscape(id)}</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
${styleBlock}
  </head>
  <body>
    <div
      id="${id}-root"
      data-composition-id="${id}"
      data-width="1920"
      data-height="1080"
      data-start="0"
      data-duration="${duration}"
      style="position: relative; width: 1920px; height: 1080px; overflow: hidden;"
    >
      <audio
        id="${id}-standalone-audio"
        src="${audioSrc}"
        data-start="0"
        data-duration="${duration}"
        data-track-index="10"
        data-volume="1"
      ></audio>
      <section id="${id}-stage" class="${id}-stage" data-start="0" data-duration="${duration}" data-track-index="1">
        <div id="${id}-panel">
          <p id="${id}-kicker">P0d Scene ${htmlEscape(id.toUpperCase())}</p>
          <h1 id="${id}-headline">${title}</h1>
          <p id="${id}-subtitle">${subtitle}</p>
        </div>
      </section>
    </div>
    <script>
      (function () {
        window.__timelines = window.__timelines || {};
        const tl = gsap.timeline({ paused: true });
        tl.fromTo(
          "#${id}-panel",
          { opacity: 0, y: 34, scale: 0.985 },
          { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: "power3.out" },
          0.12
        );
        tl.fromTo(
          "#${id}-subtitle",
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: 0.34, ease: "power2.out" },
          ${firstWordStart.toFixed(3)}
        );
        tl.to({}, { duration: ${duration} }, 0);
        window.__timelines[${cssString(id)}] = tl;
      })();
    </script>
    <template id="${id}-template">
${styleBlock}
${rootBlock}
      <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
${scriptBlock}
    </template>
  </body>
</html>
`;
}

function indexHtml(scenes, sceneMetas, starts, transitions, totalFrames) {
  const totalDuration = qFrameSeconds(totalFrames);
  const { incoming } = sceneTransitionMap(transitions);
  const transitionLines = [];
  const slotBlocks = [];
  const audioBlocks = [];
  scenes.forEach((scene, index) => {
    const meta = sceneMetas.get(scene.sceneId);
    const start = qFrameSeconds(starts.get(scene.sceneId));
    const track = 1 + (index % 2);
    const transition = incoming.get(scene.sceneId);
    const initialOpacity = transition ? "0" : "1";
    slotBlocks.push(`      <div
        id="el-${scene.sceneId}"
        data-composition-id="${scene.sceneId}"
        data-composition-src="scenes/${scene.sceneId}.html"
        data-start="${start}"
        data-duration="${meta.audioDurationSec}"
        data-track-index="${track}"
        data-width="1920"
        data-height="1080"
        style="opacity: ${initialOpacity};"
      ></div>`);
    audioBlocks.push(`      <audio
        id="audio-${scene.sceneId}"
        src="${meta.audioPath}"
        data-start="${start}"
        data-duration="${meta.audioDurationSec}"
        data-track-index="${10 + index}"
        data-volume="1"
      ></audio>`);
    if (transition) {
      const dur = Number(transition.duration);
      const tStart = start;
      transitionLines.push(`          tl.to("#el-${transition.from}", { opacity: 0, duration: ${dur}, ease: "none" }, ${tStart});`);
      transitionLines.push(`          tl.fromTo("#el-${transition.to}", { opacity: 0 }, { opacity: 1, duration: ${dur}, ease: "none" }, ${tStart});`);
    }
  });

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>P0d Edit Loop Fixture</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      html,
      body {
        margin: 0;
        width: 1920px;
        height: 1080px;
        overflow: hidden;
        background: #050608;
      }
      #root {
        position: relative;
        width: 1920px;
        height: 1080px;
        overflow: hidden;
        background: #050608;
      }
      #root > div[data-composition-src] {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-width="1920"
      data-height="1080"
      data-start="0"
      data-duration="${totalDuration}"
    >
${slotBlocks.join("\n")}
${audioBlocks.join("\n")}
      <audio
        id="bgm"
        src="bgm.mp3"
        data-start="0"
        data-duration="${totalDuration}"
        data-track-index="30"
        data-volume="0.15"
      ></audio>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      (function () {
        const tl = gsap.timeline({ paused: true });
${transitionLines.join("\n")}
        tl.to({}, { duration: ${totalDuration} }, 0);
        window.__timelines["main"] = tl;
      })();
    </script>
  </body>
</html>
`;
}

function compile() {
  if (!existsSync(specsPath)) throw new Error(`missing ${specsPath}`);
  mkdirSync(scenesDir, { recursive: true });
  mkdirSync(audioDir, { recursive: true });
  const specs = readJson(specsPath);
  const scenes = Array.isArray(specs.scenes) ? specs.scenes : [];
  const transitions = Array.isArray(specs.transitions) ? specs.transitions : [];
  if (scenes.length !== 3) throw new Error("P0d fixture expects exactly 3 scenes");
  ensureBgm();

  const previous = readJson(audioMetaPath, { scenes: [] });
  const previousByScene = new Map((previous.scenes ?? []).map((scene) => [scene.sceneId, scene]));
  const changedSceneIds = [];
  const reusedSceneIds = [];
  const sceneMetas = new Map();

  for (const scene of scenes) {
    const sourceHash = sha256Text(scene.narration);
    const audioPathRel = `audio/${scene.sceneId}.mp3`;
    const wordsPath = path.join(audioDir, `${scene.sceneId}.words.json`);
    const audioPath = path.join(fixtureDir, audioPathRel);
    const existing = previousByScene.get(scene.sceneId);
    const reusable = existing?.sourceHash === sourceHash && existsSync(audioPath) && statSync(audioPath).size > 0;

    let words;
    let rawAudioDurationSec;
    let generatedAt = existing?.generatedAt ?? null;
    if (reusable) {
      words = existing.words;
      rawAudioDurationSec = existing.rawAudioDurationSec ?? existing.audioDurationSec;
      reusedSceneIds.push(scene.sceneId);
    } else {
      synthesizeEdgeTts(scene.narration, audioPath, wordsPath);
      words = JSON.parse(readFileSync(wordsPath, "utf8"));
      rawAudioDurationSec = probeDuration(audioPath);
      generatedAt = new Date().toISOString();
      changedSceneIds.push(scene.sceneId);
    }

    const durationFrames = ceilFrames(rawAudioDurationSec);
    const audioDurationSec = qFrameSeconds(durationFrames);
    const meta = {
      sceneId: scene.sceneId,
      audioPath: audioPathRel,
      sourceHash,
      rawAudioDurationSec: Number(rawAudioDurationSec.toFixed(6)),
      audioDurationSec,
      durationFrames,
      words,
      generatedAt
    };
    sceneMetas.set(scene.sceneId, meta);
  }

  const { incoming } = sceneTransitionMap(transitions);
  const starts = new Map();
  let cursorFrames = 0;
  for (const scene of scenes) {
    const transition = incoming.get(scene.sceneId);
    if (transition) cursorFrames -= transitionFrames(Number(transition.duration));
    cursorFrames = Math.max(0, cursorFrames);
    starts.set(scene.sceneId, cursorFrames);
    cursorFrames += sceneMetas.get(scene.sceneId).durationFrames;
  }
  const totalFrames = cursorFrames;
  const totalDurationSec = qFrameSeconds(totalFrames);

  for (const scene of scenes) {
    writeFileSync(path.join(scenesDir, `${scene.sceneId}.html`), sceneHtml(scene, sceneMetas.get(scene.sceneId)));
  }
  writeFileSync(indexPath, indexHtml(scenes, sceneMetas, starts, transitions, totalFrames));

  const audioMeta = {
    tts: { provider: "edge-tts", voice, boundary },
    fps,
    scenes: scenes.map((scene) => sceneMetas.get(scene.sceneId)),
    lastCompile: {
      changedSceneIds,
      reusedSceneIds,
      totalDurationSec,
      totalFrames,
      compiledAt: new Date().toISOString()
    }
  };
  writeJson(audioMetaPath, audioMeta);

  const manifest = {
    meta: {
      resolution: { width: 1920, height: 1080 },
      fps,
      totalFrames,
      totalDurationSec,
      transitionOverlapFrames: transitions.reduce((sum, transition) => sum + transitionFrames(Number(transition.duration)), 0),
      transitionOverlapSec: qFrameSeconds(
        transitions.reduce((sum, transition) => sum + transitionFrames(Number(transition.duration)), 0)
      )
    },
    scenes: scenes.map((scene) => {
      const meta = sceneMetas.get(scene.sceneId);
      return {
        sceneId: scene.sceneId,
        compositionPath: `scenes/${scene.sceneId}.html`,
        audioPath: meta.audioPath,
        sourceHash: meta.sourceHash,
        startFrame: starts.get(scene.sceneId),
        startSec: qFrameSeconds(starts.get(scene.sceneId)),
        durationFrames: meta.durationFrames,
        audioDurationSec: meta.audioDurationSec,
        headline: scene.headline,
        subtitles: [
          {
            text: scene.narration,
            startSec: meta.words?.[0]?.start ?? 0,
            endSec: Math.min(meta.audioDurationSec, meta.words?.at(-1)?.end ?? meta.audioDurationSec),
            words: meta.words
          }
        ],
        vizAnimation: {
          itemSyncPoints: (meta.words ?? []).map((word) => ({ label: word.word, timeSec: word.start }))
        }
      };
    }),
    transitions: transitions.map((transition) => ({
      ...transition,
      durationFrames: transitionFrames(Number(transition.duration)),
      startFrame: starts.get(transition.to),
      startSec: qFrameSeconds(starts.get(transition.to))
    }))
  };
  writeJson(manifestPath, manifest);

  const payload = {
    pass: true,
    changedSceneIds,
    reusedSceneIds,
    totalDurationSec,
    totalFrames,
    manifestPath: path.relative(root, manifestPath).split(path.sep).join("/")
  };
  console.log(JSON.stringify(payload, null, 2));
}

try {
  compile();
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
}

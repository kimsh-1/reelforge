import { cssString, secondsFromFrames } from "./utils.mjs";

export const AUDIO_DUCK_VERSION = "P2-03.audio-duck.v1";
export const DEFAULT_BGM_VOLUME = 0.35;
export const DEFAULT_SPEECH_VOLUME = 0.15;
export const DEFAULT_ATTACK_SEC = 0.3;
export const DEFAULT_RELEASE_SEC = 0.3;

function roundTime(value) {
  return Number(Number(value).toFixed(6));
}

function roundVolume(value) {
  return Number(Number(value).toFixed(6));
}

function toSceneTiming(sceneTiming) {
  if (!sceneTiming) return null;
  if (Number.isFinite(sceneTiming.startSec)) {
    return {
      startSec: Number(sceneTiming.startSec),
      endSec: Number.isFinite(sceneTiming.durationSec)
        ? Number(sceneTiming.startSec) + Number(sceneTiming.durationSec)
        : Number.POSITIVE_INFINITY
    };
  }
  if (
    Number.isInteger(sceneTiming.startFrame) &&
    Number.isInteger(sceneTiming.durationFrames) &&
    Number.isFinite(sceneTiming.fps)
  ) {
    return {
      startSec: secondsFromFrames(sceneTiming.startFrame, sceneTiming.fps),
      endSec: secondsFromFrames(sceneTiming.startFrame + sceneTiming.durationFrames, sceneTiming.fps)
    };
  }
  return null;
}

function audioSceneMap(audioMetaOrScenes) {
  const scenes = Array.isArray(audioMetaOrScenes) ? audioMetaOrScenes : audioMetaOrScenes?.scenes ?? [];
  return new Map(scenes.map((scene) => [scene.sceneId, scene]));
}

function sceneTimingFor(sceneTimings, sceneId) {
  if (!sceneTimings) return null;
  if (sceneTimings instanceof Map) return sceneTimings.get(sceneId) ?? null;
  return sceneTimings[sceneId] ?? null;
}

export function narrationWindowsFromAudioMeta({ scenes, audioMeta, sceneTimings }) {
  const byScene = audioSceneMap(audioMeta);
  const windows = [];
  for (const scene of scenes ?? []) {
    const audio = byScene.get(scene.sceneId);
    const words = Array.isArray(audio?.words) ? audio.words : [];
    if (words.length === 0) continue;

    const starts = words.map((word) => Number(word.start)).filter(Number.isFinite);
    const ends = words.map((word) => Number(word.end)).filter(Number.isFinite);
    if (starts.length === 0 || ends.length === 0) continue;

    const timing = toSceneTiming(sceneTimingFor(sceneTimings, scene.sceneId)) ?? { startSec: 0, endSec: Number.POSITIVE_INFINITY };
    const startSec = Math.max(timing.startSec, timing.startSec + Math.min(...starts));
    const endSec = Math.min(timing.endSec, timing.startSec + Math.max(...ends));
    if (endSec > startSec) {
      windows.push({
        sceneId: scene.sceneId,
        startSec: roundTime(startSec),
        endSec: roundTime(endSec)
      });
    }
  }
  return windows.sort((a, b) => a.startSec - b.startSec || a.endSec - b.endSec);
}

export function mergeNarrationWindows(windows, { attackSec = DEFAULT_ATTACK_SEC, releaseSec = DEFAULT_RELEASE_SEC } = {}) {
  const sorted = [...(windows ?? [])]
    .filter((window) => Number.isFinite(window.startSec) && Number.isFinite(window.endSec) && window.endSec > window.startSec)
    .sort((a, b) => a.startSec - b.startSec || a.endSec - b.endSec);
  const merged = [];
  const mergeGap = Math.max(0, attackSec) + Math.max(0, releaseSec);

  for (const window of sorted) {
    const last = merged.at(-1);
    if (last && window.startSec <= last.endSec + mergeGap) {
      last.endSec = Math.max(last.endSec, window.endSec);
      last.sceneIds = [...new Set([...last.sceneIds, window.sceneId].filter(Boolean))];
      continue;
    }
    merged.push({
      sceneIds: window.sceneId ? [window.sceneId] : [],
      startSec: window.startSec,
      endSec: window.endSec
    });
  }

  return merged.map((window) => ({
    ...window,
    startSec: roundTime(window.startSec),
    endSec: roundTime(window.endSec)
  }));
}

function pushKeyframe(keyframes, keyframe) {
  const next = {
    timeSec: roundTime(Math.max(0, keyframe.timeSec)),
    volume: roundVolume(keyframe.volume)
  };
  const last = keyframes.at(-1);
  if (last && last.timeSec === next.timeSec) {
    last.volume = next.volume;
    return;
  }
  keyframes.push(next);
}

export function buildDuckingKeyframes({
  windows,
  totalDurationSec,
  bgmVolume = DEFAULT_BGM_VOLUME,
  speechVolume = DEFAULT_SPEECH_VOLUME,
  attackSec = DEFAULT_ATTACK_SEC,
  releaseSec = DEFAULT_RELEASE_SEC
}) {
  const total = roundTime(Math.max(0, Number(totalDurationSec) || 0));
  const keyframes = [];
  pushKeyframe(keyframes, { timeSec: 0, volume: bgmVolume });

  const merged = mergeNarrationWindows(windows, { attackSec, releaseSec });
  for (const window of merged) {
    const startSec = Math.min(total, Math.max(0, window.startSec));
    const endSec = Math.min(total, Math.max(startSec, window.endSec));
    if (endSec <= startSec) continue;

    pushKeyframe(keyframes, { timeSec: Math.max(0, startSec - attackSec), volume: bgmVolume });
    pushKeyframe(keyframes, { timeSec: startSec, volume: speechVolume });
    pushKeyframe(keyframes, { timeSec: endSec, volume: speechVolume });
    pushKeyframe(keyframes, { timeSec: Math.min(total, endSec + releaseSec), volume: bgmVolume });
  }

  pushKeyframe(keyframes, { timeSec: total, volume: bgmVolume });
  return keyframes;
}

export function buildDuckingFromAudioMeta({
  scenes,
  audioMeta,
  sceneTimings,
  totalDurationSec,
  bgmVolume = DEFAULT_BGM_VOLUME,
  speechVolume = DEFAULT_SPEECH_VOLUME,
  attackSec = DEFAULT_ATTACK_SEC,
  releaseSec = DEFAULT_RELEASE_SEC
}) {
  const windows = narrationWindowsFromAudioMeta({ scenes, audioMeta, sceneTimings });
  const keyframes = buildDuckingKeyframes({
    windows,
    totalDurationSec,
    bgmVolume,
    speechVolume,
    attackSec,
    releaseSec
  });
  return { windows, keyframes };
}

export function emitDuckingTimeline({ keyframes, targetId = "rf-bgm" }) {
  if (!Array.isArray(keyframes) || keyframes.length === 0) return [];
  const selector = cssString(`#${targetId}`);
  const lines = [`        tl.set(${selector}, { volume: ${keyframes[0].volume} }, 0);`];
  for (let index = 1; index < keyframes.length; index += 1) {
    const prev = keyframes[index - 1];
    const next = keyframes[index];
    const duration = roundTime(next.timeSec - prev.timeSec);
    if (duration < 0) throw new Error("ducking keyframes must be sorted by timeSec");
    if (duration === 0) continue;
    lines.push(
      `        tl.to(${selector}, { volume: ${next.volume}, duration: ${duration}, ease: "none" }, ${prev.timeSec});`
    );
  }
  return lines;
}

export function applyDuckingToIndexHtml({ html, keyframes, targetId = "rf-bgm" }) {
  const lines = emitDuckingTimeline({ keyframes, targetId });
  if (lines.length === 0) return html;

  const volume = keyframes[0].volume;
  const registrationNeedle = '        window.__timelines["main"] = tl;';
  if (!html.includes(registrationNeedle)) throw new Error("index HTML is missing main timeline registration");

  const audioPattern = new RegExp(`(<audio\\s+[\\s\\S]*?id="${targetId}"[\\s\\S]*?data-volume=")[^"]+("[\\s\\S]*?</audio>)`);
  if (!audioPattern.test(html)) throw new Error(`index HTML is missing #${targetId} audio data-volume`);
  const withVolume = html.replace(audioPattern, `$1${volume}$2`);

  return withVolume.replace(registrationNeedle, `${lines.join("\n")}\n${registrationNeedle}`);
}

export function applyDuckingToManifest({
  manifest,
  keyframes,
  bgmVolume = keyframes?.[0]?.volume ?? DEFAULT_BGM_VOLUME
}) {
  return {
    ...manifest,
    bgm: manifest.bgm
      ? {
          ...manifest.bgm,
          volume: bgmVolume,
          duckingKeyframes: keyframes
        }
      : null
  };
}

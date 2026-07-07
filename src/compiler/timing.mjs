import {
  framesFromDuration,
  framesFromTransition,
  quantizeEndSec,
  quantizeStartSec,
  secondsFromFrames
} from "./utils.mjs";

export const TRANSITION_SAFE_RATIO = 0.5;

function sceneDurationFrames({ scenes, audioByScene, fps }) {
  const durations = new Map();
  for (const scene of scenes) {
    const audio = audioByScene.get(scene.sceneId);
    if (!audio) throw new Error(`missing audio_meta scene for ${scene.sceneId}`);
    durations.set(scene.sceneId, framesFromDuration(audio.audioDurationSec, fps));
  }
  return durations;
}

function transitionLimitFrames(fromFrames, toFrames) {
  const adjacentMin = Math.min(fromFrames ?? 0, toFrames ?? 0);
  if (adjacentMin <= 0) return 0;
  return Math.max(1, Math.floor(adjacentMin * TRANSITION_SAFE_RATIO));
}

export function buildTiming({ scenes, audioByScene, transitions, fps }) {
  const outgoingTransitionFrames = new Map();
  const transitionFrames = new Map();
  const warnings = [];
  const durationFramesByScene = sceneDurationFrames({ scenes, audioByScene, fps });

  for (const transition of transitions) {
    const requestedFrames = framesFromTransition(transition.duration, fps);
    const limitFrames = transitionLimitFrames(
      durationFramesByScene.get(transition.from),
      durationFramesByScene.get(transition.to)
    );
    const frames = Math.min(requestedFrames, limitFrames);
    transitionFrames.set(`${transition.from}->${transition.to}`, frames);
    if (frames < requestedFrames) {
      warnings.push({
        code: "transition-duration-clamped",
        message: `transition ${transition.from}->${transition.to} was clamped from ${requestedFrames}f to ${frames}f`,
        transition,
        requestedFrames,
        durationFrames: frames,
        maxFrames: limitFrames,
        safeRatio: TRANSITION_SAFE_RATIO
      });
    }
    if (frames > 0) {
      outgoingTransitionFrames.set(
        transition.from,
        Math.max(outgoingTransitionFrames.get(transition.from) ?? 0, frames)
      );
    }
  }

  const sceneTimings = new Map();
  let cursorFrame = 0;
  let totalFrames = 0;

  for (const scene of scenes) {
    const audio = audioByScene.get(scene.sceneId);
    if (!audio) throw new Error(`missing audio_meta scene for ${scene.sceneId}`);

    const durationFrames = durationFramesByScene.get(scene.sceneId);
    const startFrame = cursorFrame;
    const outgoingFrames = outgoingTransitionFrames.get(scene.sceneId) ?? 0;
    const slotDurationFrames = durationFrames + outgoingFrames;
    const durationSec = secondsFromFrames(durationFrames, fps);
    const startSec = secondsFromFrames(startFrame, fps);

    const words = (audio.words ?? []).map((word) => ({
      word: word.word,
      start: quantizeStartSec(word.start, fps),
      end: quantizeEndSec(word.end, fps, durationFrames)
    }));

    sceneTimings.set(scene.sceneId, {
      sceneId: scene.sceneId,
      startFrame,
      startSec,
      durationFrames,
      durationSec,
      slotDurationFrames,
      slotDurationSec: secondsFromFrames(slotDurationFrames, fps),
      outgoingTransitionFrames: outgoingFrames,
      audioDurationSec: durationSec,
      words
    });

    cursorFrame += durationFrames;
    totalFrames = Math.max(totalFrames, startFrame + slotDurationFrames);
  }

  return {
    fps,
    totalFrames,
    totalDurationSec: secondsFromFrames(totalFrames, fps),
    sceneTimings,
    transitionFrames,
    warnings
  };
}

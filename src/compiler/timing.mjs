import {
  framesFromDuration,
  framesFromTransition,
  quantizeEndSec,
  quantizeStartSec,
  secondsFromFrames
} from "./utils.mjs";

export function buildTiming({ scenes, audioByScene, transitions, fps }) {
  const outgoingTransitionFrames = new Map();
  const transitionFrames = new Map();

  for (const transition of transitions) {
    const frames = framesFromTransition(transition.duration, fps);
    transitionFrames.set(`${transition.from}->${transition.to}`, frames);
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

    const durationFrames = framesFromDuration(audio.audioDurationSec, fps);
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
    transitionFrames
  };
}

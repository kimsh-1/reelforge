export function staticSubtitleForScene({ scene, timing }) {
  const words = timing.words ?? [];
  return {
    text: scene.narration,
    startSec: 0,
    endSec: timing.audioDurationSec,
    words
  };
}

export function subtitleHookData({ scene, timing }) {
  return {
    mode: scene.subtitleMode,
    renderer: "static-line",
    text: scene.narration,
    words: timing.words ?? [],
    startSec: 0,
    endSec: timing.audioDurationSec
  };
}

import { DEFAULT_HEIGHT, DEFAULT_WIDTH, cssString } from "./utils.mjs";

export const KEN_BURNS_VERSION = "P2-03.ken-burns.v1";

const DEFAULT_KEN_BURNS = {
  enabled: false,
  zoomFactor: 1,
  zoomDirection: "in",
  panDirection: "none"
};

function finiteNumber(value, fallback) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function roundTime(value) {
  return Number(Number(value).toFixed(6));
}

function roundPixel(value) {
  return Number(Number(value).toFixed(3));
}

export function normalizeKenBurns(kenBurns = {}) {
  const zoomFactor = Math.max(1, finiteNumber(kenBurns.zoomFactor, DEFAULT_KEN_BURNS.zoomFactor));
  return {
    enabled: Boolean(kenBurns.enabled),
    zoomFactor,
    zoomDirection: kenBurns.zoomDirection === "out" ? "out" : "in",
    panDirection: ["none", "left", "right", "up", "down"].includes(kenBurns.panDirection)
      ? kenBurns.panDirection
      : "none"
  };
}

export function kenBurnsTargetId({ sceneId, hasImage = false }) {
  return hasImage ? `${sceneId}-image` : `${sceneId}-bg`;
}

function panEndForDirection({ panDirection, zoomFactor, width, height }) {
  const maxX = (width * Math.max(0, zoomFactor - 1)) / 2;
  const maxY = (height * Math.max(0, zoomFactor - 1)) / 2;
  if (panDirection === "left") return { x: -maxX, y: 0 };
  if (panDirection === "right") return { x: maxX, y: 0 };
  if (panDirection === "up") return { x: 0, y: -maxY };
  if (panDirection === "down") return { x: 0, y: maxY };
  return { x: 0, y: 0 };
}

export function kenBurnsTransform({ kenBurns, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT }) {
  const config = normalizeKenBurns(kenBurns);
  if (!config.enabled) return null;

  const panEnd = panEndForDirection({
    panDirection: config.panDirection,
    zoomFactor: config.zoomFactor,
    width,
    height
  });
  const zoomIn = config.zoomDirection === "in";
  const zoomed = {
    scale: roundPixel(config.zoomFactor),
    x: roundPixel(panEnd.x),
    y: roundPixel(panEnd.y)
  };
  const neutral = { scale: 1, x: 0, y: 0 };
  const from = zoomIn ? neutral : zoomed;
  const to = zoomIn ? zoomed : neutral;

  return {
    from: {
      ...from,
      transformOrigin: "50% 50%"
    },
    to: {
      ...to,
      transformOrigin: "50% 50%"
    }
  };
}

export function emitKenBurnsTimeline({
  sceneId,
  kenBurns,
  durationSec,
  targetId = null,
  hasImage = false,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT
}) {
  const transform = kenBurnsTransform({ kenBurns, width, height });
  const duration = roundTime(durationSec);
  if (!transform || duration <= 0) return [];

  const resolvedTarget = targetId ?? kenBurnsTargetId({ sceneId, hasImage });
  return [
    `          tl.fromTo(${cssString(`#${resolvedTarget}`)}, ${JSON.stringify(transform.from)}, ${JSON.stringify({
      ...transform.to,
      duration,
      ease: "none"
    })}, 0);`
  ];
}

export function kenBurnsCss({ sceneId, targetId = null, hasImage = false }) {
  const resolvedTarget = targetId ?? kenBurnsTargetId({ sceneId, hasImage });
  return `        #${resolvedTarget} {
          transform-origin: 50% 50%;
          will-change: transform;
        }`;
}

export function applyKenBurnsToSceneHtml({
  html,
  scene,
  durationSec,
  hasImage = false,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT
}) {
  const lines = emitKenBurnsTimeline({
    sceneId: scene.sceneId,
    kenBurns: scene.kenBurns,
    durationSec,
    hasImage,
    width,
    height
  });
  if (lines.length === 0) return html;

  const css = kenBurnsCss({ sceneId: scene.sceneId, hasImage });
  const timelineNeedle = `          window.__timelines[${cssString(scene.sceneId)}] = tl;`;
  if (!html.includes("</style>")) throw new Error(`scene ${scene.sceneId} HTML is missing </style>`);
  if (!html.includes(timelineNeedle)) {
    throw new Error(`scene ${scene.sceneId} HTML is missing timeline registration`);
  }

  return html.replace("</style>", `${css}\n      </style>`).replace(timelineNeedle, `${lines.join("\n")}\n${timelineNeedle}`);
}

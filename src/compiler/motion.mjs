import { DEFAULT_HEIGHT, DEFAULT_WIDTH, cssString } from "./utils.mjs";

export const KEN_BURNS_VERSION = "P2-03.ken-burns.v1";
export const LIVING_BACKGROUND_VERSION = "W-C.living-background.v1";

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

function deterministicPair(seed, index) {
  let value = 0;
  const text = `${seed}:${index}`;
  for (let i = 0; i < text.length; i += 1) {
    value = (value * 31 + text.charCodeAt(i)) % 9973;
  }
  return {
    x: ((value % 41) - 20) * 2,
    y: (((value * 17) % 41) - 20) * 2
  };
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

export function livingBackgroundCss({ sceneId }) {
  const filterId = `${sceneId}-rf-grain`;
  return `        #${sceneId}-bg {
          isolation: isolate;
          transform-origin: 50% 50%;
          will-change: transform, opacity;
        }
        #${sceneId}-bg .rf-bg-filter {
          position: absolute;
          width: 0;
          height: 0;
          pointer-events: none;
        }
        #${sceneId}-bg .rf-bg-living {
          position: absolute;
          inset: -9%;
          z-index: 0;
          background:
            radial-gradient(ellipse 58% 42% at 18% 18%, color-mix(in srgb, var(--rf-accent, Highlight) 18%, transparent), transparent 68%),
            radial-gradient(ellipse 52% 44% at 82% 76%, color-mix(in srgb, var(--rf-text, CanvasText) 10%, transparent), transparent 70%),
            linear-gradient(135deg, color-mix(in srgb, var(--rf-panel, Canvas) 24%, transparent), transparent 56%);
          opacity: 0.62;
          transform: translate3d(0, 0, 0) scale(1.04);
          transform-origin: 50% 50%;
          pointer-events: none;
          will-change: transform, opacity;
        }
        #${sceneId}-bg .rf-bg-grain {
          position: absolute;
          inset: -50%;
          z-index: 2;
          width: 200%;
          height: 200%;
          filter: url(#${filterId});
          opacity: 0.055;
          mix-blend-mode: overlay;
          pointer-events: none;
          will-change: transform, opacity;
        }
        #${sceneId}-bg::after {
          z-index: 3;
          pointer-events: none;
        }`;
}

export function livingBackgroundMarkup({ sceneId }) {
  const filterId = `${sceneId}-rf-grain`;
  return `<svg class="rf-bg-filter" aria-hidden="true" focusable="false">
            <filter id="${filterId}">
              <feTurbulence type="fractalNoise" baseFrequency="0.78" numOctaves="2" stitchTiles="stitch" seed="7"></feTurbulence>
              <feColorMatrix type="saturate" values="0"></feColorMatrix>
            </filter>
          </svg>
          <span class="rf-bg-living" aria-hidden="true"></span>
          <span class="rf-bg-grain" aria-hidden="true"></span>`;
}

export function emitLivingBackgroundTimeline({ sceneId, durationSec }) {
  const duration = Math.max(0.1, roundTime(durationSec));
  const exitStart = Math.max(0.1, duration - 0.42);
  const livingDuration = Math.max(0.5, exitStart);
  const grainA = deterministicPair(sceneId, 1);
  const grainB = deterministicPair(sceneId, 2);
  return [
    `          tl.fromTo(${cssString(`#${sceneId}-bg .rf-bg-living`)}, { opacity: 0.32, x: -18, y: 10, scale: 1.035 }, { opacity: 0.66, x: 26, y: -18, scale: 1.075, rotation: 0.35, duration: ${livingDuration}, ease: "sine.inOut" }, 0);`,
    `          tl.fromTo(${cssString(`#${sceneId}-bg .rf-bg-grain`)}, { opacity: 0.035, x: ${grainA.x}, y: ${grainA.y} }, { opacity: 0.065, x: ${grainB.x}, y: ${grainB.y}, duration: ${duration}, ease: "steps(${Math.max(8, Math.round(duration * 10))})" }, 0);`
  ];
}

export function applyLivingBackgroundToSceneHtml({ html, scene, durationSec }) {
  if (html.includes(`data-rf-living-background="${LIVING_BACKGROUND_VERSION}"`)) return html;
  const sceneId = scene.sceneId;
  const bgClosePattern = new RegExp(`(<section\\b[^>]*\\bid=["']${sceneId}-bg["'][^>]*>)(\\s*)(</section>)`);
  const timelineNeedle = `          window.__timelines[${cssString(sceneId)}] = tl;`;
  if (!html.includes("</style>")) throw new Error(`scene ${sceneId} HTML is missing </style>`);
  if (!html.includes(timelineNeedle)) {
    throw new Error(`scene ${sceneId} HTML is missing timeline registration`);
  }
  if (!bgClosePattern.test(html)) {
    throw new Error(`scene ${sceneId} HTML is missing #${sceneId}-bg section`);
  }

  const marker = `<!-- data-rf-living-background="${LIVING_BACKGROUND_VERSION}" -->`;
  const css = livingBackgroundCss({ sceneId });
  const markup = livingBackgroundMarkup({ sceneId });
  const lines = emitLivingBackgroundTimeline({ sceneId, durationSec });
  return html
    .replace("</style>", `${css}\n      </style>`)
    .replace(bgClosePattern, `$1\n          ${marker}\n          ${markup}\n        $3`)
    .replace(timelineNeedle, `${lines.join("\n")}\n${timelineNeedle}`);
}

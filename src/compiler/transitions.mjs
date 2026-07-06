import { secondsFromFrames } from "./utils.mjs";

export const TRANSITION_HOOK_VERSION = "P2-01.transition-hook.v1";

const TRANSITION_ALIASES = new Map([
  ["cut", "cut"],
  ["fade", "crossfade"],
  ["crossfade", "crossfade"],
  ["slide", "slide_left"],
  ["slide_left", "slide_left"],
  ["slide_right", "slide_right"],
  ["wipe", "wipe"],
  ["wipe_left", "wipe_left"],
  ["wipe_right", "wipe_right"]
]);

export function transitionHookSignature() {
  return {
    version: TRANSITION_HOOK_VERSION,
    input: {
      transition: "{ from, to, type, duration }",
      fromSlotId: "DOM id for outgoing scene host in index.html",
      toSlotId: "DOM id for incoming scene host in index.html",
      startFrame: "incoming scene start frame; incoming start is never moved",
      durationFrames: "transition overlap frames",
      fps: "render fps"
    },
    output: {
      rootTimelineLines: "synchronous GSAP statements for index.html root timeline",
      warnings: "non-fatal compiler warnings"
    }
  };
}

export function resolveTransitionType(type) {
  return TRANSITION_ALIASES.get(type) ?? "crossfade";
}

function zOrderLines({ fromSlotId, toSlotId, startSec }) {
  return [
    `        tl.set("#${fromSlotId}", { zIndex: 999 }, ${startSec});`,
    `        tl.set("#${toSlotId}", { zIndex: 1000 }, ${startSec});`
  ];
}

function crossfadeLines({ fromSlotId, toSlotId, startSec, durationSec }) {
  return [
    ...zOrderLines({ fromSlotId, toSlotId, startSec }),
    `        tl.to("#${fromSlotId}", { opacity: 0, duration: ${durationSec}, ease: "none" }, ${startSec});`,
    `        tl.fromTo("#${toSlotId}", { opacity: 0 }, { opacity: 1, duration: ${durationSec}, ease: "none" }, ${startSec});`
  ];
}

function slideLines({ fromSlotId, toSlotId, startSec, endSec, durationSec, direction }) {
  const xPercent = direction === "right" ? -100 : 100;
  return [
    ...zOrderLines({ fromSlotId, toSlotId, startSec }),
    `        tl.set("#${toSlotId}", { opacity: 1 }, ${startSec});`,
    `        tl.fromTo("#${toSlotId}", { xPercent: ${xPercent} }, { xPercent: 0, duration: ${durationSec}, ease: "none" }, ${startSec});`,
    `        tl.set("#${toSlotId}", { clearProps: "transform" }, ${endSec});`
  ];
}

function wipeInsetForType(type) {
  if (type === "wipe_right") return "inset(0 100% 0 0)";
  return "inset(0 0 0 100%)";
}

function wipeLines({ fromSlotId, toSlotId, startSec, endSec, durationSec, type }) {
  return [
    ...zOrderLines({ fromSlotId, toSlotId, startSec }),
    `        tl.set("#${toSlotId}", { opacity: 1 }, ${startSec});`,
    `        tl.fromTo("#${toSlotId}", { clipPath: "${wipeInsetForType(type)}" }, { clipPath: "inset(0 0 0 0)", duration: ${durationSec}, ease: "none" }, ${startSec});`,
    `        tl.set("#${toSlotId}", { clearProps: "clipPath" }, ${endSec});`
  ];
}

export function emitTransition({ transition, fromSlotId, toSlotId, startFrame, durationFrames, fps }) {
  const resolvedType = resolveTransitionType(transition.type);
  const warnings = [];

  if (!TRANSITION_ALIASES.has(transition.type)) {
    warnings.push({
      code: "transition-fallback",
      message: `transition ${transition.type} is compiled as crossfade because it is not in the transition registry`,
      transition
    });
  }

  if (resolvedType === "cut" || durationFrames === 0) {
    return { resolvedType, lines: [], warnings };
  }

  const startSec = secondsFromFrames(startFrame, fps);
  const endSec = secondsFromFrames(startFrame + durationFrames, fps);
  const durationSec = secondsFromFrames(durationFrames, fps);

  let lines;
  if (resolvedType === "crossfade") {
    lines = crossfadeLines({ fromSlotId, toSlotId, startSec, durationSec });
  } else if (resolvedType === "slide_left" || resolvedType === "slide_right") {
    const direction = resolvedType === "slide_right" ? "right" : "left";
    lines = slideLines({ fromSlotId, toSlotId, startSec, endSec, durationSec, direction });
  } else {
    lines = wipeLines({ fromSlotId, toSlotId, startSec, endSec, durationSec, type: resolvedType });
  }

  return { resolvedType, lines, warnings };
}

export function resolvedTransitionsForManifest({ transitions, transitionFrames, sceneTimings, fps }) {
  return transitions.map((transition) => {
    const frames = transitionFrames.get(`${transition.from}->${transition.to}`) ?? 0;
    return {
      from: transition.from,
      to: transition.to,
      type: resolveTransitionType(transition.type),
      duration: secondsFromFrames(frames, fps)
    };
  });
}

import { secondsFromFrames } from "./utils.mjs";

export const TRANSITION_HOOK_VERSION = "R7a.transition-hook.v2";

const TRANSITION_ALIASES = new Map([
  ["cut", "cut"],
  ["flash-cut", "flash-cut"],
  ["flash_cut", "flash-cut"],
  ["fade", "crossfade"],
  ["crossfade", "crossfade"],
  ["push-wipe", "push-wipe-left"],
  ["push_wipe", "push-wipe-left"],
  ["push-wipe-left", "push-wipe-left"],
  ["push_wipe_left", "push-wipe-left"],
  ["push-wipe-right", "push-wipe-right"],
  ["push_wipe_right", "push-wipe-right"],
  ["zoom-punch", "zoom-punch"],
  ["zoom_punch", "zoom-punch"],
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
      startFrame: "transition starts at the incoming scene start frame; outgoing slots are extended to cover the overlap",
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

function outgoingCoverZOrderLines({ fromSlotId, toSlotId, startSec }) {
  return [
    `        tl.set("#${fromSlotId}", { zIndex: 1000 }, ${startSec});`,
    `        tl.set("#${toSlotId}", { zIndex: 999 }, ${startSec});`
  ];
}

function crossfadeLines({ fromSlotId, toSlotId, startSec, durationSec }) {
  return [
    ...zOrderLines({ fromSlotId, toSlotId, startSec }),
    ...outgoingContentFadeLines({ fromSlotId, startSec, durationSec }),
    `        tl.to("#${fromSlotId}", { opacity: 0, duration: ${durationSec}, ease: "none" }, ${startSec});`,
    `        tl.fromTo("#${toSlotId}", { opacity: 0 }, { opacity: 1, duration: ${durationSec}, ease: "none" }, ${startSec});`
  ];
}

function slideLines({ fromSlotId, toSlotId, startSec, endSec, durationSec, direction }) {
  const xPercent = direction === "right" ? 100 : -100;
  return [
    ...outgoingCoverZOrderLines({ fromSlotId, toSlotId, startSec }),
    `        tl.set("#${toSlotId}", { opacity: 1 }, ${startSec});`,
    ...outgoingContentFadeLines({ fromSlotId, startSec, durationSec }),
    `        tl.to("#${fromSlotId}", { xPercent: ${xPercent}, duration: ${durationSec}, ease: "none" }, ${startSec});`,
    `        tl.set("#${fromSlotId}", { opacity: 0, clearProps: "transform" }, ${endSec});`,
    `        tl.set("#${toSlotId}", { clearProps: "transform" }, ${endSec});`
  ];
}

function outgoingWipeInsetForType(type) {
  if (type === "wipe_right") return "inset(0 0 0 100%)";
  return "inset(0 100% 0 0)";
}

function wipeLines({ fromSlotId, toSlotId, startSec, endSec, durationSec, type }) {
  return [
    ...outgoingCoverZOrderLines({ fromSlotId, toSlotId, startSec }),
    `        tl.set("#${toSlotId}", { opacity: 1 }, ${startSec});`,
    ...outgoingContentFadeLines({ fromSlotId, startSec, durationSec }),
    `        tl.fromTo("#${fromSlotId}", { clipPath: "inset(0 0 0 0)" }, { clipPath: "${outgoingWipeInsetForType(type)}", duration: ${durationSec}, ease: "none" }, ${startSec});`,
    `        tl.set("#${fromSlotId}", { opacity: 0, clearProps: "clipPath" }, ${endSec});`,
    `        tl.set("#${toSlotId}", { clearProps: "clipPath" }, ${endSec});`
  ];
}

function flashCutLines({ fromSlotId, toSlotId, startSec, endSec, durationSec, durationFrames, fps }) {
  const flashSec = secondsFromFrames(Math.max(1, Math.min(6, durationFrames)), fps);
  const settleSec = Math.max(0.001, Number(Math.min(durationSec, flashSec).toFixed(6)));
  return [
    ...zOrderLines({ fromSlotId, toSlotId, startSec }),
    `        tl.set("#${toSlotId}", { opacity: 1, scale: 1.012, transformOrigin: "50% 50%" }, ${startSec});`,
    `        tl.set("#${fromSlotId}", { opacity: 0 }, ${startSec});`,
    `        tl.set("#rf-transition-flash", { opacity: 1, scale: 1.035 }, ${startSec});`,
    `        tl.to("#rf-transition-flash", { opacity: 0, scale: 1, duration: ${settleSec}, ease: "power3.out" }, ${startSec});`,
    `        tl.to("#${toSlotId}", { scale: 1, duration: ${settleSec}, ease: "power4.out" }, ${startSec});`,
    `        tl.set("#${fromSlotId}", { opacity: 0, clearProps: "transform" }, ${endSec});`,
    `        tl.set("#${toSlotId}", { clearProps: "transform" }, ${endSec});`
  ];
}

function pushWipeLines({ fromSlotId, toSlotId, startSec, endSec, durationSec, direction }) {
  const incomingX = direction === "right" ? -100 : 100;
  const outgoingX = direction === "right" ? 100 : -100;
  return [
    ...zOrderLines({ fromSlotId, toSlotId, startSec }),
    `        tl.set("#${fromSlotId}", { opacity: 1, xPercent: 0, scale: 1, transformOrigin: "50% 50%" }, ${startSec});`,
    `        tl.set("#${toSlotId}", { opacity: 1, xPercent: ${incomingX}, scale: 1.018, transformOrigin: "50% 50%" }, ${startSec});`,
    `        tl.to("#${fromSlotId}", { xPercent: ${outgoingX}, scale: 0.982, duration: ${durationSec}, ease: "power3.inOut" }, ${startSec});`,
    `        tl.to("#${toSlotId}", { xPercent: 0, scale: 1, duration: ${durationSec}, ease: "power4.out" }, ${startSec});`,
    `        tl.set("#${fromSlotId}", { opacity: 0, clearProps: "transform" }, ${endSec});`,
    `        tl.set("#${toSlotId}", { clearProps: "transform" }, ${endSec});`
  ];
}

function zoomPunchLines({ fromSlotId, toSlotId, startSec, endSec, durationSec }) {
  return [
    ...zOrderLines({ fromSlotId, toSlotId, startSec }),
    `        tl.set("#${toSlotId}", { opacity: 1, scale: 1.08, transformOrigin: "50% 50%" }, ${startSec});`,
    `        tl.set("#${fromSlotId}", { opacity: 1, scale: 1, transformOrigin: "50% 50%" }, ${startSec});`,
    ...outgoingContentFadeLines({ fromSlotId, startSec, durationSec }),
    `        tl.to("#${fromSlotId}", { opacity: 0, scale: 0.96, duration: ${durationSec}, ease: "power3.in" }, ${startSec});`,
    `        tl.to("#${toSlotId}", { scale: 1, duration: ${durationSec}, ease: "power4.out" }, ${startSec});`,
    `        tl.set("#${fromSlotId}", { opacity: 0, clearProps: "transform" }, ${endSec});`,
    `        tl.set("#${toSlotId}", { clearProps: "transform" }, ${endSec});`
  ];
}

function outgoingContentFadeLines({ fromSlotId, startSec, durationSec }) {
  const selector = `#${fromSlotId} .scene-content, #${fromSlotId} .block-format-frame, #${fromSlotId} .block-host, #${fromSlotId} .subtitles`;
  return [
    `        tl.to(${JSON.stringify(selector)}, { opacity: 0, duration: ${durationSec}, ease: "none" }, ${startSec});`
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
  } else if (resolvedType === "flash-cut") {
    lines = flashCutLines({ fromSlotId, toSlotId, startSec, endSec, durationSec, durationFrames, fps });
  } else if (resolvedType === "push-wipe-left" || resolvedType === "push-wipe-right") {
    const direction = resolvedType === "push-wipe-right" ? "right" : "left";
    lines = pushWipeLines({ fromSlotId, toSlotId, startSec, endSec, durationSec, direction });
  } else if (resolvedType === "zoom-punch") {
    lines = zoomPunchLines({ fromSlotId, toSlotId, startSec, endSec, durationSec });
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

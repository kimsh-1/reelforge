import { secondsFromFrames } from "./utils.mjs";

export const TRANSITION_HOOK_VERSION = "P2-00.transition-hook.v1";

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
  if (type === "cut") return "cut";
  if (type === "crossfade" || type === "fade") return "crossfade";
  return "crossfade";
}

export function emitTransition({ transition, fromSlotId, toSlotId, startFrame, durationFrames, fps }) {
  const resolvedType = resolveTransitionType(transition.type);
  const warnings = [];

  if (transition.type !== resolvedType && transition.type !== "fade") {
    warnings.push({
      code: "transition-fallback",
      message: `transition ${transition.type} is compiled as crossfade until P2-01 expands the registry`,
      transition
    });
  }

  if (resolvedType === "cut" || durationFrames === 0) {
    return { resolvedType: "cut", lines: [], warnings };
  }

  const startSec = secondsFromFrames(startFrame, fps);
  const durationSec = secondsFromFrames(durationFrames, fps);
  const lines = [
    `        tl.to("#${fromSlotId}", { opacity: 0, duration: ${durationSec}, ease: "none" }, ${startSec});`,
    `        tl.fromTo("#${toSlotId}", { opacity: 0 }, { opacity: 1, duration: ${durationSec}, ease: "none" }, ${startSec});`
  ];

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

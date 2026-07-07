import { runMockTtsStep } from "../core/mock.mjs";
import { runRealTtsStep } from "./real.mjs";

export { runRealTtsJob, runRealTtsStep } from "./real.mjs";

export function runTtsStep(ctx, options = {}) {
  if (ctx.profile === "mock") return runMockTtsStep(ctx);
  if (ctx.profile === "real") return runRealTtsStep(ctx, options);
  throw new Error(`unsupported TTS profile: ${ctx.profile}`);
}

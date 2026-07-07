#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runRealTtsJob } from "./real.mjs";

async function main() {
  const requestPath = process.argv[2];
  if (!requestPath) throw new Error("usage: node src/pipeline/tts/runner.mjs <request.json>");
  const request = JSON.parse(readFileSync(requestPath, "utf8"));
  const result = await runRealTtsJob(request.ctx, request.options ?? {});
  const resultPath = path.join(request.ctx.projectDir, ".pipeline", "tts", "last-result.json");
  writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  console.error(error?.stack ?? error?.message ?? String(error));
  process.exit(1);
});

#!/usr/bin/env node
import { printGateResult, runU3PipelineSuite } from "../../src/gates/p3-gates.mjs";

function optionValue(args, optionName) {
  const index = args.indexOf(optionName);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${optionName} requires a value`);
  return value;
}

const args = process.argv.slice(2);
await printGateResult(runU3PipelineSuite, {
  profile: optionValue(args, "--profile") ?? "fast",
  json: args.includes("--json")
});

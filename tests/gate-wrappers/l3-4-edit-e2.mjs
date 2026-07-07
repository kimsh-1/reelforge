#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { main, repoRel } from "./helpers.mjs";
import { studioE2eChecksFor, studioE2eInputSet } from "./p4-studio-helpers.mjs";

const self = repoRel(fileURLToPath(import.meta.url));

async function runGate() {
  const result = studioE2eChecksFor("l3-4-edit-e2");
  return {
    checks: result.checks,
    inputSet: [self, "tests/gate-wrappers/p4-studio-helpers.mjs", ...studioE2eInputSet],
    evidence: result.evidence
  };
}

main(runGate);

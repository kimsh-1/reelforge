#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requiredReportFields } from "../src/gates/registry.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = path.join(repoRoot, "tmp", "vf-selftest");
const validTarget = "tmp/vf-selftest/scene_specs.valid.json";
const invalidTarget = "tmp/vf-selftest/scene_specs.invalid.json";
const reportPath = path.join(repoRoot, "reports", "l0-1-report.json");

function runVf(args, input = "") {
  return spawnSync(process.execPath, ["bin/vf", ...args], {
    cwd: repoRoot,
    input,
    encoding: "utf8"
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validSceneSpecs() {
  return {
    version: "1.0.0",
    projectId: "vf-selftest",
    scenes: [
      {
        sceneId: "s01",
        sceneNumber: 1,
        narration: "Selftest narration.",
        narration_tts: "Selftest narration.",
        altText: "Selftest scene",
        layout: "headline_only",
        mood: "informative",
        reveal: "fade_in",
        emphasis: "keyword",
        headline: "Selftest",
        items: [],
        values: [],
        unit: "",
        source: "",
        visual_kind: "none",
        kenBurns: {
          enabled: false,
          zoomFactor: 1,
          zoomDirection: "in",
          panDirection: "none"
        },
        subtitleMode: "keyword"
      }
    ],
    transitions: []
  };
}

rmSync(tmpDir, { recursive: true, force: true });
mkdirSync(tmpDir, { recursive: true });

const writeValid = runVf(["write", validTarget, "--schema", "auto"], JSON.stringify(validSceneSpecs()));
assert(writeValid.status === 0, `valid write failed: ${writeValid.stderr}`);
assert(existsSync(path.join(repoRoot, validTarget)), "valid write did not create target");
const validWritePayload = JSON.parse(writeValid.stdout);
assert(validWritePayload.schema === "scene-specs", "auto schema did not resolve scene-specs");

const writeInvalid = runVf(["write", invalidTarget, "--schema", "auto"], JSON.stringify({ version: "1.0.0" }));
assert(writeInvalid.status !== 0, "invalid write unexpectedly passed");
assert(writeInvalid.stderr.includes("schema validation failed"), "invalid write did not print schema failure");
assert(writeInvalid.stderr.includes("- /"), "invalid write did not print violation list");
assert(!existsSync(path.join(repoRoot, invalidTarget)), "invalid write created target");

const gate = runVf(["gate", "l0-1", "--json"]);
assert(gate.status === 0, `gate l0-1 failed: ${gate.stderr}`);
const gateReport = JSON.parse(gate.stdout);
assert(gateReport.pass === true, "gate l0-1 report did not pass");
assert(existsSync(reportPath), "gate report file missing");
const persistedReport = JSON.parse(readFileSync(reportPath, "utf8"));
const presentFields = requiredReportFields.filter((field) =>
  Object.prototype.hasOwnProperty.call(persistedReport, field)
);
assert(presentFields.length === requiredReportFields.length, "gate report missing required fields");

rmSync(tmpDir, { recursive: true, force: true });

console.log("vf-selftest: PASS");
console.log("write valid: PASS schema=scene-specs");
console.log("write invalid: PASS rejected-with-violations");
console.log("write atomicity: PASS invalid-target-absent");
console.log("gate l0-1: PASS");
console.log(`report fields: PASS ${presentFields.length}/${requiredReportFields.length}`);
console.log("report file: reports/l0-1-report.json");
console.log("cleanup: PASS tmp/vf-selftest removed");

#!/usr/bin/env node
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vfBin = path.join(repoRoot, "bin", "vf");
const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "reelforge-path-guard-"));
const projectDir = path.join(tmpRoot, "project");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runVf(args, { cwd = repoRoot, input = "" } = {}) {
  return spawnSync(process.execPath, [vfBin, ...args], {
    cwd,
    input,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
}

try {
  cpSync(path.join(repoRoot, "fixtures", "golden-specs", "minimal-3scene"), projectDir, { recursive: true });
  rmSync(path.join(projectDir, "build"), { recursive: true, force: true });

  const compile = runVf(["compile", ".", "--json"], { cwd: projectDir });
  assert(compile.status === 0, `external project compile failed\nstdout:\n${compile.stdout}\nstderr:\n${compile.stderr}`);
  const compilePayload = JSON.parse(compile.stdout);
  assert(compilePayload.pass === true, "external project compile did not return pass=true");
  assert(existsSync(path.join(projectDir, "build", "render-manifest.json")), "external compile did not write build/render-manifest.json");

  const escapeTarget = path.join("..", "..", "etc", `reelforge-path-guard-${process.pid}.json`);
  const escapeAbs = path.resolve(projectDir, escapeTarget);
  rmSync(escapeAbs, { force: true });

  const writeEscape = runVf(
    ["write", escapeTarget, "--project-root", ".", "--schema", "scene-specs"],
    {
      cwd: projectDir,
      input: readFileSync(path.join(projectDir, "scene_specs.json"), "utf8")
    }
  );
  assert(writeEscape.status !== 0, "path escape write unexpectedly passed");
  assert(
    writeEscape.stderr.includes("target must stay inside the repository"),
    `path escape write did not print guard failure: ${writeEscape.stderr}`
  );
  assert(!existsSync(escapeAbs), "path escape write created the escaped target");

  console.log("path-guard: PASS");
  console.log(`external compile: PASS ${path.join(projectDir, "build")}`);
  console.log("escape write: PASS ../../etc rejected");
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}

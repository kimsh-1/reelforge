#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evidenceForPaths, listFilesRecursive, main, repoRel, repoRoot } from "./helpers.mjs";
import { tail } from "./p4-studio-helpers.mjs";

const self = repoRel(fileURLToPath(import.meta.url));
const demoDirs = ["demos/d1-usage", "demos/d2-engine", "demos/d3-intro"];

function runDemoVisualQc() {
  const command = [process.execPath, "tests/demo-visual-qc.mjs"];
  const result = spawnSync(command[0], command.slice(1), {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    timeout: 600000
  });
  const exitCode = result.status ?? (result.signal ? 128 : 1);
  return {
    command: command.join(" "),
    exitCode,
    signal: result.signal ?? null,
    error: result.error?.message ?? null,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

async function runGate({ profile }) {
  const checks = [];
  if (profile !== "full") {
    checks.push({
      id: "full-profile-required",
      pass: false,
      measured: { profile }
    });
    return {
      checks,
      inputSet: [self, "tests/demo-visual-qc.mjs"],
      evidence: []
    };
  }

  const run = runDemoVisualQc();
  checks.push({
    id: "demo-visual-qc-process",
    pass: run.exitCode === 0 && run.stdout.includes("demo visual qc: PASS"),
    measured: {
      command: run.command,
      exitCode: run.exitCode,
      signal: run.signal,
      error: run.error,
      stderrTail: tail(run.stderr)
    }
  });

  const missingDemos = demoDirs.filter((demo) => !run.stdout.includes(`PASS ${demo} `));
  checks.push({
    id: "demo-visual-qc-three-demo-targets",
    pass: missingDemos.length === 0,
    measured: {
      demos: demoDirs,
      missingDemos
    }
  });

  const snapshotDirs = demoDirs.map((demo) => path.join(demo, "build", "snapshots"));
  checks.push({
    id: "demo-visual-qc-snapshots-produced",
    pass: snapshotDirs.every((dir) => existsSync(path.join(repoRoot, dir))),
    measured: {
      snapshotDirs
    }
  });

  const snapshotFiles = snapshotDirs
    .map((dir) => path.join(repoRoot, dir))
    .filter((dir) => existsSync(dir))
    .flatMap((dir) => listFilesRecursive(dir).filter((file) => file.endsWith(".png")).map(repoRel));

  return {
    checks,
    inputSet: [
      self,
      "tests/demo-visual-qc.mjs",
      ...demoDirs.flatMap((demo) => [
        `${demo}/build/render-manifest.json`,
        `${demo}/build/index.html`
      ])
    ],
    evidence: evidenceForPaths(snapshotFiles)
  };
}

main(runGate);

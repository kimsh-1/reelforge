#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startStudioServer } from "../../src/studio/server/index.mjs";
import { evidenceForPaths, main, readJson, repoRel, repoRoot } from "./helpers.mjs";
import {
  makeTempProject,
  requestJson,
  studioServerInputSet,
  vfWriteJson,
  waitForJob
} from "./p4-studio-helpers.mjs";

const self = repoRel(fileURLToPath(import.meta.url));

async function runGate() {
  const workspace = makeTempProject("minimal-3scene", "reelforge-l3-11-");
  let studio = null;
  const checks = [];
  const evidencePaths = [];

  try {
    studio = await startStudioServer({
      repoRoot,
      projectDir: workspace.projectDir,
      port: 0,
      log: null
    });

    const project = await requestJson(studio.url, "GET", "/api/project");
    const initialHash = project.payload?.specsHash ?? null;
    checks.push({
      id: "project-loaded-with-specs-hash",
      pass: project.status === 200 && typeof initialHash === "string" && initialHash.length === 64,
      measured: { status: project.status, specsHash: initialHash }
    });

    const firstPatch = await requestJson(
      studio.url,
      "PATCH",
      "/api/scenes/s01",
      { fields: { headline: "P4 concurrent editor A" } },
      { "if-match": initialHash }
    );
    checks.push({
      id: "editor-a-patch-succeeds",
      pass: Boolean(firstPatch.status === 200 && firstPatch.payload?.class === "E1" && firstPatch.payload?.compileJob?.id),
      measured: {
        status: firstPatch.status,
        class: firstPatch.payload?.class,
        compileJob: firstPatch.payload?.compileJob?.id ?? null,
        specsHash: firstPatch.payload?.specsHash ?? null
      }
    });

    if (firstPatch.payload?.compileJob?.id) {
      const job = await waitForJob(studio.url, firstPatch.payload.compileJob.id);
      checks.push({
        id: "editor-a-compile-job-succeeded",
        pass: job.status === "succeeded",
        measured: {
          jobId: job.id,
          status: job.status,
          error: job.error ?? null
        }
      });
    }

    const stalePatch = await requestJson(
      studio.url,
      "PATCH",
      "/api/scenes/s02",
      { fields: { headline: "P4 stale editor B" } },
      { "if-match": initialHash }
    );
    const afterStaleSpecs = readJson(path.join(workspace.projectDir, "scene_specs.json"));
    checks.push({
      id: "stale-if-match-rejected-with-409",
      pass:
        stalePatch.status === 409 &&
        stalePatch.payload?.error?.details?.code === "SPEC_HASH_MISMATCH" &&
        afterStaleSpecs.scenes.find((scene) => scene.sceneId === "s02")?.headline !== "P4 stale editor B",
      measured: {
        status: stalePatch.status,
        details: stalePatch.payload?.error?.details ?? null,
        s02Headline: afterStaleSpecs.scenes.find((scene) => scene.sceneId === "s02")?.headline ?? null
      }
    });

    const versionsPath = path.join(workspace.projectDir, "versions.json");
    const versionsBeforeLock = readJson(versionsPath);
    const externalOwner = "p4-concurrent-external-editor";
    const lockWrite = vfWriteJson({
      projectDir: workspace.projectDir,
      filePath: versionsPath,
      schemaName: "versions",
      data: {
        ...versionsBeforeLock,
        editLock: {
          owner: externalOwner,
          acquiredAt: new Date().toISOString()
        }
      }
    });
    checks.push({
      id: "external-edit-lock-written",
      pass: lockWrite.exitCode === 0,
      measured: {
        command: lockWrite.command,
        exitCode: lockWrite.exitCode,
        stderr: lockWrite.stderr.trim()
      }
    });

    const currentProject = await requestJson(studio.url, "GET", "/api/project");
    const lockedPatch = await requestJson(
      studio.url,
      "PATCH",
      "/api/scenes/s03",
      { fields: { headline: "P4 lock conflict write" } },
      { "if-match": currentProject.payload?.specsHash ?? firstPatch.payload?.specsHash }
    );
    const versionsAfterLock = readJson(versionsPath);
    checks.push({
      id: "edit-lock-conflict-rejected-with-409",
      pass:
        lockedPatch.status === 409 &&
        lockedPatch.payload?.error?.details?.lock?.owner === externalOwner &&
        versionsAfterLock.editLock?.owner === externalOwner,
      measured: {
        status: lockedPatch.status,
        lock: lockedPatch.payload?.error?.details?.lock ?? null,
        persistedLock: versionsAfterLock.editLock ?? null
      }
    });

    const finalSpecs = readJson(path.join(workspace.projectDir, "scene_specs.json"));
    const evidencePath = path.join(repoRoot, "tmp", "gate-work", "l3-11-concurrent-edit", "evidence.json");
    evidencePaths.push(repoRel(evidencePath));
    mkdirSync(path.dirname(evidencePath), { recursive: true });
    writeFileSync(
      evidencePath,
      `${JSON.stringify(
        {
          initialHash,
          firstPatch: {
            status: firstPatch.status,
            class: firstPatch.payload?.class,
            specsHash: firstPatch.payload?.specsHash
          },
          stalePatch: {
            status: stalePatch.status,
            details: stalePatch.payload?.error?.details ?? null
          },
          lockedPatch: {
            status: lockedPatch.status,
            lock: lockedPatch.payload?.error?.details?.lock ?? null
          },
          finalHeadlines: finalSpecs.scenes.map((scene) => ({
            sceneId: scene.sceneId,
            headline: scene.headline
          }))
        },
        null,
        2
      )}\n`
    );

    if (existsSync(versionsPath)) {
      const snapshot = JSON.parse(readFileSync(versionsPath, "utf8"));
      checks.push({
        id: "versions-retain-conflict-lock",
        pass: snapshot.editLock?.owner === externalOwner,
        measured: { editLock: snapshot.editLock ?? null }
      });
    }
  } finally {
    studio?.close();
    workspace.cleanup();
  }

  return {
    checks,
    inputSet: [
      self,
      "tests/gate-wrappers/p4-studio-helpers.mjs",
      ...studioServerInputSet,
      "src/pipeline/versions-impl/lifecycle.mjs"
    ],
    evidence: evidenceForPaths(evidencePaths)
  };
}

main(runGate);

#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import http from "node:http";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startStudioServer, STUDIO_OWNER } from "../src/studio/server/index.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "reelforge-studio-server-"));
const projectDir = path.join(tmpRoot, "minimal-3scene");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function requestJson(baseUrl, method, pathname, body = null) {
  const response = await fetch(new URL(pathname, baseUrl), {
    method,
    headers: body === null ? {} : { "content-type": "application/json" },
    body: body === null ? null : JSON.stringify(body)
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return { response, payload };
}

async function waitForSseEvent(baseUrl, eventName, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(new URL("/api/events", baseUrl), {
      signal: controller.signal
    });
    assert.equal(response.status, 200);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) throw new Error(`SSE stream ended before ${eventName}`);
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const chunk of events) {
        const lines = chunk.split("\n");
        const event = lines.find((line) => line.startsWith("event: "))?.slice(7);
        const dataLine = lines.find((line) => line.startsWith("data: "));
        if (event !== eventName) continue;
        controller.abort();
        return dataLine ? JSON.parse(dataLine.slice(6)) : {};
      }
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForJob(baseUrl, jobId, timeoutMs = 120000) {
  const started = Date.now();
  for (;;) {
    const { response, payload } = await requestJson(baseUrl, "GET", `/api/jobs/${jobId}`);
    assert.equal(response.status, 200);
    if (["succeeded", "failed"].includes(payload.job.status)) return payload.job;
    if (Date.now() - started > timeoutMs) throw new Error(`job timed out: ${jobId}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function rawGetStatus(baseUrl, rawPath) {
  const url = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: url.hostname,
        port: url.port,
        method: "GET",
        path: rawPath
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function vfWriteVersions(versions) {
  const result = spawnSync(
    process.execPath,
    ["bin/vf", "write", path.join(projectDir, "versions.json"), "--project-root", projectDir, "--schema", "versions"],
    {
      cwd: repoRoot,
      input: JSON.stringify(versions),
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024
    }
  );
  assert.equal(result.status, 0, `vf write versions failed\n${result.stdout}\n${result.stderr}`);
}

let studio = null;

try {
  cpSync(path.join(repoRoot, "fixtures", "golden-specs", "minimal-3scene"), projectDir, { recursive: true });
  studio = await startStudioServer({
    repoRoot,
    projectDir,
    port: 0,
    log: null
  });
  const baseUrl = studio.url;

  const project = await requestJson(baseUrl, "GET", "/api/project");
  assert.equal(project.response.status, 200);
  assert.equal(project.payload.specs.scenes.length, 3);

  const compileEvent = waitForSseEvent(baseUrl, "compile.completed");
  const headlinePatch = await requestJson(baseUrl, "PATCH", "/api/scenes/s01", {
    fields: { headline: "오늘의 핵심 수정" }
  });
  assert.equal(headlinePatch.response.status, 200);
  assert.equal(headlinePatch.payload.class, "E1");
  assert.deepEqual(headlinePatch.payload.actions, ["compile:scene"]);
  const compilePayload = await compileEvent;
  assert.equal(compilePayload.status, "succeeded");

  const narrationPatch = await requestJson(baseUrl, "PATCH", "/api/scenes/s02", {
    fields: { narration_tts: "고객 반응은 안정적이고 전환율은 더 빠르게 개선되고 있습니다." }
  });
  assert.equal(narrationPatch.response.status, 200);
  assert.equal(narrationPatch.payload.class, "E2");
  assert.deepEqual(narrationPatch.payload.actions, ["pipeline:tts", "compile:full"]);

  const versions = readJson(path.join(projectDir, "versions.json"));
  vfWriteVersions({
    ...versions,
    editLock: {
      owner: `${STUDIO_OWNER}:external-conflict`,
      acquiredAt: new Date().toISOString()
    }
  });
  const conflict = await requestJson(baseUrl, "PATCH", "/api/scenes/s03", {
    fields: { headline: "충돌 테스트" }
  });
  assert.equal(conflict.response.status, 409);

  const escapeStatus = await rawGetStatus(baseUrl, "/build/%2e%2e/scene_specs.json");
  assert.equal(escapeStatus, 403);

  const renderStart = await requestJson(baseUrl, "POST", "/api/render-scene", { sceneId: "s01" });
  assert.equal(renderStart.response.status, 202);
  const renderJob = await waitForJob(baseUrl, renderStart.payload.job.id);
  assert.equal(renderJob.status, "succeeded", renderJob.error ?? "");
  const renderOutput = path.join(projectDir, renderJob.output);
  assert.ok(existsSync(renderOutput), "render output missing");
  assert.ok(statSync(renderOutput).size > 0, "render output is empty");

  console.log("studio-server: PASS");
  console.log("GET /api/project: 200");
  console.log("PATCH headline: E1 + compile.completed SSE");
  console.log("PATCH narration_tts: E2");
  console.log("editLock conflict: 409");
  console.log("path traversal: 403");
  console.log(`render-scene: ${renderJob.bytes} bytes`);
} finally {
  studio?.close();
  rmSync(tmpRoot, { recursive: true, force: true });
}

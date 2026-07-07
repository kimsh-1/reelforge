import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { evidenceForPaths, listFilesRecursive, normalizeRelPath, repoRel, repoRoot } from "./helpers.mjs";

export const studioServerInputSet = [
  "src/studio/server/index.mjs",
  "src/studio/server/events.mjs",
  "src/studio/server/impact.mjs",
  "src/studio/loop/index.mjs",
  "src/studio/loop/compile.mjs",
  "src/studio/loop/tts.mjs",
  "src/studio/panel/api.js",
  "src/studio/panel/app.js",
  "src/studio/panel/form.js",
  "src/studio/panel/preview.js",
  "src/studio/panel/schema-loader.js",
  "schemas/scene-specs.schema.json",
  "schemas/versions.schema.json",
  "fixtures/golden-specs/minimal-3scene/scene_specs.json",
  "fixtures/golden-specs/minimal-3scene/audio_meta.json"
];

export const studioE2eInputSet = [
  "tests/studio-e2e.test.mjs",
  ...studioServerInputSet
];

const studioE2eWorkRoot = path.join(repoRoot, "tmp", "gate-work", "studio-e2e-p4");
const studioE2eCachePath = path.join(studioE2eWorkRoot, "studio-e2e-result.json");
const studioE2eEvidenceDir = path.join(studioE2eWorkRoot, "evidence");
const studioE2eReportScreenshots = [
  "reports/studio-e2e/01-scenes.png",
  "reports/studio-e2e/02-headline-e1.png",
  "reports/studio-e2e/03-versions-render.png"
];

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function fileHashInput(relPath) {
  const absPath = path.join(repoRoot, relPath);
  if (!existsSync(absPath)) return [{ path: relPath, missing: true }];
  const stats = statSync(absPath);
  if (stats.isDirectory()) {
    return listFilesRecursive(absPath).map((filePath) => {
      const bytes = readFileSync(filePath);
      return {
        path: repoRel(filePath),
        bytes: bytes.length,
        sha256: sha256Bytes(bytes)
      };
    });
  }
  const bytes = readFileSync(absPath);
  return [{ path: relPath, bytes: bytes.length, sha256: sha256Bytes(bytes) }];
}

export function hashInputSet(inputSet) {
  const entries = inputSet.flatMap(fileHashInput).sort((a, b) => a.path.localeCompare(b.path));
  return sha256Bytes(Buffer.from(JSON.stringify(entries)));
}

export function tail(value, max = 4000) {
  const text = String(value ?? "");
  return text.length > max ? text.slice(text.length - max) : text;
}

function readJsonOrNull(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function preserveFiles(relPaths) {
  return relPaths.map((relPath) => {
    const absPath = path.join(repoRoot, relPath);
    return {
      relPath,
      existed: existsSync(absPath),
      bytes: existsSync(absPath) ? readFileSync(absPath) : null
    };
  });
}

function restoreFiles(entries) {
  for (const entry of entries) {
    const absPath = path.join(repoRoot, entry.relPath);
    if (entry.existed) {
      mkdirSync(path.dirname(absPath), { recursive: true });
      writeFileSync(absPath, entry.bytes);
    } else {
      rmSync(absPath, { force: true });
    }
  }
}

function copyStudioE2eScreenshots() {
  mkdirSync(studioE2eEvidenceDir, { recursive: true });
  const copied = [];
  for (const relPath of studioE2eReportScreenshots) {
    const source = path.join(repoRoot, relPath);
    if (!existsSync(source)) continue;
    const target = path.join(studioE2eEvidenceDir, path.basename(relPath));
    copyFileSync(source, target);
    copied.push(repoRel(target));
  }
  return copied;
}

function loadReusableStudioE2eResult(cacheKey) {
  const cached = readJsonOrNull(studioE2eCachePath);
  if (!cached || cached.cacheKey !== cacheKey || cached.pass !== true) return null;
  const evidenceReady = (cached.evidencePaths ?? []).every((relPath) => existsSync(path.join(repoRoot, relPath)));
  return evidenceReady ? cached : null;
}

export function runSharedStudioE2e() {
  mkdirSync(studioE2eWorkRoot, { recursive: true });
  const cacheKey = hashInputSet(studioE2eInputSet);
  const reusable = loadReusableStudioE2eResult(cacheKey);
  if (reusable) return { ...reusable, reused: true };

  rmSync(studioE2eEvidenceDir, { recursive: true, force: true });
  const preservedScreenshots = preserveFiles(studioE2eReportScreenshots);
  const command = [process.execPath, "tests/studio-e2e.test.mjs"];
  const startedAt = new Date().toISOString();
  const result = spawnSync(command[0], command.slice(1), {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    timeout: 600000,
    env: process.env
  });
  const exitCode = result.status ?? (result.signal ? 128 : 1);
  const evidencePaths = copyStudioE2eScreenshots();
  restoreFiles(preservedScreenshots);

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const markers = {
    passLine: stdout.includes("studio-e2e: PASS"),
    e1Line: stdout.includes("(b) headline save: E1 + compile.completed SSE + iframe reload"),
    e2Line: stdout.includes("(c) narration save: E2 + TTS button + audio_meta sourceHash changed"),
    staleLine: stdout.includes("(h) If-Match stale save: 409 + reload UI"),
    screenshotsLine: stdout.includes("(e) screenshots: reports/studio-e2e/01-scenes.png"),
    screenshotsCopied: evidencePaths.length === studioE2eReportScreenshots.length
  };
  const payload = {
    cacheKey,
    command: command.join(" "),
    startedAt,
    finishedAt: new Date().toISOString(),
    exitCode,
    signal: result.signal ?? null,
    error: result.error?.message ?? null,
    pass: exitCode === 0 && markers.passLine,
    markers,
    stdout,
    stderrTail: tail(stderr),
    evidencePaths
  };
  writeFileSync(studioE2eCachePath, `${JSON.stringify(payload, null, 2)}\n`);
  return { ...payload, reused: false };
}

export function studioE2eChecksFor(slice) {
  const result = runSharedStudioE2e();
  const processCheck = {
    id: "studio-e2e-shared-run",
    pass: result.pass === true,
    measured: {
      command: result.command,
      exitCode: result.exitCode,
      signal: result.signal,
      error: result.error,
      reused: result.reused,
      stderrTail: result.stderrTail
    }
  };

  const markerChecks = {
    "l3-3-edit-e1": [
      {
        id: "studio-e2e:e1-headline-save",
        pass: result.markers?.e1Line === true,
        measured: {
          expected: "(b) headline save: E1 + compile.completed SSE + iframe reload",
          present: result.markers?.e1Line === true
        }
      },
      {
        id: "studio-e2e:e1-screenshot-captured",
        pass: (result.evidencePaths ?? []).some((relPath) => relPath.endsWith("/02-headline-e1.png")),
        measured: {
          evidencePaths: result.evidencePaths ?? []
        }
      }
    ],
    "l3-4-edit-e2": [
      {
        id: "studio-e2e:e2-narration-tts",
        pass: result.markers?.e2Line === true,
        measured: {
          expected: "(c) narration save: E2 + TTS button + audio_meta sourceHash changed",
          present: result.markers?.e2Line === true
        }
      },
      {
        id: "studio-e2e:e2-final-render-evidence",
        pass: (result.evidencePaths ?? []).some((relPath) => relPath.endsWith("/03-versions-render.png")),
        measured: {
          evidencePaths: result.evidencePaths ?? []
        }
      }
    ]
  };

  return {
    checks: [processCheck, ...(markerChecks[slice] ?? [])],
    evidence: evidenceForPaths([repoRel(studioE2eCachePath), ...(result.evidencePaths ?? [])])
  };
}

export function makeTempProject(fixtureName, prefix = "reelforge-p4-") {
  const tmpRoot = mkdtempSync(path.join(os.tmpdir(), prefix));
  const projectDir = path.join(tmpRoot, fixtureName);
  cpSync(path.join(repoRoot, "fixtures", "golden-specs", fixtureName), projectDir, { recursive: true });
  return {
    tmpRoot,
    projectDir,
    cleanup: () => rmSync(tmpRoot, { recursive: true, force: true })
  };
}

export async function requestJson(baseUrl, method, pathname, body = null, headers = {}) {
  const response = await fetch(new URL(pathname, baseUrl), {
    method,
    headers: body === null ? headers : { ...headers, "content-type": "application/json" },
    body: body === null ? null : JSON.stringify(body)
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return { response, status: response.status, payload, text };
}

export async function waitForJob(baseUrl, jobId, timeoutMs = 120000) {
  const started = Date.now();
  for (;;) {
    const { response, payload } = await requestJson(baseUrl, "GET", `/api/jobs/${encodeURIComponent(jobId)}`);
    if (response.status !== 200) {
      throw new Error(`job status failed for ${jobId}: ${response.status}`);
    }
    if (["succeeded", "failed"].includes(payload.job.status)) return payload.job;
    if (Date.now() - started > timeoutMs) throw new Error(`job timed out: ${jobId}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

export function vfWriteJson({ projectDir, filePath, schemaName, data }) {
  const result = spawnSync(
    process.execPath,
    ["bin/vf", "write", filePath, "--project-root", projectDir, "--schema", schemaName],
    {
      cwd: repoRoot,
      input: JSON.stringify(data),
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024
    }
  );
  return {
    command: `node bin/vf write ${normalizeRelPath(path.relative(repoRoot, filePath))} --project-root ${projectDir} --schema ${schemaName}`,
    exitCode: result.status ?? (result.signal ? 128 : 1),
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    signal: result.signal ?? null,
    error: result.error?.message ?? null
  };
}

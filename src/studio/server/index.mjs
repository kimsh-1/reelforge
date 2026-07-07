import { spawn } from "node:child_process";
import http from "node:http";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  realpathSync,
  renameSync,
  statSync,
  watch
} from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { compileProject, DEFAULT_PRESET } from "../../compiler/compiler.mjs";
import {
  isPathInsideRoot,
  normalizeRelPath,
  readJsonFile
} from "../../compiler/utils.mjs";
import { writeJsonViaVf } from "../../pipeline/core/io.mjs";
import { runTtsStep } from "../../pipeline/tts/index.mjs";
import {
  EditLockConflictError,
  acquireEditLock,
  beforeSceneSpecsWrite,
  loadVersions
} from "../../pipeline/versions-impl/index.mjs";
import { StudioEventHub } from "./events.mjs";
import {
  assertAllowedSceneFields,
  changedSceneFields,
  classifyStudioImpact
} from "./impact.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 4317;
const DEFAULT_HOST = "127.0.0.1";
const MAX_JSON_BODY_BYTES = 1024 * 1024;
const STUDIO_OWNER = `studio-server:${process.pid}`;

class HttpError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js" || ext === ".mjs") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".woff2") return "font/woff2";
  return "application/octet-stream";
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function sendError(res, error) {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  sendJson(res, statusCode, {
    error: {
      message: error instanceof Error ? error.message : String(error),
      ...(error?.details ? { details: error.details } : {})
    }
  });
}

function redirect(res, location) {
  res.writeHead(302, { location });
  res.end();
}

function rawPathHasTraversal(rawUrl) {
  const rawPath = String(rawUrl ?? "").split("?")[0];
  let decoded = rawPath;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return true;
  }
  return /(?:^|[/\\])\.\.(?:[/\\]|$)/.test(decoded);
}

function safeUrlPathname(req) {
  if (rawPathHasTraversal(req.url)) throw new HttpError(403, "path traversal is not allowed");
  return new URL(req.url, "http://127.0.0.1").pathname;
}

function resolveStaticPath(rootDir, requestRelPath) {
  const cleanRel = requestRelPath.replace(/^\/+/, "");
  if (cleanRel.split(/[\\/]/).includes("..")) {
    throw new HttpError(403, "path traversal is not allowed");
  }
  const resolved = path.resolve(rootDir, cleanRel || "index.html");
  if (!isPathInsideRoot(resolved, rootDir)) {
    throw new HttpError(403, "path must stay inside the served root");
  }
  return resolved;
}

function serveFile(req, res, rootDir, requestRelPath, { spaFallback = false } = {}) {
  if (!["GET", "HEAD"].includes(req.method)) throw new HttpError(405, "method not allowed");
  let filePath = resolveStaticPath(rootDir, requestRelPath);
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }
  if (!existsSync(filePath) && spaFallback) {
    filePath = path.join(rootDir, "index.html");
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    throw new HttpError(404, "file not found");
  }
  res.writeHead(200, {
    "content-type": contentType(filePath),
    "cache-control": "no-store"
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
}

function readJsonIfExists(filePath) {
  if (!existsSync(filePath)) return null;
  return readJsonFile(filePath);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_JSON_BODY_BYTES) {
        reject(new HttpError(413, "request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readJsonBody(req) {
  const raw = await readRequestBody(req);
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new HttpError(400, `invalid JSON body: ${error.message}`);
  }
}

function assertPlainObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, `${label} must be an object`);
  }
}

function publicJob(job) {
  const { child, ...safe } = job;
  return safe;
}

function withProjectRootEnv(projectDir, callback) {
  const previous = process.env.VF_PROJECT_ROOTS;
  process.env.VF_PROJECT_ROOTS = [previous, projectDir].filter(Boolean).join(path.delimiter);
  try {
    return callback();
  } finally {
    if (previous === undefined) delete process.env.VF_PROJECT_ROOTS;
    else process.env.VF_PROJECT_ROOTS = previous;
  }
}

function findScene(specs, sceneId) {
  const index = (specs.scenes ?? []).findIndex((scene) => scene?.sceneId === sceneId);
  if (index < 0) throw new HttpError(404, `unknown sceneId: ${sceneId}`);
  return { scene: specs.scenes[index], index };
}

function scenePathFromManifest(projectDir, sceneId) {
  const manifestPath = path.join(projectDir, "build", "render-manifest.json");
  if (!existsSync(manifestPath)) throw new HttpError(409, "build/render-manifest.json is required before rendering a scene");
  const manifest = readJsonFile(manifestPath);
  const scene = (manifest.scenes ?? []).find((item) => item?.sceneId === sceneId);
  if (!scene?.path) throw new HttpError(404, `render manifest has no scene: ${sceneId}`);
  const buildDir = path.join(projectDir, "build");
  const scenePath = resolveStaticPath(buildDir, scene.path);
  if (!existsSync(scenePath) || !statSync(scenePath).isFile()) {
    throw new HttpError(404, `compiled scene file is missing: ${scene.path}`);
  }
  return normalizeRelPath(path.relative(buildDir, scenePath));
}

function versionsHasResources(projectDir) {
  return Object.keys(loadVersions(projectDir).resources ?? {}).length > 0;
}

function mapConflict(error) {
  if (error instanceof EditLockConflictError) {
    throw new HttpError(409, error.message, { lock: error.lock ?? null });
  }
  throw error;
}

export function createStudioServer({ repoRoot, projectDir, host = DEFAULT_HOST } = {}) {
  if (!repoRoot) throw new Error("createStudioServer requires repoRoot");
  if (!projectDir) throw new Error("createStudioServer requires projectDir");

  const absoluteRepoRoot = path.resolve(repoRoot);
  const absoluteProjectDir = realpathSync(path.resolve(projectDir));
  const buildDir = path.join(absoluteProjectDir, "build");
  const panelDir = path.join(moduleDir, "panel");
  const eventHub = new StudioEventHub();
  const jobs = new Map();
  const childJobs = new Set();
  let closed = false;
  let lastInternalSceneSpecsWriteAt = 0;

  function markInternalSceneSpecsWrite() {
    lastInternalSceneSpecsWriteAt = Date.now();
  }

  function suppressWatcherEvent() {
    return Date.now() - lastInternalSceneSpecsWriteAt < 1000;
  }

  function writeSceneSpecsFile(sceneSpecs, { allowStaleAudioMeta = false } = {}) {
    const write = () =>
      writeJsonViaVf({
        repoRoot: absoluteRepoRoot,
        projectDir: absoluteProjectDir,
        filePath: path.join(absoluteProjectDir, "scene_specs.json"),
        schemaName: "scene-specs",
        data: sceneSpecs
      });

    if (!allowStaleAudioMeta) return write();

    const audioMetaPaths = ["audio_meta.json", "audio-meta.json"]
      .map((fileName) => path.join(absoluteProjectDir, fileName))
      .filter((filePath) => existsSync(filePath));
    if (audioMetaPaths.length === 0) return write();
    const stashDir = path.join(absoluteProjectDir, ".studio");
    mkdirSync(stashDir, { recursive: true });
    const stashed = audioMetaPaths.map((filePath) => ({
      filePath,
      stashPath: path.join(stashDir, `${path.basename(filePath)}.${process.pid}.${Date.now()}.bak`)
    }));
    for (const item of stashed) renameSync(item.filePath, item.stashPath);
    try {
      return write();
    } finally {
      for (const item of stashed.reverse()) renameSync(item.stashPath, item.filePath);
    }
  }

  function saveSceneSpecsWithBackup(sceneSpecs, { note, allowStaleAudioMeta = false }) {
    try {
      if (versionsHasResources(absoluteProjectDir)) {
        acquireEditLock({
          repoRoot: absoluteRepoRoot,
          projectDir: absoluteProjectDir,
          owner: STUDIO_OWNER
        });
      }
      const backup = beforeSceneSpecsWrite({
        repoRoot: absoluteRepoRoot,
        projectDir: absoluteProjectDir,
        owner: STUDIO_OWNER,
        note
      });
      markInternalSceneSpecsWrite();
      const write = writeSceneSpecsFile(sceneSpecs, { allowStaleAudioMeta });
      markInternalSceneSpecsWrite();
      return { backup, write };
    } catch (error) {
      mapConflict(error);
    }
  }

  function createJob(type, payload = {}) {
    const id = `${type}-${randomUUID()}`;
    const now = new Date().toISOString();
    const job = {
      id,
      type,
      status: "queued",
      createdAt: now,
      updatedAt: now,
      ...payload
    };
    jobs.set(id, job);
    return job;
  }

  function updateJob(job, status, patch = {}) {
    Object.assign(job, patch, {
      status,
      updatedAt: new Date().toISOString()
    });
    if (job.type === "render") {
      eventHub.emitDebounced(`job:${job.id}:${status}`, "render.status", publicJob(job));
    }
    return job;
  }

  function startCompileJob({ scope = "full", sceneId = null, reason = "manual" } = {}) {
    const job = createJob("compile", { scope, sceneId, reason });
    setImmediate(() => {
      try {
        updateJob(job, "running");
        const result = withProjectRootEnv(absoluteProjectDir, () =>
          compileProject({
            repoRoot: absoluteRepoRoot,
            projectDir: absoluteProjectDir,
            presetPath: DEFAULT_PRESET
          })
        );
        updateJob(job, "succeeded", {
          result: {
            pass: result.pass,
            buildDir: result.buildDir,
            scenes: result.scenes,
            warnings: result.warnings
          }
        });
        eventHub.emitDebounced(`compile:${job.id}:completed`, "compile.completed", publicJob(job));
      } catch (error) {
        updateJob(job, "failed", {
          error: error instanceof Error ? error.message : String(error)
        });
        eventHub.emitDebounced(`compile:${job.id}:failed`, "compile.failed", publicJob(job));
      }
    });
    return job;
  }

  function startRenderSceneJob(sceneId) {
    const composition = scenePathFromManifest(absoluteProjectDir, sceneId);
    const job = createJob("render", { sceneId, composition });
    const outputDir = path.join(absoluteProjectDir, "out", "studio");
    mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `${sceneId}-${job.id}.mp4`);
    job.output = normalizeRelPath(path.relative(absoluteProjectDir, outputPath));

    setImmediate(() => {
      const hyperframesBin = path.join(absoluteRepoRoot, "node_modules", ".bin", "hyperframes");
      const args = [
        "render",
        buildDir,
        "--composition",
        composition,
        "--output",
        outputPath,
        "--fps=30",
        "--quality=draft",
        "--workers=1",
        "--no-browser-gpu",
        "--browser-timeout=120",
        "--player-ready-timeout=120000"
      ];
      updateJob(job, "running", { command: [hyperframesBin, ...args].join(" ") });
      const child = spawn(hyperframesBin, args, {
        cwd: absoluteRepoRoot,
        stdio: ["ignore", "pipe", "pipe"]
      });
      job.child = child;
      childJobs.add(child);
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout = `${stdout}${chunk}`.slice(-4000);
      });
      child.stderr.on("data", (chunk) => {
        stderr = `${stderr}${chunk}`.slice(-4000);
      });
      child.on("error", (error) => {
        childJobs.delete(child);
        updateJob(job, "failed", {
          error: error instanceof Error ? error.message : String(error),
          stdout,
          stderr
        });
      });
      child.on("close", (code, signal) => {
        childJobs.delete(child);
        const exitCode = code ?? (signal ? 128 : 1);
        const bytes = existsSync(outputPath) ? statSync(outputPath).size : 0;
        if (exitCode === 0 && bytes > 0) {
          updateJob(job, "succeeded", { exitCode, signal: signal ?? null, bytes, stdout, stderr });
          return;
        }
        updateJob(job, "failed", {
          exitCode,
          signal: signal ?? null,
          bytes,
          stdout,
          stderr,
          error: "hyperframes render failed or produced an empty output"
        });
      });
    });
    return job;
  }

  function projectPayload() {
    const specs = readJsonIfExists(path.join(absoluteProjectDir, "scene_specs.json"));
    const audioMeta = readJsonIfExists(path.join(absoluteProjectDir, "audio_meta.json"));
    const versions = loadVersions(absoluteProjectDir);
    const renderManifest = readJsonIfExists(path.join(buildDir, "render-manifest.json"));
    return {
      projectDir: absoluteProjectDir,
      specs,
      audio_meta: audioMeta,
      versions,
      status: {
        sceneCount: specs?.scenes?.length ?? 0,
        audioSceneCount: audioMeta?.scenes?.length ?? 0,
        buildReady: Boolean(renderManifest),
        buildSceneCount: renderManifest?.scenes?.length ?? 0,
        dirty: versions.dirty,
        editLock: versions.editLock,
        jobs: [...jobs.values()].map(publicJob)
      }
    };
  }

  async function patchScene(req, res, sceneId) {
    const body = await readJsonBody(req);
    assertPlainObject(body, "request body");
    assertPlainObject(body.fields, "fields");
    assertAllowedSceneFields(body.fields);

    const beforeSpecs = readJsonFile(path.join(absoluteProjectDir, "scene_specs.json"));
    const { scene, index } = findScene(beforeSpecs, sceneId);
    const afterSpecs = structuredClone(beforeSpecs);
    afterSpecs.scenes[index] = { ...scene, ...body.fields };
    const changedFields = changedSceneFields(scene, afterSpecs.scenes[index], Object.keys(body.fields));
    const impact = classifyStudioImpact({ beforeSpecs, afterSpecs, changedFields });
    const save = saveSceneSpecsWithBackup(afterSpecs, {
      note: `studio patch ${sceneId}`,
      allowStaleAudioMeta: impact.class === "E2"
    });
    let compileJob = null;
    if (impact.class === "E1" && impact.actions.includes("compile:scene")) {
      compileJob = startCompileJob({ scope: "scene", sceneId, reason: "patch-scene" });
    } else if (impact.class === "E3") {
      compileJob = startCompileJob({ scope: "full", reason: "patch-scene-structure" });
    }

    sendJson(res, 200, {
      class: impact.class,
      actions: impact.actions,
      reason: impact.reason,
      sceneId,
      changedFields,
      backup: save.backup,
      compileJob: compileJob ? publicJob(compileJob) : null
    });
  }

  async function patchTransitions(req, res) {
    const body = await readJsonBody(req);
    const transitions = Array.isArray(body) ? body : body.transitions;
    if (!Array.isArray(transitions)) throw new HttpError(400, "transitions must be an array");

    const beforeSpecs = readJsonFile(path.join(absoluteProjectDir, "scene_specs.json"));
    const afterSpecs = { ...structuredClone(beforeSpecs), transitions };
    const impact = classifyStudioImpact({
      beforeSpecs,
      afterSpecs,
      changedFields: [],
      transitionsChanged: JSON.stringify(beforeSpecs.transitions ?? []) !== JSON.stringify(transitions)
    });
    const save = saveSceneSpecsWithBackup(afterSpecs, {
      note: "studio patch transitions"
    });
    const compileJob = startCompileJob({ scope: "full", reason: "patch-transitions" });
    sendJson(res, 200, {
      class: impact.class,
      actions: impact.actions,
      reason: impact.reason,
      backup: save.backup,
      compileJob: publicJob(compileJob)
    });
  }

  async function compileEndpoint(req, res) {
    const body = await readJsonBody(req);
    const scope = body.scope ?? "full";
    if (!["scene", "full"].includes(scope)) throw new HttpError(400, "scope must be scene or full");
    const job = startCompileJob({ scope, sceneId: body.sceneId ?? null, reason: "api" });
    sendJson(res, 202, { job: publicJob(job), statusUrl: `/api/jobs/${job.id}` });
  }

  async function renderSceneEndpoint(req, res) {
    const body = await readJsonBody(req);
    if (typeof body.sceneId !== "string" || body.sceneId.length === 0) {
      throw new HttpError(400, "sceneId is required");
    }
    const job = startRenderSceneJob(body.sceneId);
    sendJson(res, 202, { job: publicJob(job), statusUrl: `/api/jobs/${job.id}` });
  }

  async function ttsEndpoint(req, res) {
    const body = await readJsonBody(req);
    const sceneIds = body.sceneIds ?? [];
    if (!Array.isArray(sceneIds) || sceneIds.some((sceneId) => typeof sceneId !== "string")) {
      throw new HttpError(400, "sceneIds must be an array of strings");
    }
    const result = runTtsStep(
      {
        repoRoot: absoluteRepoRoot,
        projectDir: absoluteProjectDir,
        profile: body.profile ?? "mock",
        force: true,
        command: "vf studio pipeline tts",
        state: { completedSteps: [], failedSteps: {}, stepHashes: {} }
      },
      { sceneIds }
    );
    eventHub.emitDebounced("tts:completed", "tts.completed", { sceneIds, result });
    const compileJob = startCompileJob({ scope: "full", reason: "pipeline-tts" });
    sendJson(res, 200, {
      sceneIds,
      result,
      actions: ["compile:full"],
      compileJob: publicJob(compileJob)
    });
  }

  async function route(req, res) {
    const pathname = safeUrlPathname(req);
    if (pathname === "/") {
      redirect(res, "/panel/");
      return;
    }
    if (pathname === "/api/events") {
      if (req.method !== "GET") throw new HttpError(405, "method not allowed");
      eventHub.connect(req, res);
      return;
    }
    if (pathname === "/api/project") {
      if (req.method !== "GET") throw new HttpError(405, "method not allowed");
      sendJson(res, 200, projectPayload());
      return;
    }
    if (pathname === "/api/specs") {
      if (req.method !== "GET") throw new HttpError(405, "method not allowed");
      sendJson(res, 200, readJsonFile(path.join(absoluteProjectDir, "scene_specs.json")));
      return;
    }
    const scenePatchMatch = /^\/api\/scenes\/([^/]+)$/.exec(pathname);
    if (scenePatchMatch) {
      if (req.method !== "PATCH") throw new HttpError(405, "method not allowed");
      await patchScene(req, res, decodeURIComponent(scenePatchMatch[1]));
      return;
    }
    if (pathname === "/api/transitions") {
      if (req.method !== "PATCH") throw new HttpError(405, "method not allowed");
      await patchTransitions(req, res);
      return;
    }
    if (pathname === "/api/compile") {
      if (req.method !== "POST") throw new HttpError(405, "method not allowed");
      await compileEndpoint(req, res);
      return;
    }
    if (pathname === "/api/render-scene") {
      if (req.method !== "POST") throw new HttpError(405, "method not allowed");
      await renderSceneEndpoint(req, res);
      return;
    }
    if (pathname === "/api/pipeline/tts") {
      if (req.method !== "POST") throw new HttpError(405, "method not allowed");
      await ttsEndpoint(req, res);
      return;
    }
    const jobMatch = /^\/api\/jobs\/([^/]+)$/.exec(pathname);
    if (jobMatch) {
      if (req.method !== "GET") throw new HttpError(405, "method not allowed");
      const job = jobs.get(decodeURIComponent(jobMatch[1]));
      if (!job) throw new HttpError(404, "unknown job");
      sendJson(res, 200, { job: publicJob(job) });
      return;
    }
    if (pathname === "/panel") {
      redirect(res, "/panel/");
      return;
    }
    if (pathname.startsWith("/panel/")) {
      serveFile(req, res, panelDir, pathname.slice("/panel/".length), { spaFallback: true });
      return;
    }
    if (pathname === "/build") {
      redirect(res, "/build/");
      return;
    }
    if (pathname.startsWith("/build/")) {
      serveFile(req, res, buildDir, pathname.slice("/build/".length));
      return;
    }
    throw new HttpError(404, "not found");
  }

  const server = http.createServer((req, res) => {
    route(req, res).catch((error) => {
      sendError(res, error);
    });
  });

  const specsPath = path.join(absoluteProjectDir, "scene_specs.json");
  let watcher = null;
  if (existsSync(specsPath)) {
    watcher = watch(specsPath, { persistent: false }, () => {
      if (suppressWatcherEvent()) return;
      eventHub.emitDebounced("file:scene_specs", "file.changed", {
        path: "scene_specs.json",
        projectDir: absoluteProjectDir
      });
    });
  }

  function close() {
    if (closed) return;
    closed = true;
    watcher?.close();
    eventHub.close();
    for (const child of childJobs) child.kill("SIGTERM");
    try {
      server.close();
    } catch (error) {
      if (error?.code !== "ERR_SERVER_NOT_RUNNING") throw error;
    }
  }

  return {
    server,
    host,
    projectDir: absoluteProjectDir,
    eventHub,
    jobs,
    close
  };
}

export function listenStudioServer(studio, { port = DEFAULT_PORT, host = DEFAULT_HOST } = {}) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      studio.server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      studio.server.off("error", onError);
      resolve(studio.server.address());
    };
    studio.server.once("error", onError);
    studio.server.once("listening", onListening);
    studio.server.listen(port, host);
  });
}

export async function startStudioServer({
  repoRoot,
  projectDir,
  port = DEFAULT_PORT,
  host = DEFAULT_HOST,
  log = null
} = {}) {
  let candidatePort = Number(port);
  if (!Number.isInteger(candidatePort) || candidatePort < 0 || candidatePort > 65535) {
    throw new Error("--port must be an integer from 0 to 65535");
  }
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const studio = createStudioServer({ repoRoot, projectDir, host });
    try {
      const address = await listenStudioServer(studio, { port: candidatePort, host });
      const resolvedPort = typeof address === "object" && address ? address.port : candidatePort;
      const url = `http://${host}:${resolvedPort}/panel/`;
      log?.(`studio: ${url}`);
      return { ...studio, address, url };
    } catch (error) {
      studio.close();
      if (error?.code !== "EADDRINUSE" || Number(port) === 0) throw error;
      candidatePort += 1;
    }
  }
  throw new Error(`no available studio port found starting at ${port}`);
}

export { DEFAULT_HOST, DEFAULT_PORT, STUDIO_OWNER };

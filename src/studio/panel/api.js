import { createMockApi } from "./mock-api.js";

const EVENT_NAMES = ["compile.completed", "compile.failed", "render.status", "tts.completed", "file.changed"];

function mockEnabled(windowRef) {
  if (!windowRef) return false;
  if (windowRef.__RF_MOCK === true || windowRef.__RF_MOCK === 1 || windowRef.__RF_MOCK === "1") return true;
  return windowRef.location?.protocol === "file:";
}

async function readJsonResponse(response) {
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    const message = payload?.error?.message ?? `request failed: ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function requestJson(fetchImpl, pathname, { method = "GET", body = null } = {}) {
  const response = await fetchImpl(pathname, {
    method,
    headers: body === null ? {} : { "content-type": "application/json" },
    body: body === null ? null : JSON.stringify(body)
  });
  return readJsonResponse(response);
}

function createRestApi({ fetchImpl = globalThis.fetch, EventSourceCtor = globalThis.EventSource } = {}) {
  return {
    isMock: false,
    getProject: () => requestJson(fetchImpl, "/api/project"),
    getSpecs: () => requestJson(fetchImpl, "/api/specs"),
    patchScene: (sceneId, fields) =>
      requestJson(fetchImpl, `/api/scenes/${encodeURIComponent(sceneId)}`, {
        method: "PATCH",
        body: { fields }
      }),
    patchTransitions: (transitions) =>
      requestJson(fetchImpl, "/api/transitions", {
        method: "PATCH",
        body: { transitions }
      }),
    compile: ({ scope = "full", sceneId = null } = {}) =>
      requestJson(fetchImpl, "/api/compile", {
        method: "POST",
        body: { scope, sceneId }
      }),
    renderScene: (sceneId) =>
      requestJson(fetchImpl, "/api/render-scene", {
        method: "POST",
        body: { sceneId }
      }),
    getJob: (jobId) => requestJson(fetchImpl, `/api/jobs/${encodeURIComponent(jobId)}`),
    runTts: (sceneIds) =>
      requestJson(fetchImpl, "/api/pipeline/tts", {
        method: "POST",
        body: { sceneIds, profile: "mock" }
      }),
    selectVersion: (resourceType, gen) =>
      requestJson(fetchImpl, `/api/versions/${encodeURIComponent(resourceType)}`, {
        method: "PATCH",
        body: { selected: gen }
      }),
    artifactUrl: (relPath) => `/artifacts/${String(relPath ?? "").replace(/^\/+/, "")}`,
    subscribeEvents: (callback) => {
      if (typeof EventSourceCtor !== "function") return { close: () => {} };
      const source = new EventSourceCtor("/api/events");
      for (const event of EVENT_NAMES) {
        source.addEventListener(event, (message) => {
          let data = {};
          try {
            data = message.data ? JSON.parse(message.data) : {};
          } catch {
            data = { raw: message.data };
          }
          callback({ event, data });
        });
      }
      source.onerror = () => callback({ event: "connection.error", data: {} });
      return { close: () => source.close() };
    }
  };
}

export function createApi(options = {}) {
  const windowRef = options.windowRef ?? globalThis.window;
  if (options.mock ?? mockEnabled(windowRef)) return createMockApi(options);
  return createRestApi(options);
}

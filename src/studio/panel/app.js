import { createApi } from "./api.js";
import { actionLabel, impactDetails, renderSceneForm } from "./form.js";
import { loadSceneSpecsSchema } from "./schema-loader.js";
import { createPreviewController } from "./preview.js";

const PREVIEW_RELOAD_EVENTS = new Set(["compile.completed", "file.changed"]);
const TERMINAL_JOB_STATUSES = new Set(["succeeded", "failed"]);
const DEFAULT_SCENE_PREVIEW_PROGRESS = 0.4;

function createElement(documentRef, tagName, attrs = {}, children = []) {
  const node = documentRef.createElement(tagName);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (key === "className") node.className = value;
    else if (key === "textContent") node.textContent = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key === "style") node.setAttribute("style", value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child === null || child === undefined) continue;
    node.append(child);
  }
  return node;
}

function currentScene(state) {
  return state.specs?.scenes?.find((scene) => scene.sceneId === state.selectedSceneId) ?? state.specs?.scenes?.[0] ?? null;
}

function manifestScene(state, sceneId) {
  return (state.project?.renderManifest?.scenes ?? []).find((scene) => scene?.sceneId === sceneId) ?? null;
}

function sceneDurationSec(state, sceneId) {
  const manifest = manifestScene(state, sceneId);
  const direct = Number(manifest?.audioDurationSec ?? manifest?.durationSec);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const frames = Number(manifest?.durationFrames);
  const fps = Number(state.project?.renderManifest?.meta?.fps);
  if (Number.isFinite(frames) && frames > 0 && Number.isFinite(fps) && fps > 0) return frames / fps;
  return null;
}

function buildScenePreviewUrl(state, sceneId) {
  const scene = manifestScene(state, sceneId);
  const relPath = String(scene?.path ?? "").replace(/^\/+/, "");
  return relPath ? `/build/${relPath}` : "/build/index.html";
}

function sceneTitle(scene) {
  return scene?.headline || scene?.sceneId || "scene";
}

function eventText(event) {
  if (!event) return "";
  return `${event.event}${event.data?.status ? `:${event.data.status}` : ""}`;
}

function buildShell(documentRef, root) {
  const header = createElement(documentRef, "header", { className: "topbar" });
  const title = createElement(documentRef, "div", { className: "project-title" });
  const status = createElement(documentRef, "div", { className: "status-strip" });
  header.append(title, status);

  const sceneRail = createElement(documentRef, "aside", { className: "scene-rail" });
  const sceneHeader = createElement(documentRef, "div", { className: "panel-head" }, [
    createElement(documentRef, "h2", { textContent: "Scenes" })
  ]);
  const sceneList = createElement(documentRef, "div", { className: "scene-grid" });
  sceneRail.append(sceneHeader, sceneList);

  const previewPane = createElement(documentRef, "main", { className: "preview-pane" });
  const iframe = createElement(documentRef, "iframe", { className: "preview-frame", title: "preview" });
  const previewOverlay = createElement(documentRef, "div", {
    className: "preview-update-overlay",
    hidden: true,
    textContent: "갱신 중"
  });
  const scrub = createElement(documentRef, "input", {
    className: "scrub",
    type: "range",
    min: 0,
    max: 1000,
    value: 0,
    step: 1
  });
  const playButton = createElement(documentRef, "button", { className: "icon-button", type: "button", textContent: "재생" });
  const timeLabel = createElement(documentRef, "span", { className: "time-label", textContent: "0.00s / 0.00s" });
  const renderButton = createElement(documentRef, "button", { className: "secondary-button", type: "button", textContent: "렌더" });
  const controls = createElement(documentRef, "div", { className: "preview-controls" }, [playButton, scrub, timeLabel, renderButton]);
  const waveform = createElement(documentRef, "div", { className: "waveform", "aria-hidden": "true" });
  for (let index = 0; index < 54; index += 1) {
    waveform.append(createElement(documentRef, "span", { style: `--h:${18 + ((index * 17) % 64)}%` }));
  }
  previewPane.append(createElement(documentRef, "div", { className: "frame-wrap" }, [iframe, previewOverlay]), controls, waveform);

  const detailPane = createElement(documentRef, "aside", { className: "detail-pane" });
  const tabs = createElement(documentRef, "div", { className: "tabs" });
  const sceneTab = createElement(documentRef, "button", { type: "button", textContent: "Scene", dataset: { tab: "scene" } });
  const transitionTab = createElement(documentRef, "button", { type: "button", textContent: "Transitions", dataset: { tab: "transitions" } });
  const versionsTab = createElement(documentRef, "button", { type: "button", textContent: "Versions", dataset: { tab: "versions" } });
  tabs.append(sceneTab, transitionTab, versionsTab);
  const impact = createElement(documentRef, "div", { className: "impact-region" });
  const detailBody = createElement(documentRef, "div", { className: "detail-body" });
  detailPane.append(tabs, impact, detailBody);

  const workspace = createElement(documentRef, "div", { className: "workspace" }, [sceneRail, previewPane, detailPane]);
  root.replaceChildren(header, workspace);

  return {
    title,
    status,
    sceneList,
    iframe,
    previewOverlay,
    scrub,
    playButton,
    timeLabel,
    renderButton,
    tabs,
    sceneTab,
    transitionTab,
    versionsTab,
    impact,
    detailBody
  };
}

function renderStatus(documentRef, refs, state, api) {
  const status = state.project?.status ?? {};
  refs.title.replaceChildren(
    createElement(documentRef, "strong", { textContent: state.specs?.projectId ?? "ReelForge Studio" }),
    createElement(documentRef, "span", { textContent: state.project?.projectDir ?? "" })
  );
  refs.status.replaceChildren(
    createElement(documentRef, "span", { className: "status-pill", textContent: api.isMock ? "mock" : "live" }),
    createElement(documentRef, "span", { textContent: `${status.sceneCount ?? state.specs?.scenes?.length ?? 0} scenes` }),
    createElement(documentRef, "span", { textContent: status.dirty ? "dirty" : "clean" }),
    createElement(documentRef, "span", { textContent: eventText(state.lastEvent) })
  );
}

function renderSceneList(documentRef, refs, state, selectScene, api) {
  refs.sceneList.replaceChildren();
  for (const scene of state.specs?.scenes ?? []) {
    const selected = scene.sceneId === state.selectedSceneId;
    const card = createElement(documentRef, "div", {
      className: `scene-card${selected ? " is-selected" : ""}`,
      dataset: { sceneId: scene.sceneId }
    });
    const main = createElement(documentRef, "button", {
      type: "button",
      className: "scene-card-main"
    });
    main.append(
      createElement(documentRef, "div", { className: "thumb" }, [
        createElement(documentRef, "span", { textContent: String(scene.sceneNumber ?? "") })
      ]),
      createElement(documentRef, "div", { className: "scene-card-copy" }, [
        createElement(documentRef, "strong", { textContent: sceneTitle(scene) }),
        createElement(documentRef, "span", { className: "layout-badge", textContent: scene.layout ?? "layout" })
      ])
    );
    main.addEventListener("click", () => selectScene(scene.sceneId));
    card.append(main);

    const renderJob = state.renderJobsByScene[scene.sceneId] ?? null;
    const preview = state.scenePreviews[scene.sceneId] ?? null;
    if (preview?.href) {
      card.append(
        createElement(documentRef, "a", {
          className: "scene-preview-link",
          href: preview.href,
          target: "_blank",
          rel: "noreferrer",
          textContent: "프리뷰"
        })
      );
    } else if (renderJob) {
      card.append(
        createElement(documentRef, "span", {
          className: `scene-render-status tone-${renderJob.status}`,
          textContent: renderJob.status === "failed" ? "렌더 실패" : "렌더 중"
        })
      );
    }
    refs.sceneList.append(card);
  }
}

function renderImpact(documentRef, refs, state, performAction, reloadProject) {
  refs.impact.replaceChildren();
  const impact = state.lastImpact;
  const details = impactDetails(impact?.class);
  const badge = createElement(documentRef, "span", {
    className: `impact-badge tone-${details.tone}`,
    textContent: details.label
  });
  refs.impact.append(badge);

  if (impact?.reason) refs.impact.append(createElement(documentRef, "span", { className: "impact-reason", textContent: impact.reason }));
  if (state.needsReload) {
    const reload = createElement(documentRef, "button", {
      type: "button",
      className: "secondary-button",
      textContent: "재로드"
    });
    reload.addEventListener("click", () => reloadProject?.());
    refs.impact.append(reload);
  }
  const rawActions = impact?.actions ?? [];
  const actions = rawActions.includes("pipeline:tts") ? ["pipeline:tts"] : rawActions;
  if (actions.length === 0) return;

  const actionGroup = createElement(documentRef, "div", { className: "action-group" });
  for (const action of actions) {
    const button = createElement(documentRef, "button", {
      type: "button",
      className: "secondary-button",
      textContent: action === "pipeline:tts" ? "TTS 재생성+재컴파일" : actionLabel(action),
      dataset: { action }
    });
    button.addEventListener("click", () => performAction(action));
    actionGroup.append(button);
  }
  refs.impact.append(actionGroup);
}

function renderSceneDetail({ documentRef, refs, state, rootSchema, saveScene }) {
  const scene = currentScene(state);
  refs.detailBody.replaceChildren();
  if (!scene) {
    refs.detailBody.append(createElement(documentRef, "p", { className: "empty-field", textContent: "No scene" }));
    return;
  }
  renderSceneForm({
    documentRef,
    container: refs.detailBody,
    rootSchema,
    scene,
    onSave: saveScene
  });
}

function transitionRow(documentRef, transition, sceneIds, index) {
  const row = createElement(documentRef, "div", { className: "transition-row", dataset: { index: String(index) } });
  const from = createElement(documentRef, "select", { name: "from" });
  const to = createElement(documentRef, "select", { name: "to" });
  for (const sceneId of sceneIds) {
    from.append(createElement(documentRef, "option", { value: sceneId, textContent: sceneId }));
    to.append(createElement(documentRef, "option", { value: sceneId, textContent: sceneId }));
  }
  from.value = transition.from;
  to.value = transition.to;
  const type = createElement(documentRef, "select", { name: "type" });
  for (const candidate of ["cut", "fade", "crossfade", "slide", "wipe", "slide_left", "slide_right", "wipe_left", "wipe_right"]) {
    type.append(createElement(documentRef, "option", { value: candidate, textContent: candidate }));
  }
  type.value = transition.type;
  const duration = createElement(documentRef, "input", {
    name: "duration",
    type: "number",
    min: 0,
    max: 10,
    step: 0.01,
    value: transition.duration ?? 0
  });
  const remove = createElement(documentRef, "button", { type: "button", className: "icon-button", textContent: "삭제" });
  remove.addEventListener("click", () => row.remove());
  row.append(from, to, type, duration, remove);
  return row;
}

function collectTransitions(container) {
  return [...container.querySelectorAll(".transition-row")].map((row) => ({
    from: row.querySelector('[name="from"]').value,
    to: row.querySelector('[name="to"]').value,
    type: row.querySelector('[name="type"]').value,
    duration: Number(row.querySelector('[name="duration"]').value)
  }));
}

function renderTransitions({ documentRef, refs, state, saveTransitions }) {
  refs.detailBody.replaceChildren();
  const sceneIds = (state.specs?.scenes ?? []).map((scene) => scene.sceneId);
  const form = createElement(documentRef, "form", { className: "transitions-form" });
  const list = createElement(documentRef, "div", { className: "transition-list" });
  for (const [index, transition] of (state.specs?.transitions ?? []).entries()) {
    list.append(transitionRow(documentRef, transition, sceneIds, index));
  }
  const add = createElement(documentRef, "button", { type: "button", className: "secondary-button", textContent: "추가" });
  add.addEventListener("click", () => {
    list.append(
      transitionRow(
        documentRef,
        {
          from: sceneIds[0] ?? "",
          to: sceneIds[1] ?? sceneIds[0] ?? "",
          type: "cut",
          duration: 0
        },
        sceneIds,
        list.children.length
      )
    );
  });
  const save = createElement(documentRef, "button", { type: "submit", className: "primary-button", textContent: "저장" });
  form.append(list, createElement(documentRef, "div", { className: "form-footer" }, [add, save]));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveTransitions(collectTransitions(list));
  });
  refs.detailBody.append(form);
}

function renderVersions({ documentRef, refs, state, selectVersion, rollbackVersion }) {
  refs.detailBody.replaceChildren();
  const resources = state.project?.versions?.resources ?? {};
  const names = Object.keys(resources).sort((a, b) => a.localeCompare(b));
  if (names.length === 0) {
    refs.detailBody.append(createElement(documentRef, "p", { className: "empty-field", textContent: "No versions" }));
    return;
  }
  const list = createElement(documentRef, "div", { className: "versions-list" });
  for (const resourceType of names) {
    const history = resources[resourceType];
    const section = createElement(documentRef, "section", { className: "version-resource" });
    const head = createElement(documentRef, "div", { className: "version-resource-head" });
    head.append(createElement(documentRef, "h3", { textContent: resourceType }));
    if ((history.entries ?? []).length > 1) {
      const rollback = createElement(documentRef, "button", {
        type: "button",
        className: "secondary-button",
        textContent: "롤백"
      });
      rollback.addEventListener("click", () => rollbackVersion(resourceType));
      head.append(rollback);
    }
    section.append(head);
    for (const entry of history.entries ?? []) {
      const selected = entry.gen === history.selected;
      const row = createElement(documentRef, "div", { className: `version-row${selected ? " is-selected" : ""}` });
      row.append(
        createElement(documentRef, "span", { className: "gen-label", textContent: entry.gen }),
        createElement(documentRef, "span", { className: "version-note", textContent: entry.note ?? "" })
      );
      const button = createElement(documentRef, "button", {
        type: "button",
        className: "secondary-button",
        textContent: selected ? "selected" : "전환",
        disabled: selected
      });
      button.addEventListener("click", () => selectVersion(resourceType, entry.gen));
      row.append(button);
      section.append(row);
    }
    list.append(section);
  }
  refs.detailBody.append(list);
}

export async function createStudioPanel({
  root = globalThis.document?.getElementById("rf-app"),
  documentRef = globalThis.document,
  windowRef = globalThis.window,
  api = createApi({ windowRef }),
  schema = null
} = {}) {
  if (!root) throw new Error("ReelForge panel root not found");

  const rootSchema = schema ?? (await loadSceneSpecsSchema({ windowRef }));
  const refs = buildShell(documentRef, root);
  const preview = createPreviewController({
    iframe: refs.iframe,
    scrub: refs.scrub,
    playButton: refs.playButton,
    timeLabel: refs.timeLabel,
    windowRef
  });
  const state = {
    project: null,
    specs: null,
    specsHash: null,
    selectedSceneId: null,
    activeTab: "scene",
    lastImpact: null,
    lastEvent: null,
    lastError: null,
    needsReload: false,
    previewUpdating: false,
    previewUpdateFailed: false,
    previewCompileJobId: null,
    previewSourceVersion: 0,
    renderJobsByScene: {},
    scenePreviews: {}
  };
  const pollingJobs = new Set();
  let closed = false;

  function renderRight() {
    for (const button of [refs.sceneTab, refs.transitionTab, refs.versionsTab]) {
      button.classList.toggle("is-active", button.dataset.tab === state.activeTab);
    }
    if (state.activeTab === "transitions") renderTransitions({ documentRef, refs, state, saveTransitions });
    else if (state.activeTab === "versions") renderVersions({ documentRef, refs, state, selectVersion, rollbackVersion });
    else renderSceneDetail({ documentRef, refs, state, rootSchema, saveScene });
  }

  function render() {
    renderStatus(documentRef, refs, state, api);
    renderSceneList(documentRef, refs, state, selectScene, api);
    renderImpact(documentRef, refs, state, performAction, reloadProject);
    renderRight();
    renderPreviewOverlay();
  }

  async function refreshProject() {
    state.project = await api.getProject();
    state.specs = state.project.specs ?? (await api.getSpecs());
    state.specsHash = state.project.specsHash ?? null;
    if (!state.selectedSceneId) state.selectedSceneId = state.specs?.scenes?.[0]?.sceneId ?? null;
    for (const job of state.project.status?.jobs ?? []) upsertJob(job);
  }

  function renderPreviewOverlay() {
    refs.previewOverlay.hidden = !state.previewUpdating && !state.previewUpdateFailed;
    refs.previewOverlay.textContent = state.previewUpdateFailed ? "갱신 실패" : "갱신 중";
  }

  function setPreviewUpdating(job = null) {
    state.previewUpdating = true;
    state.previewUpdateFailed = false;
    if (job?.id) state.previewCompileJobId = job.id;
    renderPreviewOverlay();
  }

  function setPreviewSettled({ failed = false } = {}) {
    state.previewUpdating = false;
    state.previewUpdateFailed = failed;
    state.previewCompileJobId = null;
    renderPreviewOverlay();
  }

  function setPreviewForSelected({ resetSeek = true } = {}) {
    const scene = currentScene(state);
    if (!scene) return;
    const duration = sceneDurationSec(state, scene.sceneId);
    const seekProgress = resetSeek ? DEFAULT_SCENE_PREVIEW_PROGRESS : undefined;
    if (api.isMock && typeof api.mockPreviewHtml === "function") {
      preview.setSource({
        html: api.mockPreviewHtml(),
        seekProgress,
        duration: duration ?? undefined
      });
      return;
    }
    state.previewSourceVersion += 1;
    const url = buildScenePreviewUrl(state, scene.sceneId);
    preview.setSource({
      url: `${url}${url.includes("?") ? "&" : "?"}rfv=${state.previewSourceVersion}`,
      seekProgress,
      duration: duration ?? undefined
    });
  }

  async function reloadProject() {
    state.needsReload = false;
    state.lastImpact = null;
    state.lastError = null;
    await refreshProject();
    setPreviewForSelected();
    render();
  }

  function artifactUrl(relPath) {
    if (!relPath) return "";
    if (typeof api.artifactUrl === "function") return api.artifactUrl(relPath);
    return String(relPath);
  }

  function upsertJob(job) {
    if (!job?.id) return;
    if (job.type === "compile") {
      if (["queued", "running"].includes(job.status)) setPreviewUpdating(job);
      else if (job.id === state.previewCompileJobId && job.status === "failed") setPreviewSettled({ failed: true });
      else if (job.id === state.previewCompileJobId && job.status === "succeeded") setPreviewSettled();
      return;
    }
    if (job.type !== "render" || !job.sceneId) return;
    state.renderJobsByScene[job.sceneId] = job;
    if (job.status === "succeeded" && job.output) {
      state.scenePreviews[job.sceneId] = {
        href: artifactUrl(job.output),
        output: job.output,
        jobId: job.id,
        bytes: job.bytes ?? 0
      };
    }
  }

  function wait(ms) {
    return new Promise((resolve) => windowRef.setTimeout?.(resolve, ms) ?? setTimeout(resolve, ms));
  }

  async function pollJob(jobId) {
    if (!jobId || typeof api.getJob !== "function" || pollingJobs.has(jobId)) return;
    pollingJobs.add(jobId);
    try {
      for (;;) {
        if (closed) return;
        await wait(500);
        const payload = await api.getJob(jobId);
        const job = payload.job ?? payload;
        upsertJob(job);
        if (job.type === "compile" && TERMINAL_JOB_STATUSES.has(job.status)) {
          if (job.status === "succeeded") {
            setPreviewSettled();
            await refreshProject();
            setPreviewForSelected();
          } else {
            setPreviewSettled({ failed: true });
          }
          render();
          return;
        }
        renderStatus(documentRef, refs, state, api);
        renderSceneList(documentRef, refs, state, selectScene, api);
        if (TERMINAL_JOB_STATUSES.has(job.status)) return;
      }
    } catch (error) {
      state.lastError = error;
      state.lastImpact = { class: "E3", actions: [], reason: error.message };
      render();
    } finally {
      pollingJobs.delete(jobId);
    }
  }

  function selectScene(sceneId) {
    state.selectedSceneId = sceneId;
    state.activeTab = "scene";
    setPreviewForSelected();
    render();
  }

  async function saveScene(patch) {
    const scene = currentScene(state);
    if (!scene || Object.keys(patch).length === 0) {
      state.lastImpact = { class: "E1", actions: [], reason: "no material field change" };
      render();
      return;
    }
    try {
      const result = await api.patchScene(scene.sceneId, patch, { ifMatch: state.specsHash });
      state.lastImpact = result;
      state.needsReload = false;
      if (result.specsHash) state.specsHash = result.specsHash;
      if (result.compileJob) {
        setPreviewUpdating(result.compileJob);
        pollJob(result.compileJob.id);
      }
      await refreshProject();
      render();
    } catch (error) {
      state.lastError = error;
      if (error.status === 409) {
        state.needsReload = true;
        state.lastImpact = { class: "E3", actions: [], reason: "다른 곳에서 수정됨" };
      } else {
        state.lastImpact = { class: "E3", actions: [], reason: error.message };
      }
      render();
    }
  }

  async function saveTransitions(transitions) {
    try {
      const result = await api.patchTransitions(transitions, { ifMatch: state.specsHash });
      state.lastImpact = result;
      state.needsReload = false;
      if (result.specsHash) state.specsHash = result.specsHash;
      if (result.compileJob) {
        setPreviewUpdating(result.compileJob);
        pollJob(result.compileJob.id);
      }
      await refreshProject();
      render();
    } catch (error) {
      state.lastError = error;
      if (error.status === 409) {
        state.needsReload = true;
        state.lastImpact = { class: "E3", actions: [], reason: "다른 곳에서 수정됨" };
      } else {
        state.lastImpact = { class: "E3", actions: [], reason: error.message };
      }
      render();
    }
  }

  async function performAction(action) {
    const scene = currentScene(state);
    try {
      if (action === "compile:scene") {
        const result = await api.compile({ scope: "scene", sceneId: scene?.sceneId ?? null });
        if (result.job) {
          setPreviewUpdating(result.job);
          pollJob(result.job.id);
        }
      } else if (action === "compile:full") {
        const result = await api.compile({ scope: "full" });
        if (result.job) {
          setPreviewUpdating(result.job);
          pollJob(result.job.id);
        }
      } else if (action === "pipeline:tts" && scene) {
        const result = await api.runTts([scene.sceneId]);
        if (result.compileJob) {
          setPreviewUpdating(result.compileJob);
          pollJob(result.compileJob.id);
        }
        await refreshProject();
      }
      state.lastEvent = { event: action, data: { status: "queued" } };
      render();
    } catch (error) {
      state.lastError = error;
      state.lastImpact = { class: "E3", actions: [], reason: error.message };
      render();
    }
  }

  async function selectVersion(resourceType, gen) {
    try {
      const result = await api.selectVersion(resourceType, gen);
      if (result.compileJob) {
        setPreviewUpdating(result.compileJob);
        pollJob(result.compileJob.id);
      }
      await refreshProject();
      render();
    } catch (error) {
      state.lastError = error;
      state.lastImpact = { class: "E3", actions: [], reason: error.message };
      render();
    }
  }

  async function rollbackVersion(resourceType) {
    try {
      const result = await api.rollbackVersion(resourceType);
      if (result.compileJob) {
        setPreviewUpdating(result.compileJob);
        pollJob(result.compileJob.id);
      }
      await refreshProject();
      render();
    } catch (error) {
      state.lastError = error;
      state.lastImpact = { class: "E3", actions: [], reason: error.message };
      render();
    }
  }

  refs.renderButton.addEventListener("click", async () => {
    const scene = currentScene(state);
    if (!scene) return;
    try {
      const result = await api.renderScene(scene.sceneId);
      const job = result.job ?? result;
      upsertJob(job);
      render();
      pollJob(job.id);
    } catch (error) {
      state.lastError = error;
      state.lastImpact = { class: "E3", actions: [], reason: error.message };
      render();
    }
  });

  for (const button of [refs.sceneTab, refs.transitionTab, refs.versionsTab]) {
    button.addEventListener("click", () => {
      state.activeTab = button.dataset.tab;
      renderRight();
    });
  }

  async function handleServerEvent({ event, data }) {
    state.lastEvent = { event, data };
    if (event === "render.status") upsertJob(data);
    if (event === "compile.completed") {
      setPreviewSettled();
      await refreshProject();
      setPreviewForSelected();
    } else if (event === "compile.failed") {
      setPreviewSettled({ failed: true });
      await refreshProject();
    } else if (event === "file.changed") {
      await refreshProject();
      if (data?.path !== "versions.json") setPreviewForSelected({ resetSeek: false });
    } else if (PREVIEW_RELOAD_EVENTS.has(event)) {
      await refreshProject();
    }
    render();
  }

  const subscription = api.subscribeEvents((message) => {
    handleServerEvent(message).catch((error) => {
      state.lastError = error;
      state.lastImpact = { class: "E3", actions: [], reason: error.message };
      render();
    });
  });

  await refreshProject();
  setPreviewForSelected();
  render();

  return {
    api,
    refs,
    preview,
    state,
    render,
    selectScene,
    saveScene,
    saveTransitions,
    close: () => {
      closed = true;
      subscription.close();
    }
  };
}

if (globalThis.document?.getElementById("rf-app")) {
  createStudioPanel()
    .then((panel) => {
      globalThis.__RF_STUDIO = panel;
    })
    .catch((error) => {
      const root = globalThis.document.getElementById("rf-app");
      root.textContent = error instanceof Error ? error.message : String(error);
    });
}

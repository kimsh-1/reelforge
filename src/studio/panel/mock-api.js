const TRANSITION_TYPES = ["cut", "fade", "crossfade", "slide", "wipe", "slide_left", "slide_right", "wipe_left", "wipe_right"];

const E1_FIELDS = new Set([
  "narration",
  "altText",
  "caption",
  "layout",
  "mood",
  "reveal",
  "emphasis",
  "headline",
  "items",
  "values",
  "unit",
  "source",
  "visual_kind",
  "imageAsset",
  "kenBurns",
  "subtitleMode",
  "ost",
  "overrides"
]);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function nowIso(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

function mockSpecs() {
  return {
    version: "1.0.0",
    projectId: "studio-mock",
    scenes: [
      {
        sceneId: "s01",
        sceneNumber: 1,
        narration: "서비스 지표를 한눈에 보는 세 장면 요약입니다.",
        narration_tts: "서비스 지표를 한눈에 보는 세 장면 요약입니다.",
        altText: "짙은 배경 위에 오늘의 핵심 헤드라인만 배치된 첫 장면.",
        layout: "headline_only",
        mood: "informative",
        reveal: "fade_in",
        emphasis: "keyword",
        headline: "오늘의 핵심",
        items: [],
        values: [],
        unit: "",
        source: "mock:studio",
        visual_kind: "none",
        kenBurns: {
          enabled: false,
          zoomFactor: 1,
          zoomDirection: "in",
          panDirection: "none"
        },
        subtitleMode: "keyword",
        overrides: {
          headline: { x: 12, y: 18, width: 76, height: 24 },
          image: { x: 18, y: 48, width: 64, height: 32 }
        }
      },
      {
        sceneId: "s02",
        sceneNumber: 2,
        narration: "고객 반응은 안정적이고, 전환율은 천천히 개선되고 있습니다.",
        narration_tts: "고객 반응은 안정적이고, 전환율은 천천히 개선되고 있습니다.",
        altText: "밝은 제목 영역에 전환율 안정권 문구만 크게 표시된 두 번째 장면.",
        layout: "statistic",
        mood: "contemplative",
        reveal: "zoom_in",
        emphasis: "number",
        headline: "전환율 안정권",
        items: ["가입", "활성", "결제"],
        values: [31, 44, 18],
        unit: "%",
        source: "mock:studio",
        visual_kind: "chart",
        kenBurns: {
          enabled: false,
          zoomFactor: 1,
          zoomDirection: "in",
          panDirection: "none"
        },
        subtitleMode: "keyword"
      },
      {
        sceneId: "s03",
        sceneNumber: 3,
        narration: "다음 실험은 가격 안내 문구를 더 명확하게 다듬는 것입니다.",
        narration_tts: "다음 실험은 가격 안내 문구를 더 명확하게 다듬는 것입니다.",
        altText: "다음 실험 헤드라인만 중앙에 놓인 마무리 장면.",
        layout: "compare",
        mood: "triumphant",
        reveal: "build_up",
        emphasis: "contrast",
        headline: "다음 실험",
        items: ["현재", "개선안"],
        values: ["모호함", "명확함"],
        unit: "",
        source: "mock:studio",
        visual_kind: "none",
        kenBurns: {
          enabled: false,
          zoomFactor: 1,
          zoomDirection: "in",
          panDirection: "none"
        },
        subtitleMode: "karaoke"
      }
    ],
    transitions: [
      { from: "s01", to: "s02", type: "fade", duration: 0.25 },
      { from: "s02", to: "s03", type: "cut", duration: 0 }
    ]
  };
}

function mockVersions() {
  return {
    resources: {
      image_s01: {
        entries: [
          { gen: "gen_01", path: "./assets/versions/image_s01/gen_01/mock.png", createdAt: nowIso(-8600000), note: "draft" },
          { gen: "gen_02", path: "./assets/versions/image_s01/gen_02/mock.png", createdAt: nowIso(-4200000), note: "selected" }
        ],
        selected: "gen_02"
      },
      image_s02: {
        entries: [
          { gen: "gen_01", path: "./assets/versions/image_s02/gen_01/mock.png", createdAt: nowIso(-7600000), note: "draft" }
        ],
        selected: "gen_01"
      }
    },
    editLock: null,
    dirty: false
  };
}

function changedSceneFields(beforeScene, fields) {
  return Object.keys(fields)
    .filter((field) => !jsonEqual(beforeScene?.[field], fields[field]))
    .sort((a, b) => a.localeCompare(b));
}

function classifyPatch(changedFields) {
  if (changedFields.includes("narration_tts")) {
    return {
      class: "E2",
      actions: ["pipeline:tts", "compile:full"],
      reason: "narration_tts sourceHash changed"
    };
  }
  const e1Fields = changedFields.filter((field) => E1_FIELDS.has(field));
  return {
    class: "E1",
    actions: e1Fields.length > 0 ? ["compile:scene"] : [],
    reason: e1Fields.length > 0 ? "scene presentation fields changed" : "no material field change"
  };
}

function makeJob(type, patch = {}) {
  const id = `${type}-mock-${Math.random().toString(36).slice(2, 10)}`;
  const createdAt = nowIso();
  return { id, type, status: "succeeded", createdAt, updatedAt: createdAt, ...patch };
}

function projectPayload(state) {
  return {
    projectDir: "/mock/reelforge-studio",
    specs: clone(state.specs),
    audio_meta: {
      version: "1.0.0",
      projectId: state.specs.projectId,
      scenes: state.specs.scenes.map((scene) => ({ sceneId: scene.sceneId, duration: 3.2, sourceHash: `mock-${scene.sceneId}` }))
    },
    versions: clone(state.versions),
    status: {
      sceneCount: state.specs.scenes.length,
      audioSceneCount: state.specs.scenes.length,
      buildReady: true,
      buildSceneCount: state.specs.scenes.length,
      dirty: state.versions.dirty,
      editLock: state.versions.editLock,
      jobs: clone(state.jobs)
    }
  };
}

export function mockPreviewHtml(specs = mockSpecs()) {
  const sceneRows = specs.scenes
    .map(
      (scene, index) => `
        <section class="mock-scene" style="left:${index * 100}%">
          <div class="label">${scene.sceneId}</div>
          <h1>${escapeHtml(scene.headline)}</h1>
          <p>${escapeHtml(scene.layout)} / ${escapeHtml(scene.mood)}</p>
        </section>`
    )
    .join("");
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html, body { margin: 0; width: 100%; height: 100%; background: #111827; color: #f8fafc; font-family: Pretendard, system-ui, sans-serif; overflow: hidden; }
    #stage { position: relative; width: 100vw; height: 100vh; background: linear-gradient(135deg, #121826, #263241); }
    .mock-scene { position: absolute; inset: 0; display: grid; place-content: center; gap: 18px; padding: 80px; text-align: center; transition: transform 120ms linear; }
    .label { color: #9ca3af; font-size: 42px; }
    h1 { margin: 0; font-size: 118px; letter-spacing: 0; }
    p { margin: 0; color: #cbd5e1; font-size: 36px; }
  </style>
</head>
<body>
  <main id="stage">${sceneRows}</main>
  <script>
    window.__timelines = window.__timelines || {};
    (function () {
      var current = 0;
      var playing = false;
      var duration = 9.6;
      function paint() {
        var scenes = document.querySelectorAll(".mock-scene");
        for (var i = 0; i < scenes.length; i += 1) {
          scenes[i].style.transform = "translateX(" + ((i - current * (scenes.length - 1)) * 100) + "%)";
        }
      }
      var tl = {
        duration: function () { return duration; },
        progress: function (value) {
          if (typeof value === "number") {
            current = Math.max(0, Math.min(1, value));
            paint();
            return tl;
          }
          return current;
        },
        time: function (value) {
          if (typeof value === "number") return tl.progress(value / duration);
          return current * duration;
        },
        play: function () { playing = true; return tl; },
        pause: function () { playing = false; return tl; },
        paused: function (value) {
          if (typeof value === "boolean") playing = value;
          return !playing;
        }
      };
      paint();
      window.__timelines.main = tl;
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function createMockApi({ initialSpecs = mockSpecs(), initialVersions = mockVersions(), timer = globalThis.setTimeout } = {}) {
  const state = {
    specs: clone(initialSpecs),
    versions: clone(initialVersions),
    jobs: []
  };
  const listeners = new Set();

  function emit(event, data = {}) {
    timer(() => {
      for (const listener of listeners) listener({ event, data });
    }, 20);
  }

  function sceneById(sceneId) {
    const index = state.specs.scenes.findIndex((scene) => scene.sceneId === sceneId);
    if (index < 0) throw new Error(`unknown sceneId: ${sceneId}`);
    return { scene: state.specs.scenes[index], index };
  }

  return {
    isMock: true,
    transitionTypes: TRANSITION_TYPES,
    getProject: async () => projectPayload(state),
    getSpecs: async () => clone(state.specs),
    patchScene: async (sceneId, fields) => {
      const { scene, index } = sceneById(sceneId);
      const changedFields = changedSceneFields(scene, fields);
      state.specs.scenes[index] = { ...scene, ...clone(fields) };
      state.versions.dirty = true;
      const impact = classifyPatch(changedFields);
      const compileJob =
        impact.class === "E1" && impact.actions.includes("compile:scene")
          ? makeJob("compile", { scope: "scene", sceneId, reason: "patch-scene" })
          : null;
      if (compileJob) {
        state.jobs.push(compileJob);
        emit("compile.completed", compileJob);
      }
      return {
        ...impact,
        sceneId,
        changedFields,
        backup: { gen: "gen_mock", note: `studio patch ${sceneId}` },
        compileJob
      };
    },
    patchTransitions: async (transitions) => {
      state.specs.transitions = clone(transitions);
      state.versions.dirty = true;
      const compileJob = makeJob("compile", { scope: "full", reason: "patch-transitions" });
      state.jobs.push(compileJob);
      emit("compile.completed", compileJob);
      return {
        class: "E3",
        actions: ["compile:full"],
        reason: "transitions changed",
        backup: { gen: "gen_mock", note: "studio patch transitions" },
        compileJob
      };
    },
    compile: async ({ scope = "full", sceneId = null } = {}) => {
      const job = makeJob("compile", { scope, sceneId, reason: "api" });
      state.jobs.push(job);
      emit("compile.completed", job);
      return { job, statusUrl: `/api/jobs/${job.id}` };
    },
    renderScene: async (sceneId) => {
      const job = makeJob("render", { sceneId, composition: `scenes/scene-${sceneId}.html`, bytes: 12000 });
      state.jobs.push(job);
      emit("render.status", job);
      return { job, statusUrl: `/api/jobs/${job.id}` };
    },
    runTts: async (sceneIds) => {
      const compileJob = makeJob("compile", { scope: "full", reason: "pipeline-tts" });
      state.jobs.push(compileJob);
      emit("tts.completed", { sceneIds, result: { profile: "mock" } });
      emit("compile.completed", compileJob);
      return { sceneIds, result: { profile: "mock" }, actions: ["compile:full"], compileJob };
    },
    selectVersion: async (resourceType, gen) => {
      const history = state.versions.resources?.[resourceType];
      if (!history) throw new Error(`unknown resource: ${resourceType}`);
      if (!history.entries.some((entry) => entry.gen === gen)) throw new Error(`unknown generation: ${gen}`);
      history.selected = gen;
      state.versions.dirty = true;
      emit("file.changed", { path: "versions.json", resourceType, gen });
      return { resourceType, selected: gen, history: clone(history) };
    },
    subscribeEvents: (callback) => {
      listeners.add(callback);
      return { close: () => listeners.delete(callback) };
    },
    mockPreviewHtml: () => mockPreviewHtml(state.specs)
  };
}

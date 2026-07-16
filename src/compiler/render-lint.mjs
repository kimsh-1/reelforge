import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { normalizeRelPath } from "./utils.mjs";

// Authored free-scene fragment contract version. Bump on breaking contract changes and
// keep every supported version in SUPPORTED_FRAGMENT_VERSIONS during a migration window.
export const RF_FRAGMENT_VERSION = "1.0";
export const SUPPORTED_FRAGMENT_VERSIONS = new Set([RF_FRAGMENT_VERSION]);

// Every violation carries a stable machine code, the human rule, and a repair hint the
// re-authoring loop can hand straight to a scene worker. `rule` strings are load-bearing
// for log greps — change codes/hints freely, change rules deliberately.
export const LINT_RULES = {
  "RF-FRAGMENT-001": {
    rule: "inline scene script must parse and pass the compiler VM smoke check",
    hint: "fix the script error in measured.error; the script must run synchronously against the stubbed gsap/document sandbox"
  },
  "RF-FRAGMENT-002": {
    rule: "inline fetch() is forbidden in generated compositions",
    hint: "remove the fetch() call; bake all data into the fragment at authoring time"
  },
  "RF-FRAGMENT-003": {
    rule: "wall-clock/random calls are forbidden in compositions (non-deterministic render)",
    hint: "replace Math.random()/Date.now()/performance.now() with constants or timeline-driven values"
  },
  "RF-FRAGMENT-004": {
    rule: "gsap.timeline must be created with { paused: true }",
    hint: "create every timeline as gsap.timeline({ paused: true }); the renderer owns playback via seek"
  },
  "RF-FRAGMENT-005": {
    rule: "scene sub-composition must be body-root (no <template>) so standalone --composition render can read root metadata",
    hint: "compiled scene wrappers must not template-wrap the root; this is a compiler-stage defect, not a scene-author defect"
  },
  "RF-FRAGMENT-006": {
    rule: "scene sub-composition must be a full document with <body>",
    hint: "emit a complete HTML document with <body> for every compiled scene"
  },
  "RF-FRAGMENT-007": {
    rule: "scene sub-compositions must not contain <audio> or <video>",
    hint: "media playback is engine-owned; remove <audio>/<video> from the scene and declare audio via audio_meta.json"
  },
  "RF-FRAGMENT-008": {
    rule: "scene template root must be #root with data-composition-id",
    hint: "the scene root must be <div id=\"root\" data-composition-id=\"<sceneId>\">"
  },
  "RF-FRAGMENT-009": {
    rule: "scene file composition id is not mounted by the manifest scene set",
    hint: "measured.sceneId must exist in scene_specs.json scenes[].sceneId; fix the id or the manifest"
  },
  "RF-FRAGMENT-010": {
    rule: "scene timeline key must match root data-composition-id",
    hint: "register the timeline at window.__timelines[\"<data-composition-id>\"] with the exact same id"
  },
  "RF-FRAGMENT-011": {
    rule: "scene #root must not be styled through a root class",
    hint: "style via #root and child selectors; remove class attributes from the root element"
  },
  "RF-FRAGMENT-012": {
    rule: "fullscreen background must live on a full-bleed child, not #root",
    hint: "move background declarations from #root onto an inset:0 child layer"
  },
  "RF-FRAGMENT-013": {
    rule: "scene CSS must style the sub-composition root with #root",
    hint: "add a #root { ... } rule so the scene owns its own canvas box"
  },
  "RF-FRAGMENT-014": {
    rule: "authored fragment root must declare a supported data-rf-fragment-version",
    hint: `add data-rf-fragment-version="${RF_FRAGMENT_VERSION}" to the fragment root element (next to data-composition-id)`
  },
  "RF-FRAGMENT-015": {
    rule: "remote script/style references are forbidden in compositions (offline deterministic render)",
    hint: "load scripts and styles from local build-relative paths only; GSAP is provided at vendor/gsap.min.js"
  },
  "RF-INDEX-001": {
    rule: "index root composition id and timeline key must be main",
    hint: "compiled index.html must expose data-composition-id=\"main\" and window.__timelines[\"main\"]"
  },
  "RF-INDEX-002": {
    rule: "every compiled scene must be mounted in index.html",
    hint: "each scene needs a slot with matching data-composition-id and data-composition-src in index.html"
  },
  "RF-BUILD-001": {
    rule: "orphan scene file is forbidden; every scene HTML must be mounted",
    hint: "delete the stray build/scenes file or add its scene to scene_specs.json; the build dir is generated, so fix inputs and recompile"
  },
  "RF-BUILD-002": {
    rule: "expected compiled scene file is missing",
    hint: "the compiler did not emit this scene; recompile and check compile-stage errors for the scene id"
  }
};

function htmlFilesUnder(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => path.join(dir, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

function extractTimelineKeys(html) {
  return [...html.matchAll(/__timelines\s*\[\s*["']([^"']+)["']\s*\]/g)].map((match) => match[1]);
}

function extractCompositionIds(html) {
  return [...html.matchAll(/data-composition-id=["']([^"']+)["']/g)].map((match) => match[1]);
}

function timelineCalls(html) {
  return [...html.matchAll(/gsap\.timeline\s*\(([^)]*)\)/g)].map((match) => match[1]);
}

function lineForOffset(text, offset) {
  return text.slice(0, offset).split(/\r?\n/).length;
}

function pushViolation(violations, file, code, measured = {}) {
  const spec = LINT_RULES[code];
  if (!spec) throw new Error(`unknown lint rule code: ${code}`);
  // Violations inside authored free fragments are fixed by re-authoring the scene;
  // violations in compiler-generated files (scene wrappers, index) are engine defects.
  const authored = /(^|\/)blocks\/free\//.test(file);
  violations.push({
    file,
    code,
    rule: spec.rule,
    hint: spec.hint,
    stage: authored ? "scene-author" : "compiler",
    retryable: authored,
    measured
  });
}

function inlineScripts(html) {
  const scripts = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const attrs = match[1] ?? "";
    if (/\bsrc\s*=/i.test(attrs)) continue;
    scripts.push({
      code: match[2] ?? "",
      line: lineForOffset(html, match.index + match[0].indexOf(">") + 1)
    });
  }
  return scripts;
}

function createChainableTimeline() {
  const timeline = {};
  for (const method of [
    "add",
    "addLabel",
    "call",
    "from",
    "fromTo",
    "pause",
    "seek",
    "set",
    "to"
  ]) {
    timeline[method] = () => timeline;
  }
  return timeline;
}

function createElementStub() {
  const style = { setProperty() {} };
  const element = {
    append() {},
    appendChild(child) {
      return child;
    },
    classList: { add() {}, remove() {}, toggle() {} },
    dataset: {},
    getAttribute() {
      return null;
    },
    hasAttribute() {
      return false;
    },
    parentElement: null,
    querySelector() {
      return element;
    },
    querySelectorAll() {
      return [];
    },
    removeAttribute() {},
    setAttribute() {},
    style,
    textContent: ""
  };
  return element;
}

function scriptSandbox() {
  const element = createElementStub();
  const document = {
    createElement() {
      return createElementStub();
    },
    fonts: { ready: Promise.resolve() },
    getElementById() {
      return element;
    },
    querySelector() {
      return element;
    },
    querySelectorAll() {
      return [];
    }
  };
  const gsap = {
    set() {},
    timeline() {
      return createChainableTimeline();
    },
    utils: {
      toArray(value) {
        return Array.isArray(value) ? value : [];
      }
    }
  };
  const sandbox = {
    console,
    document,
    gsap,
    Intl,
    JSON,
    Math,
    Number,
    Promise,
    Set,
    String,
    __hfTimelineCompId: "",
    __hyperframes: { getVariables: () => ({}) },
    clearTimeout() {},
    setTimeout(callback) {
      if (typeof callback === "function") callback();
      return 0;
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return sandbox;
}

function checkInlineScripts({ rel, html, violations }) {
  const scripts = inlineScripts(html);
  scripts.forEach((script, index) => {
    if (!script.code.trim()) return;
    try {
      vm.runInNewContext(script.code, scriptSandbox(), {
        filename: `${rel}:inline-script-${index + 1}`,
        timeout: 1000
      });
    } catch (error) {
      pushViolation(violations, rel, "RF-FRAGMENT-001", {
        scriptIndex: index,
        line: script.line,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}

function checkNoFetch({ rel, html, violations }) {
  const match = html.match(/\bfetch\s*\(/);
  if (match) {
    pushViolation(violations, rel, "RF-FRAGMENT-002", {
      line: lineForOffset(html, match.index ?? 0)
    });
  }
}

function checkNoWallClock({ rel, html, violations }) {
  // wall-clock / randomness breaks seek-safe deterministic renders — especially
  // in authored free-scene and block fragments the VM smoke check can't exercise
  for (const pattern of [/\bMath\.random\s*\(/, /\bDate\.now\s*\(/, /\bperformance\.now\s*\(/]) {
    const match = html.match(pattern);
    if (match) {
      pushViolation(violations, rel, "RF-FRAGMENT-003", {
        call: match[0],
        line: lineForOffset(html, match.index ?? 0)
      });
    }
  }
}

function checkPausedTimelines({ rel, html, violations }) {
  for (const call of timelineCalls(html)) {
    if (!/paused\s*:\s*true/.test(call)) {
      pushViolation(violations, rel, "RF-FRAGMENT-004", { call });
    }
  }
}

function checkNoRemoteRefs({ rel, html, violations }) {
  const pattern = /<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
  for (const match of html.matchAll(pattern)) {
    pushViolation(violations, rel, "RF-FRAGMENT-015", {
      url: match[1],
      line: lineForOffset(html, match.index ?? 0)
    });
  }
}

function checkFragmentVersion({ rel, html, violations }) {
  const rootMatch = html.match(/<[^>]*\bdata-composition-id=[^>]*>/);
  const versionMatch = rootMatch?.[0].match(/data-rf-fragment-version=["']([^"']+)["']/);
  if (!versionMatch) {
    pushViolation(violations, rel, "RF-FRAGMENT-014", { expected: RF_FRAGMENT_VERSION });
    return;
  }
  if (!SUPPORTED_FRAGMENT_VERSIONS.has(versionMatch[1])) {
    pushViolation(violations, rel, "RF-FRAGMENT-014", {
      found: versionMatch[1],
      supported: [...SUPPORTED_FRAGMENT_VERSIONS]
    });
  }
}

function checkSceneFile({ repoRoot, buildDir, file, expectedSceneIds, violations }) {
  const rel = normalizeRelPath(path.relative(repoRoot, file));
  const html = readFileSync(file, "utf8");
  checkNoFetch({ rel, html, violations });
  checkNoWallClock({ rel, html, violations });
  checkPausedTimelines({ rel, html, violations });
  checkNoRemoteRefs({ rel, html, violations });
  checkInlineScripts({ rel, html, violations });

  // body-root 계약: 벤더 htmlCompiler는 <template>/<body> 양쪽을 허용하지만,
  // 단독 --composition 렌더의 정적 메타 파싱(querySelector)은 root가 template 밖
  // live DOM일 때만 성립한다 (P2 통합 실증 — template 내부는 comp-id 조회 불가).
  // 프리뷰 티어(씬 단독 렌더)가 핵심 계약이므로 씬 파일의 template 래핑을 금지한다.
  if (/<template\b/i.test(html)) {
    pushViolation(violations, rel, "RF-FRAGMENT-005");
    return;
  }

  const bodyStart = html.indexOf("<body");
  if (bodyStart < 0) {
    pushViolation(violations, rel, "RF-FRAGMENT-006");
    return;
  }

  if (/<(?:audio|video)\b/i.test(html)) {
    pushViolation(violations, rel, "RF-FRAGMENT-007");
  }

  const templateHtml = html;
  const rootMatch = templateHtml.match(/<div\b[^>]*\bid=["']root["'][^>]*data-composition-id=["']([^"']+)["'][^>]*>/);
  if (!rootMatch) {
    pushViolation(violations, rel, "RF-FRAGMENT-008");
  } else {
    const sceneId = rootMatch[1];
    if (!expectedSceneIds.has(sceneId)) {
      pushViolation(violations, rel, "RF-FRAGMENT-009", { sceneId });
    }
    if (!extractTimelineKeys(templateHtml).includes(sceneId)) {
      pushViolation(violations, rel, "RF-FRAGMENT-010", { sceneId });
    }
    if (/\bclass=["'][^"']+["']/.test(rootMatch[0])) {
      pushViolation(violations, rel, "RF-FRAGMENT-011");
    }
  }

  if (/#root\s*\{[^}]*\bbackground(?:-color|-image)?\s*:/s.test(templateHtml)) {
    pushViolation(violations, rel, "RF-FRAGMENT-012");
  }

  if (!/#root\s*\{/.test(templateHtml)) {
    pushViolation(violations, rel, "RF-FRAGMENT-013");
  }
}

function checkIndex({ repoRoot, buildDir, scenes, violations }) {
  const indexPath = path.join(buildDir, "index.html");
  const rel = normalizeRelPath(path.relative(repoRoot, indexPath));
  const html = readFileSync(indexPath, "utf8");
  checkNoFetch({ rel, html, violations });
  checkPausedTimelines({ rel, html, violations });
  checkNoRemoteRefs({ rel, html, violations });
  checkInlineScripts({ rel, html, violations });

  if (!extractCompositionIds(html).includes("main") || !extractTimelineKeys(html).includes("main")) {
    pushViolation(violations, rel, "RF-INDEX-001");
  }

  for (const scene of scenes) {
    const src = `scenes/scene-${scene.sceneId}.html`;
    const hostPattern = new RegExp(
      `data-composition-id=["']${scene.sceneId}["'][\\s\\S]*data-composition-src=["']${src}["']|data-composition-src=["']${src}["'][\\s\\S]*data-composition-id=["']${scene.sceneId}["']`
    );
    if (!hostPattern.test(html)) {
      pushViolation(violations, rel, "RF-INDEX-002", {
        sceneId: scene.sceneId,
        src
      });
    }
  }
}

export function runRenderLint({ repoRoot, buildDir, scenes }) {
  const hyperframesBin = path.join(repoRoot, "node_modules", ".bin", "hyperframes");
  const hf = spawnSync(hyperframesBin, ["lint", buildDir, "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });

  const violations = [];
  const expectedSceneIds = new Set(scenes.map((scene) => scene.sceneId));
  checkIndex({ repoRoot, buildDir, scenes, violations });

  const sceneFiles = htmlFilesUnder(path.join(buildDir, "scenes"));
  const expectedFiles = new Set(scenes.map((scene) => path.join(buildDir, "scenes", `scene-${scene.sceneId}.html`)));
  for (const file of sceneFiles) {
    if (!expectedFiles.has(file)) {
      pushViolation(
        violations,
        normalizeRelPath(path.relative(repoRoot, file)),
        "RF-BUILD-001"
      );
    }
    checkSceneFile({ repoRoot, buildDir, file, expectedSceneIds, violations });
  }

  for (const file of expectedFiles) {
    if (!existsSync(file)) {
      pushViolation(
        violations,
        normalizeRelPath(path.relative(repoRoot, file)),
        "RF-BUILD-002"
      );
    }
  }

  // block/free sub-composition fragments: light determinism checks only
  // (the full scene contract does not apply to <template> fragments)
  const blocksDir = path.join(buildDir, "blocks");
  if (existsSync(blocksDir)) {
    for (const entry of readdirSync(blocksDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      for (const file of htmlFilesUnder(path.join(blocksDir, entry.name))) {
        const rel = normalizeRelPath(path.relative(repoRoot, file));
        const html = readFileSync(file, "utf8");
        checkNoFetch({ rel, html, violations });
        checkNoWallClock({ rel, html, violations });
        checkPausedTimelines({ rel, html, violations });
        checkNoRemoteRefs({ rel, html, violations });
        // authored free fragments must self-declare their contract version;
        // engine-owned blocks are versioned by BLOCK_RUNTIME_READY_VERSION instead
        if (entry.name === "free") {
          checkFragmentVersion({ rel, html, violations });
        }
      }
    }
  }

  const pass = hf.status === 0 && violations.length === 0;
  return {
    pass,
    hyperframes: {
      command: `${normalizeRelPath(path.relative(repoRoot, hyperframesBin))} lint ${normalizeRelPath(path.relative(repoRoot, buildDir))} --json`,
      exitCode: hf.status ?? (hf.signal ? 128 : 1),
      stdout: hf.stdout,
      stderr: hf.stderr
    },
    custom: {
      pass: violations.length === 0,
      violations
    }
  };
}

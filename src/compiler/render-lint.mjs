import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { normalizeRelPath } from "./utils.mjs";

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

function pushViolation(violations, file, rule, measured = {}) {
  violations.push({ file, rule, measured });
}

function checkNoFetch({ rel, html, violations }) {
  const match = html.match(/\bfetch\s*\(/);
  if (match) {
    pushViolation(violations, rel, "inline fetch() is forbidden in generated compositions", {
      line: lineForOffset(html, match.index ?? 0)
    });
  }
}

function checkPausedTimelines({ rel, html, violations }) {
  for (const call of timelineCalls(html)) {
    if (!/paused\s*:\s*true/.test(call)) {
      pushViolation(violations, rel, "gsap.timeline must be created with { paused: true }", { call });
    }
  }
}

function checkSceneFile({ repoRoot, buildDir, file, expectedSceneIds, violations }) {
  const rel = normalizeRelPath(path.relative(repoRoot, file));
  const html = readFileSync(file, "utf8");
  checkNoFetch({ rel, html, violations });
  checkPausedTimelines({ rel, html, violations });

  const templateStart = html.indexOf("<template");
  const templateEnd = html.indexOf("</template>");
  if (templateStart < 0 || templateEnd < 0) {
    pushViolation(violations, rel, "scene sub-composition must wrap live DOM in <template>");
    return;
  }

  for (const tag of ["<style", "<script"]) {
    const index = html.indexOf(tag);
    if (index >= 0 && index < templateStart) {
      pushViolation(violations, rel, `${tag} must live inside the scene <template>`, {
        line: lineForOffset(html, index)
      });
    }
  }

  if (/<(?:audio|video)\b/i.test(html)) {
    pushViolation(violations, rel, "scene sub-compositions must not contain <audio> or <video>");
  }

  const templateHtml = html.slice(templateStart, templateEnd);
  const rootMatch = templateHtml.match(/<div\b[^>]*\bid=["']root["'][^>]*data-composition-id=["']([^"']+)["'][^>]*>/);
  if (!rootMatch) {
    pushViolation(violations, rel, "scene template root must be #root with data-composition-id");
  } else {
    const sceneId = rootMatch[1];
    if (!expectedSceneIds.has(sceneId)) {
      pushViolation(violations, rel, "scene file composition id is not mounted by the manifest scene set", { sceneId });
    }
    if (!extractTimelineKeys(templateHtml).includes(sceneId)) {
      pushViolation(violations, rel, "scene timeline key must match root data-composition-id", { sceneId });
    }
    if (/\bclass=["'][^"']+["']/.test(rootMatch[0])) {
      pushViolation(violations, rel, "scene #root must not be styled through a root class");
    }
  }

  if (/#root\s*\{[^}]*\bbackground(?:-color|-image)?\s*:/s.test(templateHtml)) {
    pushViolation(violations, rel, "fullscreen background must live on a full-bleed child, not #root");
  }

  if (!/#root\s*\{/.test(templateHtml)) {
    pushViolation(violations, rel, "scene CSS must style the sub-composition root with #root");
  }
}

function checkIndex({ repoRoot, buildDir, scenes, violations }) {
  const indexPath = path.join(buildDir, "index.html");
  const rel = normalizeRelPath(path.relative(repoRoot, indexPath));
  const html = readFileSync(indexPath, "utf8");
  checkNoFetch({ rel, html, violations });
  checkPausedTimelines({ rel, html, violations });

  if (!extractCompositionIds(html).includes("main") || !extractTimelineKeys(html).includes("main")) {
    pushViolation(violations, rel, "index root composition id and timeline key must be main");
  }

  for (const scene of scenes) {
    const src = `scenes/scene-${scene.sceneId}.html`;
    const hostPattern = new RegExp(
      `data-composition-id=["']${scene.sceneId}["'][\\s\\S]*data-composition-src=["']${src}["']|data-composition-src=["']${src}["'][\\s\\S]*data-composition-id=["']${scene.sceneId}["']`
    );
    if (!hostPattern.test(html)) {
      pushViolation(violations, rel, "every compiled scene must be mounted in index.html", {
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
        "orphan scene file is forbidden; every scene HTML must be mounted"
      );
    }
    checkSceneFile({ repoRoot, buildDir, file, expectedSceneIds, violations });
  }

  for (const file of expectedFiles) {
    if (!existsSync(file)) {
      pushViolation(
        violations,
        normalizeRelPath(path.relative(repoRoot, file)),
        "expected compiled scene file is missing"
      );
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

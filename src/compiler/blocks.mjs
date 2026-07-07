import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { jsonAttr, normalizeRelPath } from "./utils.mjs";

const HEADLINE_LAYOUT = "headline_only";
export const BLOCK_RUNTIME_READY_VERSION = "P2-08.block-runtime-ready.v1";

export function blockVariablesForScene({ scene, tokens }) {
  const mood = tokens.moods?.[scene.mood] ?? {};
  return {
    title: scene.headline,
    items: scene.items ?? [],
    values: scene.values ?? [],
    unit: scene.unit ?? "",
    accent: mood.accent ?? tokens.colors?.accent ?? "#2563EB",
    mood: scene.mood,
    emphasis: scene.emphasis,
    reveal: scene.reveal,
    visualKind: scene.visual_kind,
    source: scene.source ?? ""
  };
}

function extractCompositionId(html) {
  return html.match(/data-composition-id=["']([^"']+)["']/)?.[1] ?? null;
}

function runtimeReadyScript() {
  return `    <script data-rf-runtime-ready="${BLOCK_RUNTIME_READY_VERSION}">
      (function () {
        const target = typeof window !== "undefined" ? window : globalThis;
        target.__timelines = target.__timelines || {};
        globalThis.__timelines = target.__timelines;
        if (typeof target.__hfForceTimelineRebind === "function") {
          target.__hfForceTimelineRebind();
        }
        if (typeof target.__hfFlushSync === "function") {
          target.__hfFlushSync();
        }
        target.__playerReady = true;
        target.__renderReady = true;
      })();
    </script>`;
}

export function injectBlockRuntimeReady(html) {
  if (html.includes(`data-rf-runtime-ready="${BLOCK_RUNTIME_READY_VERSION}"`)) return html;
  const script = `\n${runtimeReadyScript()}\n`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${script}  </body>`);
  if (/<\/html>/i.test(html)) return html.replace(/<\/html>/i, `${script}</html>`);
  return `${html}${script}`;
}

export function resolveBlock({ repoRoot, buildDir, layout }) {
  if (layout === HEADLINE_LAYOUT) {
    return { kind: "native", layout, warnings: [] };
  }

  const sourcePath = path.join(repoRoot, "blocks", layout, "block.html");
  if (!existsSync(sourcePath)) {
    return {
      kind: "fallback",
      layout,
      warnings: [
        {
          code: "block-missing",
          message: `blocks/${layout}/block.html not found; compiled headline_only fallback`
        }
      ]
    };
  }

  const html = readFileSync(sourcePath, "utf8");
  const compositionId = extractCompositionId(html);
  if (!compositionId) {
    return {
      kind: "fallback",
      layout,
      warnings: [
        {
          code: "block-invalid",
          message: `blocks/${layout}/block.html has no data-composition-id; compiled headline_only fallback`
        }
      ]
    };
  }

  const targetRel = normalizeRelPath(path.join("blocks", layout, "block.html"));
  const targetPath = path.join(buildDir, targetRel);
  mkdirSync(path.dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, injectBlockRuntimeReady(html));

  return {
    kind: "block",
    layout,
    sourcePath,
    targetRel,
    compositionId,
    warnings: []
  };
}

export function blockHostHtml({ scene, timing, block, variables }) {
  if (block.kind !== "block") return "";

  return `        <div
          id="${scene.sceneId}-block-host"
          class="clip block-host"
          data-composition-id="${block.compositionId}"
          data-composition-src="${block.targetRel}"
          data-variable-values='${jsonAttr(variables)}'
          data-start="0"
          data-duration="${timing.durationSec}"
          data-track-index="3"
          data-width="1920"
          data-height="1080"
        ></div>`;
}

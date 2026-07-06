import { existsSync, mkdirSync, readFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { jsonAttr, normalizeRelPath } from "./utils.mjs";

const HEADLINE_LAYOUT = "headline_only";

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
  copyFileSync(sourcePath, targetPath);

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
          data-composition-src="../${block.targetRel}"
          data-variable-values='${jsonAttr(variables)}'
          data-start="0"
          data-duration="${timing.durationSec}"
          data-track-index="3"
          data-width="1920"
          data-height="1080"
        ></div>`;
}

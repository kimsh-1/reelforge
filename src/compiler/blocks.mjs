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

function templateBounds(html) {
  const openMatch = html.match(/<template\b[^>]*>/i);
  if (!openMatch || openMatch.index === undefined) return null;
  const openStart = openMatch.index;
  const openEnd = openStart + openMatch[0].length;
  const closeMatch = html.slice(openEnd).match(/<\/template>/i);
  if (!closeMatch || closeMatch.index === undefined) return null;
  const closeStart = openEnd + closeMatch.index;
  const closeEnd = closeStart + closeMatch[0].length;
  return { openStart, openEnd, closeStart, closeEnd };
}

function rootBounds(templateContent) {
  const openMatch = templateContent.match(/<([A-Za-z][\w:-]*)\b(?=[^>]*\bdata-composition-id\s*=)[^>]*>/i);
  if (!openMatch || openMatch.index === undefined) return null;
  const tagName = openMatch[1];
  const openStart = openMatch.index;
  const openEnd = openStart + openMatch[0].length;
  const tagPattern = new RegExp(`</?${tagName}\\b[^>]*>`, "gi");
  tagPattern.lastIndex = openStart;
  let depth = 0;
  let match;
  while ((match = tagPattern.exec(templateContent))) {
    const tag = match[0];
    const isClose = /^<\//.test(tag);
    const isSelfClosing = /\/>$/.test(tag);
    if (isClose) {
      depth -= 1;
      if (depth === 0) {
        return {
          tagName,
          openStart,
          openEnd,
          closeStart: match.index,
          closeEnd: match.index + tag.length
        };
      }
    } else if (!isSelfClosing) {
      depth += 1;
    }
  }
  return null;
}

function splitTransportAssets(fragment) {
  const assets = [];
  let clean = fragment;
  while (true) {
    const match = clean.match(/^\s*<(style|script)\b[^>]*>[\s\S]*?<\/\1>\s*/i);
    if (!match) break;
    assets.push(match[0].trim());
    clean = clean.slice(match[0].length);
  }
  return { clean, assets };
}

function rewriteTemplateRoot(html, rewrite) {
  const template = templateBounds(html);
  if (!template) return null;
  const templateContent = html.slice(template.openEnd, template.closeStart);
  const root = rootBounds(templateContent);
  if (!root) return null;
  const nextContent = rewrite({ templateContent, root });
  if (typeof nextContent !== "string") return null;
  return `${html.slice(0, template.openEnd)}${nextContent}${html.slice(template.closeStart)}`;
}

export function inlineBlockTransportAssets(html) {
  return (
    rewriteTemplateRoot(html, ({ templateContent, root }) => {
      const before = splitTransportAssets(templateContent.slice(0, root.openStart));
      const after = splitTransportAssets(templateContent.slice(root.closeEnd));
      if (before.assets.length === 0 && after.assets.length === 0) return templateContent;

      const rootOpen = templateContent.slice(root.openStart, root.openEnd);
      const rootInner = templateContent.slice(root.openEnd, root.closeStart);
      const rootClose = templateContent.slice(root.closeStart, root.closeEnd);
      const beforeAssets = before.assets.length > 0 ? `\n${before.assets.join("\n")}\n` : "";
      const afterAssets = after.assets.length > 0 ? `\n${after.assets.join("\n")}\n` : "";
      return `${before.clean}${rootOpen}${beforeAssets}${rootInner}${afterAssets}${rootClose}${after.clean}`;
    }) ?? html
  );
}

function injectIntoTemplateRoot(html, snippet) {
  return rewriteTemplateRoot(html, ({ templateContent, root }) => {
    return `${templateContent.slice(0, root.closeStart)}\n${snippet}\n${templateContent.slice(root.closeStart)}`;
  });
}

export function injectBlockRuntimeReady(html) {
  if (html.includes(`data-rf-runtime-ready="${BLOCK_RUNTIME_READY_VERSION}"`)) return html;
  const script = `\n${runtimeReadyScript()}\n`;
  const inTemplate = injectIntoTemplateRoot(html, script);
  if (inTemplate) return inTemplate;
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
  writeFileSync(targetPath, injectBlockRuntimeReady(inlineBlockTransportAssets(html)));

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

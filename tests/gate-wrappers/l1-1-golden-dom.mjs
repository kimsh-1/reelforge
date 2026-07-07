#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runRenderLint } from "../../src/compiler/render-lint.mjs";
import {
  compileFixture,
  evidenceForPaths,
  listFilesRecursive,
  main,
  normalizeRelPath,
  repoRel,
  repoRoot,
  resetDir
} from "./helpers.mjs";

const self = repoRel(fileURLToPath(import.meta.url));
const workRoot = path.join(repoRoot, "tmp", "gate-work", "l1-1-golden-dom");
const snapshotRoot = path.join(repoRoot, "fixtures", "golden-dom");
const fixtures = ["minimal-3scene", "edit-scenario", "full-8types", "stress-edge"];
const voidTags = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);

function attrsFromTag(rawAttrs) {
  const attrs = {};
  for (const match of rawAttrs.matchAll(/([A-Za-z0-9:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    const name = match[1];
    if (name === "style") continue;
    attrs[name] = match[2] ?? match[3] ?? match[4] ?? true;
  }
  return Object.fromEntries(Object.entries(attrs).sort(([a], [b]) => a.localeCompare(b)));
}

function canonicalDom(html) {
  const root = { tag: "#document", attrs: {}, children: [] };
  const stack = [root];
  const tokenRe = /<!doctype[^>]*>|<!--[\s\S]*?-->|<\/?([A-Za-z][A-Za-z0-9:-]*)([^>]*)>/gi;
  let match;

  while ((match = tokenRe.exec(html))) {
    const token = match[0];
    if (token.startsWith("<!") || token.startsWith("<!--")) continue;

    const tag = match[1].toLowerCase();
    if (token.startsWith("</")) {
      while (stack.length > 1) {
        const closed = stack.pop();
        if (closed.tag === tag) break;
      }
      continue;
    }

    const rawAttrs = match[2] ?? "";
    const node = { tag, attrs: attrsFromTag(rawAttrs), children: [] };
    stack.at(-1).children.push(node);
    if (!voidTags.has(tag) && !rawAttrs.trimEnd().endsWith("/")) {
      stack.push(node);
    }
  }

  return root;
}

function snapshotRelFor(caseName, htmlRel) {
  const parsed = path.parse(htmlRel);
  return normalizeRelPath(path.join("fixtures", "golden-dom", caseName, parsed.dir, `${parsed.name}.dom.json`));
}

function diffDom(expected, actual, pointer = "") {
  const diffs = [];
  if (expected.tag !== actual.tag) {
    diffs.push({ path: pointer || "/", expected: expected.tag, actual: actual.tag, kind: "tag" });
    return diffs;
  }
  const expectedAttrs = JSON.stringify(expected.attrs);
  const actualAttrs = JSON.stringify(actual.attrs);
  if (expectedAttrs !== actualAttrs) {
    diffs.push({ path: pointer || "/", expected: expected.attrs, actual: actual.attrs, kind: "attrs" });
  }
  const expectedCount = expected.children?.length ?? 0;
  const actualCount = actual.children?.length ?? 0;
  if (expectedCount !== actualCount) {
    diffs.push({ path: pointer || "/", expected: expectedCount, actual: actualCount, kind: "child-count" });
  }
  const count = Math.min(expectedCount, actualCount);
  for (let index = 0; index < count; index += 1) {
    diffs.push(...diffDom(expected.children[index], actual.children[index], `${pointer}/${expected.children[index].tag}[${index}]`));
  }
  return diffs;
}

function htmlFiles(buildDir) {
  return listFilesRecursive(buildDir)
    .filter((file) => file.endsWith(".html"))
    .filter((file) => path.basename(file) === "index.html" || normalizeRelPath(path.relative(buildDir, file)).startsWith("scenes/"))
    .sort((a, b) => repoRel(a).localeCompare(repoRel(b)));
}

function runtimeScriptErrorCheck() {
  const compiled = compileFixture("minimal-3scene", path.join(workRoot, "render-lint-runtime"));
  if (compiled.compile.exitCode !== 0 || compiled.result?.pass !== true) {
    return {
      check: {
        id: "render-lint-runtime-script-error",
        pass: false,
        measured: {
          compileExitCode: compiled.compile.exitCode,
          stderr: compiled.compile.stderr.trim(),
          stdout: compiled.compile.stdout.slice(0, 4000)
        }
      },
      evidencePaths: []
    };
  }

  const scenePath = path.join(compiled.buildDir, "scenes", "scene-s01.html");
  const injected = readFileSync(scenePath, "utf8").replace(
    "</body>",
    '<script>throw new Error("p2-review-render-lint-bypass")</script></body>'
  );
  writeFileSync(scenePath, injected);
  const lint = runRenderLint({ repoRoot, buildDir: compiled.buildDir, scenes: compiled.result.scenes });
  const violations = lint.custom?.violations ?? [];
  const caught = violations.some((violation) => {
    return (
      violation.rule === "inline scene script must parse and pass the compiler VM smoke check" &&
      String(violation.measured?.error ?? "").includes("p2-review-render-lint-bypass")
    );
  });
  return {
    check: {
      id: "render-lint-runtime-script-error",
      pass: lint.pass === false && caught,
      measured: {
        lintPass: lint.pass,
        hyperframesExitCode: lint.hyperframes?.exitCode,
        violations,
        caught
      }
    },
    evidencePaths: [repoRel(scenePath)]
  };
}

async function runGate() {
  resetDir(workRoot);
  const checks = [];
  const createdSnapshots = [];
  const comparedSnapshots = [];
  const evidencePaths = [];

  for (const fixtureName of fixtures) {
    const compiled = compileFixture(fixtureName, workRoot);
    checks.push({
      id: `compile:${fixtureName}`,
      pass: compiled.compile.exitCode === 0 && compiled.result?.pass === true,
      measured: {
        command: compiled.compile.command,
        exitCode: compiled.compile.exitCode,
        buildDir: compiled.result?.buildDir ?? repoRel(compiled.buildDir),
        scenes: compiled.result?.scenes?.length ?? null,
        stderr: compiled.compile.stderr.trim()
      }
    });

    if (compiled.compile.exitCode !== 0 || compiled.result?.pass !== true) continue;

    for (const htmlFile of htmlFiles(compiled.buildDir)) {
      const htmlRel = normalizeRelPath(path.relative(compiled.buildDir, htmlFile));
      const snapshotRel = snapshotRelFor(fixtureName, htmlRel);
      const snapshotAbs = path.join(repoRoot, snapshotRel);
      const actual = canonicalDom(readFileSync(htmlFile, "utf8"));
      mkdirSync(path.dirname(snapshotAbs), { recursive: true });

      if (!existsSync(snapshotAbs)) {
        writeFileSync(snapshotAbs, `${JSON.stringify(actual, null, 2)}\n`);
        createdSnapshots.push(snapshotRel);
      } else {
        const expected = JSON.parse(readFileSync(snapshotAbs, "utf8"));
        const diffs = diffDom(expected, actual);
        comparedSnapshots.push({ fixtureName, htmlRel, snapshotRel, diffs });
      }
      evidencePaths.push(snapshotRel);
    }
  }

  const mismatches = comparedSnapshots.filter((entry) => entry.diffs.length > 0);
  checks.push({
    id: "golden-dom-snapshots",
    pass: mismatches.length === 0,
    measured: {
      fixtures,
      compared: comparedSnapshots.length,
      created: createdSnapshots,
      createdCount: createdSnapshots.length,
      creationLog:
        createdSnapshots.length > 0
          ? `created ${createdSnapshots.length} initial golden DOM snapshot(s)`
          : "all golden DOM snapshots already existed",
      mismatches: mismatches.map((entry) => ({
        fixtureName: entry.fixtureName,
        htmlRel: entry.htmlRel,
        snapshotRel: entry.snapshotRel,
        diffs: entry.diffs.slice(0, 20)
      }))
    }
  });

  const runtimeCheck = runtimeScriptErrorCheck();
  checks.push(runtimeCheck.check);
  evidencePaths.push(...runtimeCheck.evidencePaths);

  const snapshotInputs = existsSync(snapshotRoot)
    ? listFilesRecursive(snapshotRoot).map(repoRel).filter((file) => file.endsWith(".json"))
    : [];

  return {
    checks,
    inputSet: [
      self,
      "src/compiler/compiler.mjs",
      "src/compiler/blocks.mjs",
      "src/compiler/subtitles.mjs",
      "src/compiler/timing.mjs",
      "src/compiler/transitions.mjs",
      "src/compiler/render-lint.mjs",
      "fixtures/presets/light.json",
      "blocks",
      ...fixtures.flatMap((fixtureName) => [
        `fixtures/golden-specs/${fixtureName}/scene_specs.json`,
        `fixtures/golden-specs/${fixtureName}/audio_meta.json`
      ]),
      ...snapshotInputs
    ].sort((a, b) => a.localeCompare(b)),
    evidence: evidenceForPaths(evidencePaths)
  };
}

main(runGate);

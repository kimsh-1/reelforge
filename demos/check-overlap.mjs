#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const specs = [
  "d1-usage/scene_specs.json",
  "d2-engine/scene_specs.json",
  "d3-intro/scene_specs.json"
].map((rel) => path.join(here, rel));

function normalizeSentence(value) {
  return String(value)
    .replace(/\[DRAFT\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function headlineFromScene(scene) {
  const headline = normalizeSentence(scene.headline);
  return headline ? [headline] : [];
}

const byFile = new Map();
const owners = new Map();

for (const specPath of specs) {
  const data = JSON.parse(readFileSync(specPath, "utf8"));
  const rel = path.relative(process.cwd(), specPath).split(path.sep).join("/");
  const headlines = [];
  for (const scene of data.scenes ?? []) {
    headlines.push(...headlineFromScene(scene));
  }
  byFile.set(rel, headlines);
  for (const headline of headlines) {
    if (!owners.has(headline)) owners.set(headline, new Set());
    owners.get(headline).add(rel);
  }
}

const overlaps = [...owners.entries()]
  .filter(([, files]) => files.size > 1)
  .map(([headline, files]) => ({
    headline,
    files: [...files].sort((a, b) => a.localeCompare(b))
  }));

const totalHeadlines = [...byFile.values()].reduce((sum, headlines) => sum + headlines.length, 0);
const counts = Object.fromEntries([...byFile.entries()].map(([file, headlines]) => [file, headlines.length]));

if (overlaps.length > 0) {
  console.log("headline-overlap: FAIL");
  console.log(JSON.stringify({ files: specs.length, totalHeadlines, counts, overlaps }, null, 2));
  process.exit(1);
}

console.log("headline-overlap: PASS");
console.log(JSON.stringify({ files: specs.length, totalHeadlines, counts, duplicateHeadlines: 0 }, null, 2));

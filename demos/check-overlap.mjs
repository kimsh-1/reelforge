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

function sentencesFromNarration(text) {
  const compact = normalizeSentence(text);
  if (!compact) return [];
  return compact
    .split(/(?<=[.!?。！？])\s+/u)
    .map(normalizeSentence)
    .filter(Boolean);
}

const byFile = new Map();
const owners = new Map();

for (const specPath of specs) {
  const data = JSON.parse(readFileSync(specPath, "utf8"));
  const rel = path.relative(process.cwd(), specPath).split(path.sep).join("/");
  const sentences = [];
  for (const scene of data.scenes ?? []) {
    sentences.push(...sentencesFromNarration(scene.narration_tts ?? scene.narration));
  }
  byFile.set(rel, sentences);
  for (const sentence of sentences) {
    if (!owners.has(sentence)) owners.set(sentence, new Set());
    owners.get(sentence).add(rel);
  }
}

const overlaps = [...owners.entries()]
  .filter(([, files]) => files.size > 1)
  .map(([sentence, files]) => ({
    sentence,
    files: [...files].sort((a, b) => a.localeCompare(b))
  }));

const totalSentences = [...byFile.values()].reduce((sum, sentences) => sum + sentences.length, 0);
const counts = Object.fromEntries([...byFile.entries()].map(([file, sentences]) => [file, sentences.length]));

if (overlaps.length > 0) {
  console.log("overlap: FAIL");
  console.log(JSON.stringify({ files: specs.length, totalSentences, counts, overlaps }, null, 2));
  process.exit(1);
}

console.log("overlap: PASS");
console.log(JSON.stringify({ files: specs.length, totalSentences, counts, duplicateSentences: 0 }, null, 2));

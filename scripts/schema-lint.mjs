#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const targets = ["package.json", "poc/fixtures", "poc/reports"];
const errors = [];

function listFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

for (const target of targets) {
  const abs = path.join(root, target);
  if (!existsSync(abs)) continue;
  const files = statSync(abs).isDirectory() ? listFiles(abs) : [abs];
  for (const file of files.filter((item) => item.endsWith(".json"))) {
    try {
      JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      errors.push(`${path.relative(root, file)}: ${error.message}`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("schema-lint stub: JSON parse checks passed");
}

#!/usr/bin/env node
import { readFileSync } from "node:fs";

const files = ["README.md", "README-en.md", "README-ja.md"];

function sections(file) {
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((line) => /^## \[[a-z0-9-]+\]/.test(line))
    .map((line) => line.match(/^## \[([a-z0-9-]+)\]/)?.[1]);
}

const baseline = sections(files[0]);
const failures = [];
for (const file of files.slice(1)) {
  const current = sections(file);
  if (JSON.stringify(current) !== JSON.stringify(baseline)) {
    failures.push(`${file}: ${current.join(",")} != ${baseline.join(",")}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`README section keys synced: ${baseline.join(", ")}`);
}

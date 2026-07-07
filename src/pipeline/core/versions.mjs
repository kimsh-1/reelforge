import { existsSync } from "node:fs";
import path from "node:path";
import { normalizeRelPath, readJsonFile } from "./io.mjs";

export function resolveSelectedResource({ projectDir, resourceType, fallbackPath = null }) {
  const versionsPath = path.join(projectDir, "versions.json");
  if (!existsSync(versionsPath)) {
    return fallbackPath ? { path: fallbackPath, source: "fallback", gen: null } : null;
  }

  const versions = readJsonFile(versionsPath);
  const history = versions?.resources?.[resourceType];
  const selected = history?.selected;
  const entry = Array.isArray(history?.entries)
    ? history.entries.find((candidate) => candidate?.gen === selected)
    : null;

  if (entry?.path) {
    return {
      path: normalizeRelPath(entry.path),
      source: "versions",
      gen: selected
    };
  }

  return fallbackPath ? { path: fallbackPath, source: "fallback", gen: null } : null;
}

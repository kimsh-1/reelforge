import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync
} from "node:fs";
import path from "node:path";

export function normalizeRelPath(value) {
  return value.split(path.sep).join("/");
}

export function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

export function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sha256File(filePath) {
  return sha256Bytes(readFileSync(filePath));
}

export function sha256Json(value) {
  return sha256Bytes(Buffer.from(JSON.stringify(value), "utf8"));
}

export function listFilesRecursive(dir) {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFilesRecursive(next));
    else if (entry.isFile()) files.push(next);
  }
  return files;
}

export function writeJsonViaVf({ repoRoot, projectDir, filePath, schemaName, data }) {
  const result = spawnSync(
    process.execPath,
    ["bin/vf", "write", filePath, "--project-root", projectDir, "--schema", schemaName],
    {
      cwd: repoRoot,
      input: JSON.stringify(data),
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024
    }
  );
  if (result.status !== 0) {
    throw new Error(`vf write ${schemaName} failed for ${filePath}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim());
  }
  return JSON.parse(result.stdout);
}

export function fileStatSummary(filePath) {
  if (!existsSync(filePath)) return { exists: false, bytes: 0, mtimeMs: 0 };
  const stats = statSync(filePath);
  return {
    exists: true,
    bytes: stats.isFile() ? stats.size : 0,
    mtimeMs: stats.mtimeMs,
    isFile: stats.isFile(),
    isDirectory: stats.isDirectory()
  };
}

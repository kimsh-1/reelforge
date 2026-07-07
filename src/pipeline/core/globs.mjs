import { existsSync, statSync } from "node:fs";
import path from "node:path";
import {
  listFilesRecursive,
  normalizeRelPath,
  sha256File,
  sha256Json
} from "./io.mjs";

function hasGlob(value) {
  return value.includes("*");
}

function globToRegExp(glob) {
  let source = "^";
  for (let index = 0; index < glob.length; index += 1) {
    const ch = glob[index];
    if (ch === "*") {
      if (glob[index + 1] === "*") {
        source += ".*";
        index += 1;
      } else {
        source += "[^/]*";
      }
    } else if ("\\^$+?.()|{}[]".includes(ch)) {
      source += `\\${ch}`;
    } else {
      source += ch;
    }
  }
  source += "$";
  return new RegExp(source);
}

function splitPatternRoot({ repoRoot, projectDir, pattern }) {
  if (pattern.startsWith("repo:")) {
    return {
      root: repoRoot,
      pattern: normalizeRelPath(pattern.slice("repo:".length)),
      displayPrefix: "repo:"
    };
  }
  return {
    root: projectDir,
    pattern: normalizeRelPath(pattern),
    displayPrefix: ""
  };
}

function staticBaseDir(root, pattern) {
  const segments = pattern.split("/");
  const globIndex = segments.findIndex((segment) => hasGlob(segment));
  const prefix = globIndex < 0 ? segments.slice(0, -1) : segments.slice(0, globIndex);
  return path.join(root, ...prefix);
}

function expandOne({ repoRoot, projectDir, pattern }) {
  const resolved = splitPatternRoot({ repoRoot, projectDir, pattern });
  const absoluteLiteral = path.join(resolved.root, resolved.pattern);
  if (!hasGlob(resolved.pattern)) {
    if (!existsSync(absoluteLiteral)) {
      return { pattern, files: [], missingLiteral: true };
    }
    const stats = statSync(absoluteLiteral);
    const files = stats.isDirectory() ? listFilesRecursive(absoluteLiteral) : [absoluteLiteral];
    return { pattern, files, missingLiteral: false, root: resolved.root, displayPrefix: resolved.displayPrefix };
  }

  const baseDir = staticBaseDir(resolved.root, resolved.pattern);
  if (!existsSync(baseDir)) return { pattern, files: [], missingLiteral: false, root: resolved.root, displayPrefix: resolved.displayPrefix };

  const matcher = globToRegExp(resolved.pattern);
  const files = listFilesRecursive(baseDir).filter((file) =>
    matcher.test(normalizeRelPath(path.relative(resolved.root, file)))
  );
  return { pattern, files, missingLiteral: false, root: resolved.root, displayPrefix: resolved.displayPrefix };
}

export function expandPatterns({ repoRoot, projectDir, patterns }) {
  const entries = [];
  for (const pattern of patterns) {
    const expanded = expandOne({ repoRoot, projectDir, pattern });
    for (const file of expanded.files) {
      const rel = normalizeRelPath(path.relative(expanded.root, file));
      entries.push({
        pattern,
        file,
        displayPath: `${expanded.displayPrefix}${rel}`
      });
    }
    if (expanded.missingLiteral) {
      entries.push({
        pattern,
        file: null,
        displayPath: pattern,
        missing: true
      });
    }
  }

  const deduped = new Map();
  for (const entry of entries) {
    const key = entry.file ? path.resolve(entry.file) : `missing:${entry.displayPath}`;
    if (!deduped.has(key)) deduped.set(key, entry);
  }
  return [...deduped.values()].sort((a, b) => a.displayPath.localeCompare(b.displayPath));
}

export function hashPatterns({ repoRoot, projectDir, patterns }) {
  const files = expandPatterns({ repoRoot, projectDir, patterns });
  const entries = files.map((entry) => {
    if (!entry.file) {
      return { path: entry.displayPath, type: "missing", bytes: 0, sha256: null };
    }
    const stats = statSync(entry.file);
    return {
      path: entry.displayPath,
      type: "file",
      bytes: stats.size,
      sha256: sha256File(entry.file)
    };
  });
  return {
    hash: sha256Json(entries),
    entries
  };
}

export function outputsExist({ repoRoot, projectDir, patterns }) {
  const missing = [];
  for (const pattern of patterns) {
    const matches = expandPatterns({ repoRoot, projectDir, patterns: [pattern] }).filter((entry) => entry.file);
    if (matches.length === 0) {
      missing.push(pattern);
      continue;
    }
    const empty = matches.filter((entry) => statSync(entry.file).isFile() && statSync(entry.file).size === 0);
    if (empty.length > 0) missing.push(...empty.map((entry) => entry.displayPath));
  }
  return {
    pass: missing.length === 0,
    missing
  };
}

export function maxMtimeMs({ repoRoot, projectDir, patterns }) {
  const files = expandPatterns({ repoRoot, projectDir, patterns }).filter((entry) => entry.file);
  return files.reduce((max, entry) => Math.max(max, statSync(entry.file).mtimeMs), 0);
}

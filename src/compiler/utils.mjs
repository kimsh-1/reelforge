import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

export const DEFAULT_WIDTH = 1920;
export const DEFAULT_HEIGHT = 1080;
export const DEFAULT_FPS = 30;
export const GSAP_CDN = "https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js";
export const GENERATED_COMMENT = "GENERATED — read-only";

export function normalizeRelPath(value) {
  return value.split(path.sep).join("/");
}

export function isPathInsideRoot(candidatePath, rootPath) {
  const candidate = path.resolve(candidatePath);
  const root = path.resolve(rootPath);
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

export function isPathInsideAnyRoot(candidatePath, rootPaths) {
  return rootPaths.some((rootPath) => isPathInsideRoot(candidatePath, rootPath));
}

export function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function sha256Text(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

export function resetDir(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

export function atomicReplaceDir(tmpDir, finalDir) {
  const backupDir = `${finalDir}.previous-${process.pid}-${Date.now()}`;
  if (existsSync(finalDir)) renameSync(finalDir, backupDir);
  renameSync(tmpDir, finalDir);
  rmSync(backupDir, { recursive: true, force: true });
}

export function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function htmlAttr(value) {
  return htmlEscape(value);
}

export function jsonAttr(value) {
  return htmlAttr(JSON.stringify(value));
}

export function cssString(value) {
  return JSON.stringify(String(value ?? ""));
}

export function cssUrl(value) {
  return `url(${JSON.stringify(String(value ?? ""))})`;
}

export function framesFromDuration(seconds, fps) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`duration must be a non-negative finite number: ${seconds}`);
  }
  const { numerator, denominator } = fpsRatio(fps);
  return Math.ceil((value * numerator) / denominator - 1e-12);
}

export function framesFromTransition(seconds, fps) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`transition duration must be a non-negative finite number: ${seconds}`);
  }
  if (value === 0) return 0;
  const { numerator, denominator } = fpsRatio(fps);
  return Math.ceil((value * numerator) / denominator - 1e-12);
}

export function secondsFromFrames(frames, fps) {
  if (!Number.isInteger(frames) || frames < 0) {
    throw new Error(`frames must be a non-negative integer: ${frames}`);
  }
  if (frames === 0) return 0;
  const { numerator, denominator } = fpsRatio(fps);
  return Math.max(0, (frames * denominator) / numerator - 1e-9);
}

export function quantizeStartSec(seconds, fps) {
  const value = Math.max(0, Number(seconds) || 0);
  const { numerator, denominator } = fpsRatio(fps);
  return secondsFromFrames(Math.floor((value * numerator) / denominator + 1e-12), fps);
}

export function quantizeEndSec(seconds, fps, maxFrames) {
  const value = Math.max(0, Number(seconds) || 0);
  const { numerator, denominator } = fpsRatio(fps);
  return secondsFromFrames(Math.min(maxFrames, Math.ceil((value * numerator) / denominator - 1e-12)), fps);
}

export function fpsRatio(fps) {
  const value = Number(fps);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`fps must be a positive finite number: ${fps}`);
  }

  // Treat user-facing 29.97 as the NTSC rational frame rate.
  if (Math.abs(value - 29.97) < 0.001 || Math.abs(value - 30000 / 1001) < 1e-9) {
    return { numerator: 30000, denominator: 1001 };
  }

  return { numerator: value, denominator: 1 };
}

export function requireRelativeAsset(projectDir, assetPath, label) {
  if (typeof assetPath !== "string" || !assetPath.startsWith("./assets/")) {
    throw new Error(`${label} must be a relative ./assets/ path: ${assetPath}`);
  }
  if (assetPath.includes("\\") || assetPath.split("/").includes("..") || assetPath.split("/").includes("")) {
    throw new Error(`${label} must not contain backslashes, empty segments, or parent traversal: ${assetPath}`);
  }
  const absolutePath = path.resolve(projectDir, assetPath);
  const assetRoot = path.resolve(projectDir, "assets");
  if (absolutePath !== assetRoot && !absolutePath.startsWith(`${assetRoot}${path.sep}`)) {
    throw new Error(`${label} must stay inside ./assets/: ${assetPath}`);
  }
  if (!existsSync(absolutePath) || !statSync(absolutePath).isFile() || statSync(absolutePath).size === 0) {
    throw new Error(`${label} asset is missing or empty: ${assetPath}`);
  }
  return absolutePath;
}

export function copyAssetToBuild({ sourcePath, buildDir, targetRelPath }) {
  const targetPath = path.join(buildDir, targetRelPath);
  ensureDir(path.dirname(targetPath));
  copyFileSync(sourcePath, targetPath);
  return normalizeRelPath(targetRelPath);
}

export function writeFileEnsured(filePath, text) {
  ensureDir(path.dirname(filePath));
  writeFileSync(filePath, text);
}

export function writeSilentWav(filePath, durationSec, sampleRate = 24_000) {
  const seconds = Math.max(0.05, Number(durationSec) || 0.05);
  const samples = Math.max(1, Math.ceil(seconds * sampleRate));
  const dataBytes = samples * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataBytes, 40);
  writeFileEnsured(filePath, buffer);
}

export function colorLuminance(hex) {
  const raw = String(hex || "#000000").replace("#", "");
  const value = raw.length === 3 ? raw.split("").map((ch) => ch + ch).join("") : raw.slice(0, 6);
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

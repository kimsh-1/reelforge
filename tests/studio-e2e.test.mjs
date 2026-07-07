#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { startStudioServer } from "../src/studio/server/index.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "reelforge-studio-e2e-"));
const projectDir = path.join(tmpRoot, "minimal-3scene");
const reportDir = path.join(repoRoot, "reports", "studio-e2e");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function audioSourceHash(sceneId) {
  const audioMeta = readJson(path.join(projectDir, "audio_meta.json"));
  return audioMeta.scenes.find((scene) => scene.sceneId === sceneId)?.sourceHash ?? null;
}

function browserExecutablePath() {
  const hyperframes = spawnSync(path.join(repoRoot, "node_modules", ".bin", "hyperframes"), ["browser", "path"], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 60000
  });
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    hyperframes.status === 0 ? hyperframes.stdout.trim() : null,
    path.join(os.homedir(), ".cache", "ms-playwright", "chromium_headless_shell-1228", "chrome-headless-shell-linux64", "chrome-headless-shell"),
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome"
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("no Chromium executable found for studio E2E");
  return found;
}

async function setField(page, selector, value) {
  await page.focus(selector);
  await page.keyboard.down("Control");
  await page.keyboard.press("A");
  await page.keyboard.up("Control");
  await page.keyboard.type(value);
}

async function waitForFilePredicate(predicate, timeoutMs = 30000) {
  const started = Date.now();
  for (;;) {
    if (predicate()) return;
    if (Date.now() - started > timeoutMs) throw new Error("timed out waiting for file predicate");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

async function waitForJob(baseUrl, jobId, timeoutMs = 120000) {
  const started = Date.now();
  for (;;) {
    const response = await fetch(new URL(`/api/jobs/${jobId}`, baseUrl));
    assert.equal(response.status, 200);
    const payload = await response.json();
    if (["succeeded", "failed"].includes(payload.job.status)) return payload.job;
    if (Date.now() - started > timeoutMs) throw new Error(`job timed out: ${jobId}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function clickButtonByText(page, text) {
  const clicked = await page.evaluate((targetText) => {
    const button = [...document.querySelectorAll("button")].find((candidate) => candidate.textContent.trim() === targetText);
    if (!button) return false;
    button.click();
    return true;
  }, text);
  assert.equal(clicked, true, `button not found: ${text}`);
}

let studio = null;
let browser = null;

try {
  mkdirSync(reportDir, { recursive: true });
  cpSync(path.join(repoRoot, "fixtures", "golden-specs", "minimal-3scene"), projectDir, { recursive: true });
  studio = await startStudioServer({
    repoRoot,
    projectDir,
    port: 0,
    log: null
  });

  browser = await puppeteer.launch({
    executablePath: browserExecutablePath(),
    headless: "shell",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 980, deviceScaleFactor: 1 });
  page.setDefaultTimeout(120000);
  await page.goto(studio.url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__RF_STUDIO));
  await page.waitForFunction(() => document.querySelectorAll(".scene-card").length === 3);
  await page.waitForFunction(() => document.querySelector(".status-pill")?.textContent.trim() === "live");
  await page.screenshot({ path: path.join(reportDir, "01-scenes.png"), fullPage: true });
  assert.equal(await page.$$eval(".scene-card", (cards) => cards.length), 3);

  const beforeHeadlineReloads = await page.evaluate(() => window.__RF_STUDIO.preview.reloadCount);
  const headlineReloaded = page.waitForFunction((count) => window.__RF_STUDIO.preview.reloadCount > count, {}, beforeHeadlineReloads);
  const headlineResponse = page.waitForResponse(
    (response) => response.url().includes("/api/scenes/s01") && response.request().method() === "PATCH"
  );
  await setField(page, 'input[name="headline"]', "오늘의 핵심 수정");
  await page.click(".scene-form .primary-button");
  const headlinePayload = await (await headlineResponse).json();
  assert.equal(headlinePayload.class, "E1");
  const headlineJob = await waitForJob(studio.url, headlinePayload.compileJob.id);
  assert.equal(headlineJob.status, "succeeded", headlineJob.error ?? "");
  await page.waitForFunction(() => document.querySelector(".impact-badge")?.textContent.includes("씬만 갱신"));
  await headlineReloaded;
  await page.screenshot({ path: path.join(reportDir, "02-headline-e1.png"), fullPage: true });

  const beforeNarrationHash = audioSourceHash("s01");
  const narrationResponse = page.waitForResponse(
    (response) => response.url().includes("/api/scenes/s01") && response.request().method() === "PATCH"
  );
  await setField(page, 'textarea[name="narration"]', "서비스 지표가 다시 계산되어 핵심 변화가 더 선명해졌습니다.");
  await page.click(".scene-form .primary-button");
  const narrationPayload = await (await narrationResponse).json();
  assert.equal(narrationPayload.class, "E2");
  await page.waitForFunction(() => document.querySelector(".impact-badge")?.textContent.includes("재TTS+전체 재컴파일"));

  const beforeTtsReloads = await page.evaluate(() => window.__RF_STUDIO.preview.reloadCount);
  const ttsReloaded = page.waitForFunction((count) => window.__RF_STUDIO.preview.reloadCount > count, {}, beforeTtsReloads);
  const ttsResponse = page.waitForResponse(
    (response) => response.url().includes("/api/pipeline/tts") && response.request().method() === "POST"
  );
  await clickButtonByText(page, "TTS 재생성+재컴파일");
  const ttsPayload = await (await ttsResponse).json();
  assert.deepEqual(ttsPayload.sceneIds, ["s01"]);
  const ttsCompileJob = await waitForJob(studio.url, ttsPayload.compileJob.id);
  assert.equal(ttsCompileJob.status, "succeeded", ttsCompileJob.error ?? "");
  await waitForFilePredicate(() => audioSourceHash("s01") && audioSourceHash("s01") !== beforeNarrationHash);
  await ttsReloaded;
  assert.notEqual(audioSourceHash("s01"), beforeNarrationHash);

  await page.click('button[data-tab="versions"]');
  await page.waitForFunction(() => {
    const sections = [...document.querySelectorAll(".version-resource")];
    return sections.some((section) => section.textContent.includes("scene_specs") && section.textContent.includes("gen_"));
  });
  const backupGens = await page.$$eval(".version-resource", (sections) => {
    const section = sections.find((candidate) => candidate.textContent.includes("scene_specs"));
    return section ? [...section.querySelectorAll(".gen-label")].map((node) => node.textContent.trim()) : [];
  });
  assert.ok(backupGens.some((gen) => /^gen_\d{2,}$/.test(gen)), "scene_specs backup gen missing");

  const renderResponse = page.waitForResponse(
    (response) => response.url().includes("/api/render-scene") && response.request().method() === "POST"
  );
  await page.click(".preview-controls .secondary-button");
  const renderPayload = await (await renderResponse).json();
  assert.equal(renderPayload.job.sceneId, "s01");
  await page.waitForSelector('.scene-card[data-scene-id="s01"] .scene-preview-link', { timeout: 180000 });
  const previewHref = await page.$eval('.scene-card[data-scene-id="s01"] .scene-preview-link', (node) => node.href);
  assert.ok(previewHref.includes("/artifacts/out/studio/"), previewHref);
  const renderOutput = path.join(projectDir, renderPayload.job.output);
  await waitForFilePredicate(() => existsSync(renderOutput) && statSync(renderOutput).size > 0, 180000);

  await page.screenshot({ path: path.join(reportDir, "03-versions-render.png"), fullPage: true });

  console.log("studio-e2e: PASS");
  console.log("(a) scene cards: 3");
  console.log("(b) headline save: E1 + compile.completed SSE + iframe reload");
  console.log("(c) narration save: E2 + TTS button + audio_meta sourceHash changed");
  console.log(`(d) versions backup gens: ${backupGens.join(", ")}`);
  console.log("(e) screenshots: reports/studio-e2e/01-scenes.png, 02-headline-e1.png, 03-versions-render.png");
} finally {
  await browser?.close();
  studio?.close();
  rmSync(tmpRoot, { recursive: true, force: true });
}

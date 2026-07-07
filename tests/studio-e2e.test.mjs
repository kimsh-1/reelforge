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
  statSync,
  symlinkSync,
  writeFileSync
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
const debug = process.env.STUDIO_E2E_DEBUG === "1";

function mark(label) {
  if (debug) console.error(`[studio-e2e] ${label}`);
}

async function markPageState(page, label) {
  const state = await page.evaluate(() => {
    const iframe = document.querySelector(".preview-frame");
    let frame = {};
    try {
      frame = {
        src: iframe?.src ?? "",
        path: iframe?.contentWindow?.location?.pathname ?? "",
        h1: iframe?.contentDocument?.querySelector("h1")?.textContent ?? "",
        body: iframe?.contentDocument?.body?.innerText?.slice(0, 120) ?? ""
      };
    } catch (error) {
      frame = { error: error.message };
    }
    return {
      selected: window.__RF_STUDIO?.state?.selectedSceneId,
      hash: window.__RF_STUDIO?.state?.specsHash,
      lastEvent: window.__RF_STUDIO?.state?.lastEvent,
      updating: window.__RF_STUDIO?.state?.previewUpdating,
      failed: window.__RF_STUDIO?.state?.previewUpdateFailed,
      overlayHidden: document.querySelector(".preview-update-overlay")?.hidden,
      scrub: document.querySelector(".scrub")?.value,
      frame
    };
  });
  if (debug) console.error(`[studio-e2e] ${label} ${JSON.stringify(state)}`);
}

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
  await page.$eval(
    selector,
    (node, nextValue) => {
      node.focus();
      node.value = nextValue;
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
    },
    value
  );
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

async function waitForPreviewScene(page, sceneId, expectedScrub = "400") {
  await page.waitForFunction(
    ({ sceneId: targetSceneId, expectedScrub: scrubValue }) => {
      const iframe = document.querySelector(".preview-frame");
      const scrub = document.querySelector(".scrub");
      if (!iframe || !scrub) return false;
      try {
        const path = iframe.contentWindow.location.pathname;
        const headline = iframe.contentDocument.querySelector("h1")?.textContent.trim() ?? "";
        return path.endsWith(`/build/scenes/scene-${targetSceneId}.html`) && headline.length > 0 && scrub.value === scrubValue;
      } catch {
        return false;
      }
    },
    {},
    { sceneId, expectedScrub }
  );
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

  const outsideSecret = path.join(tmpRoot, "outside-secret.txt");
  writeFileSync(outsideSecret, "P4_SYMLINK_SECRET\n");
  symlinkSync(outsideSecret, path.join(projectDir, "build", "p4-symlink-secret.txt"));
  const symlinkResponse = await fetch(new URL("/build/p4-symlink-secret.txt", studio.url));
  assert.equal(symlinkResponse.status, 403);
  mark("symlink 403");

  browser = await puppeteer.launch({
    executablePath: browserExecutablePath(),
    headless: "shell",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });
  const page = await browser.newPage();
  if (debug) {
    page.on("pageerror", (error) => console.error(`[studio-e2e] pageerror ${error.message}`));
    page.on("request", (request) => {
      if (request.method() !== "GET") console.error(`[studio-e2e] request ${request.method()} ${request.url()}`);
    });
    page.on("response", (response) => {
      if (response.request().method() !== "GET") {
        console.error(`[studio-e2e] response ${response.status()} ${response.request().method()} ${response.url()}`);
      }
    });
  }
  await page.setViewport({ width: 1440, height: 980, deviceScaleFactor: 1 });
  page.setDefaultTimeout(120000);
  await page.goto(studio.url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__RF_STUDIO));
  await page.waitForFunction(() => document.querySelectorAll(".scene-card").length === 3);
  await page.waitForFunction(() => document.querySelector(".status-pill")?.textContent.trim() === "live");
  await waitForPreviewScene(page, "s01");
  mark("initial preview");
  await page.screenshot({ path: path.join(reportDir, "01-scenes.png"), fullPage: true });
  assert.equal(await page.$$eval(".scene-card", (cards) => cards.length), 3);

  await page.click('.scene-card[data-scene-id="s02"] .scene-card-main');
  await waitForPreviewScene(page, "s02");
  await page.click('.scene-card[data-scene-id="s01"] .scene-card-main');
  await waitForPreviewScene(page, "s01");
  mark("scene switch");

  const staleHash = await page.evaluate(() => window.__RF_STUDIO.state.specsHash);
  const externalPatch = await fetch(new URL("/api/scenes/s03", studio.url), {
    method: "PATCH",
    headers: { "content-type": "application/json", "if-match": staleHash },
    body: JSON.stringify({ fields: { headline: "외부 수정" } })
  });
  assert.equal(externalPatch.status, 200);
  const externalPayload = await externalPatch.json();
  const externalJob = await waitForJob(studio.url, externalPayload.compileJob.id);
  assert.equal(externalJob.status, "succeeded", externalJob.error ?? "");
  await page.evaluate((oldHash) => {
    window.__RF_STUDIO.state.specsHash = oldHash;
  }, staleHash);
  mark("external patch");
  const staleUiResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/scenes/s01") && response.request().method() === "PATCH" && response.status() === 409
  );
  await setField(page, 'input[name="headline"]', "P4 stale save");
  await page.click(".scene-form .primary-button");
  const stalePanelResponse = await staleUiResponse;
  assert.equal(stalePanelResponse.status(), 409);
  await page.waitForFunction(() => document.body.textContent.includes("다른 곳에서 수정됨"));
  mark("stale ui");
  await clickButtonByText(page, "재로드");
  await page.waitForFunction(
    (oldHash) =>
      window.__RF_STUDIO.state.specsHash !== oldHash &&
      window.__RF_STUDIO.state.needsReload === false &&
      Boolean(document.querySelector('.scene-form input[name="headline"]')),
    {},
    staleHash
  );
  mark("reload after stale");
  await waitForPreviewScene(page, "s01");
  await markPageState(page, "after reload");

  const headlineResponse = page.waitForResponse(
    (response) => response.url().includes("/api/scenes/s01") && response.request().method() === "PATCH"
  );
  await setField(page, 'input[name="headline"]', "P4 headline edit");
  if (debug) {
    const value = await page.$eval('input[name="headline"]', (node) => node.value);
    console.error(`[studio-e2e] headline input ${value}`);
  }
  mark("headline field set");
  await page.click(".scene-form .primary-button");
  mark("headline save clicked");
  const headlinePayload = await (await headlineResponse).json();
  mark(`headline payload ${JSON.stringify({ class: headlinePayload.class, job: headlinePayload.compileJob?.id, status: headlinePayload.compileJob?.status })}`);
  assert.equal(headlinePayload.class, "E1");
  await markPageState(page, "before headline job wait");
  const headlineJob = await waitForJob(studio.url, headlinePayload.compileJob.id);
  assert.equal(headlineJob.status, "succeeded", headlineJob.error ?? "");
  await page.waitForFunction(() => document.querySelector(".impact-badge")?.textContent.includes("씬만 갱신"));
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await markPageState(page, "after headline job");
  await page.waitForFunction(() => {
    const headline = document.querySelector(".preview-frame")?.contentDocument?.querySelector("h1")?.textContent ?? "";
    return headline.includes("P4 headline edit");
  });
  mark("headline e1");
  await page.screenshot({ path: path.join(reportDir, "02-headline-e1.png"), fullPage: true });

  const beforeNarrationHash = audioSourceHash("s01");
  const narrationResponse = page.waitForResponse(
    (response) => response.url().includes("/api/scenes/s01") && response.request().method() === "PATCH"
  );
  await setField(page, 'textarea[name="narration"]', "P4 narration source changed for rebuild.");
  await page.click(".scene-form .primary-button");
  const narrationPayload = await (await narrationResponse).json();
  assert.equal(narrationPayload.class, "E2");
  await page.waitForFunction(() => document.querySelector(".impact-badge")?.textContent.includes("재TTS+전체 재컴파일"));
  mark("narration e2");

  const overlayVisible = page.waitForFunction(
    () => !document.querySelector(".preview-update-overlay")?.hidden && document.querySelector(".preview-update-overlay")?.textContent.includes("갱신 중")
  );
  const ttsResponse = page.waitForResponse(
    (response) => response.url().includes("/api/pipeline/tts") && response.request().method() === "POST"
  );
  await clickButtonByText(page, "TTS 재생성+재컴파일");
  await overlayVisible;
  const ttsPayload = await (await ttsResponse).json();
  assert.deepEqual(ttsPayload.sceneIds, ["s01"]);
  const ttsCompileJob = await waitForJob(studio.url, ttsPayload.compileJob.id);
  assert.equal(ttsCompileJob.status, "succeeded", ttsCompileJob.error ?? "");
  await waitForFilePredicate(() => audioSourceHash("s01") && audioSourceHash("s01") !== beforeNarrationHash);
  await page.waitForFunction(() => document.querySelector(".preview-update-overlay")?.hidden);
  await waitForPreviewScene(page, "s01");
  assert.notEqual(audioSourceHash("s01"), beforeNarrationHash);
  mark("tts compile");

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
  const versionTarget = await page.evaluate(() => {
    const section = [...document.querySelectorAll(".version-resource")].find((candidate) =>
      candidate.textContent.includes("scene_specs")
    );
    const row = [...(section?.querySelectorAll(".version-row") ?? [])].find(
      (candidate) => !candidate.classList.contains("is-selected") && candidate.querySelector("button:not([disabled])")
    );
    return row?.querySelector(".gen-label")?.textContent.trim() ?? null;
  });
  assert.ok(versionTarget, "no selectable scene_specs generation");
  const versionResponse = page.waitForResponse(
    (response) => response.url().includes("/api/versions/select") && response.request().method() === "POST"
  );
  await page.evaluate((target) => {
    const section = [...document.querySelectorAll(".version-resource")].find((candidate) =>
      candidate.textContent.includes("scene_specs")
    );
    const row = [...section.querySelectorAll(".version-row")].find(
      (candidate) => candidate.querySelector(".gen-label")?.textContent.trim() === target
    );
    row.querySelector("button:not([disabled])").click();
  }, versionTarget);
  const versionPayload = await (await versionResponse).json();
  assert.equal(versionPayload.resourceType, "scene_specs");
  assert.equal(versionPayload.selected, versionTarget);
  await page.waitForFunction((target) => {
    const section = [...document.querySelectorAll(".version-resource")].find((candidate) =>
      candidate.textContent.includes("scene_specs")
    );
    return [...(section?.querySelectorAll(".version-row.is-selected") ?? [])].some(
      (row) => row.querySelector(".gen-label")?.textContent.trim() === target
    );
  }, {}, versionTarget);
  assert.equal(readJson(path.join(projectDir, "versions.json")).resources.scene_specs.selected, versionTarget);
  mark("versions select");

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
  mark("render");

  await page.screenshot({ path: path.join(reportDir, "03-versions-render.png"), fullPage: true });

  console.log("studio-e2e: PASS");
  console.log("(a) scene cards: 3");
  console.log("(b) headline save: E1 + compile.completed SSE + iframe reload");
  console.log("(c) narration save: E2 + TTS button + audio_meta sourceHash changed");
  console.log(`(d) versions backup gens: ${backupGens.join(", ")}`);
  console.log("(e) screenshots: reports/studio-e2e/01-scenes.png, 02-headline-e1.png, 03-versions-render.png");
  console.log("(f) build symlink: 403");
  console.log("(g) scene switch: iframe scene source + scrub 40%");
  console.log("(h) If-Match stale save: 409 + reload UI");
  console.log(`(i) versions select: scene_specs -> ${versionTarget}`);
} finally {
  await browser?.close();
  studio?.close();
  rmSync(tmpRoot, { recursive: true, force: true });
}

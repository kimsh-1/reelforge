#!/usr/bin/env node
import assert from "node:assert/strict";
import { createMockApi } from "./mock-api.js";
import { renderSceneForm, impactDetails } from "./form.js";
import { SCENE_SCHEMA_FALLBACK } from "./schema-fallback.js";
import { createPreviewController } from "./preview.js";

class FakeClassList {
  constructor(node) {
    this.node = node;
  }

  toggle(className, force) {
    const classes = new Set(String(this.node.className ?? "").split(/\s+/).filter(Boolean));
    const shouldAdd = force === undefined ? !classes.has(className) : Boolean(force);
    if (shouldAdd) classes.add(className);
    else classes.delete(className);
    this.node.className = [...classes].join(" ");
    return shouldAdd;
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.dataset = {};
    this.listeners = {};
    this.className = "";
    this.textContent = "";
    this.value = "";
    this.checked = false;
    this.disabled = false;
    this.name = "";
    this.type = "";
    this.max = "";
    this.min = "";
    this.step = "";
    this.classList = new FakeClassList(this);
  }

  append(...children) {
    for (const child of children.flat()) {
      if (child === null || child === undefined) continue;
      if (typeof child === "string") {
        const text = new FakeElement("#text");
        text.textContent = child;
        text.parentNode = this;
        this.children.push(text);
      } else {
        child.parentNode = this;
        this.children.push(child);
      }
    }
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "name") this.name = String(value);
    if (name === "class") this.className = String(value);
    if (name.startsWith("data-")) {
      const key = name
        .slice(5)
        .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[key] = String(value);
    }
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  addEventListener(type, listener) {
    this.listeners[type] = this.listeners[type] ?? [];
    this.listeners[type].push(listener);
  }

  dispatchEvent(event) {
    const payload =
      typeof event === "string"
        ? { type: event, preventDefault() {} }
        : { preventDefault() {}, ...event };
    for (const listener of this.listeners[payload.type] ?? []) listener(payload);
  }

  click() {
    this.dispatchEvent({ type: "click" });
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }

  matches(selector) {
    const classMatch = /^\.([A-Za-z0-9_-]+)$/.exec(selector);
    if (classMatch) return String(this.className).split(/\s+/).includes(classMatch[1]);
    const nameMatch = /^\[name="([^"]+)"\]$/.exec(selector);
    if (nameMatch) return this.name === nameMatch[1];
    const dataMatch = /^\[data-field="([^"]+)"\]$/.exec(selector);
    if (dataMatch) return this.dataset.field === dataMatch[1];
    return this.tagName.toLowerCase() === selector.toLowerCase();
  }

  querySelectorAll(selector) {
    const result = [];
    const visit = (node) => {
      if (node.matches?.(selector)) result.push(node);
      for (const child of node.children ?? []) visit(child);
    };
    visit(this);
    return result;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

class FakeDocument {
  createElement(tagName) {
    return new FakeElement(tagName);
  }
}

const documentRef = new FakeDocument();
const api = createMockApi({ timer: (fn) => fn() });
const project = await api.getProject();
const scene = project.specs.scenes[0];

const formContainer = documentRef.createElement("div");
const form = renderSceneForm({
  documentRef,
  container: formContainer,
  rootSchema: SCENE_SCHEMA_FALLBACK,
  scene
});

assert.ok(formContainer.querySelector('[name="headline"]'), "headline field missing");
assert.ok(formContainer.querySelector('[name="layout"]'), "layout enum select missing");
assert.ok(formContainer.querySelector('[name="overrides.headline.x"]'), "override slider missing");

formContainer.querySelector('[name="headline"]').value = "스모크 수정";
const patch = form.collectPatch();
assert.deepEqual(Object.keys(patch), ["headline"]);

const patchResult = await api.patchScene(scene.sceneId, patch);
assert.equal(patchResult.class, "E1");
assert.deepEqual(patchResult.actions, ["compile:scene"]);
assert.equal(impactDetails(patchResult.class).label, "씬만 갱신");

let progress = 0;
let paused = false;
const iframe = documentRef.createElement("iframe");
iframe.contentWindow = {
  __timelines: {
    main: {
      duration: () => 10,
      progress: (value) => {
        if (typeof value === "number") progress = value;
        return progress;
      },
      pause: () => {
        paused = true;
      }
    }
  }
};
const scrub = documentRef.createElement("input");
scrub.max = "1000";
scrub.value = "500";
const playButton = documentRef.createElement("button");
const timeLabel = documentRef.createElement("span");

createPreviewController({
  iframe,
  scrub,
  playButton,
  timeLabel,
  windowRef: {
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {}
  }
});

scrub.dispatchEvent({ type: "input" });
assert.equal(progress, 0.5);
assert.equal(paused, true);
assert.equal(timeLabel.textContent, "5.00s / 10.00s");

console.log("studio-panel-smoke: PASS");
console.log("form generation: headline/layout/overrides");
console.log("PATCH flow: E1 compile:scene");
console.log("impact badge: 씬만 갱신");
console.log("scrub: progress 0.5");

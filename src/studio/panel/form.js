import { resolveSchema, sceneSchema } from "./schema-loader.js";

export const PATCH_FIELDS = new Set([
  "narration",
  "narration_tts",
  "altText",
  "caption",
  "layout",
  "mood",
  "reveal",
  "emphasis",
  "headline",
  "items",
  "values",
  "unit",
  "source",
  "visual_kind",
  "imageAsset",
  "kenBurns",
  "subtitleMode",
  "ost",
  "overrides"
]);

const IMPACT_COPY = {
  E1: { label: "씬만 갱신", tone: "scene", actions: { "compile:scene": "씬 컴파일" } },
  E2: { label: "재TTS+전체 재컴파일", tone: "tts", actions: { "pipeline:tts": "TTS", "compile:full": "전체 컴파일" } },
  E3: { label: "구조 변경", tone: "structure", actions: { "compile:full": "전체 컴파일" } }
};

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function fieldLabel(path) {
  return path.join(".");
}

function own(value, key) {
  return value !== null && typeof value === "object" && Object.hasOwn(value, key);
}

function valueAt(target, path) {
  return path.reduce((node, key) => (node && own(node, key) ? node[key] : undefined), target);
}

function setAt(target, path, value) {
  let node = target;
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index];
    if (!node[key] || typeof node[key] !== "object") node[key] = {};
    node = node[key];
  }
  const leaf = path[path.length - 1];
  if (value === undefined) delete node[leaf];
  else node[leaf] = value;
}

function isRequired(path, rootSceneSchema, parentSchema) {
  if (path.length === 1) return rootSceneSchema.required?.includes(path[0]) ?? false;
  return parentSchema?.required?.includes(path[path.length - 1]) ?? false;
}

function numberBounds(schema, path) {
  const isOverride = path.includes("overrides");
  const min = Number.isFinite(schema.minimum) ? schema.minimum : isOverride ? 0 : 0;
  const max = Number.isFinite(schema.maximum) ? schema.maximum : isOverride ? 100 : schema.type === "integer" ? 120 : 4;
  const step = schema.type === "integer" ? 1 : isOverride ? 1 : 0.01;
  return { min, max, step };
}

function createElement(documentRef, tagName, attrs = {}, children = []) {
  const node = documentRef.createElement(tagName);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (key === "className") node.className = value;
    else if (key === "textContent") node.textContent = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child === null || child === undefined) continue;
    node.append(child);
  }
  return node;
}

function enumValue(value) {
  return JSON.stringify(value);
}

function parseEnumValue(value) {
  if (value === "__undefined__") return undefined;
  return JSON.parse(value);
}

function parseScalarText(raw, { optional }) {
  if (optional && raw === "") return undefined;
  return raw;
}

function parseArrayText(raw, path, optional) {
  const items = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (optional && items.length === 0) return undefined;
  if (path[path.length - 1] !== "values") return items;
  return items.map((item) => (/^-?\d+(?:\.\d+)?$/.test(item) ? Number(item) : item));
}

function appendFieldShell(documentRef, container, path, editable) {
  const field = createElement(documentRef, "label", {
    className: `field${editable ? "" : " is-readonly"}`,
    dataset: { field: fieldLabel(path) }
  });
  field.append(createElement(documentRef, "span", { className: "field-label", textContent: fieldLabel(path) }));
  container.append(field);
  return field;
}

function appendEnumField({ documentRef, container, path, schema, value, editable, optional, controls }) {
  const field = appendFieldShell(documentRef, container, path, editable);
  const select = createElement(documentRef, "select", { name: fieldLabel(path), disabled: !editable });
  if (optional && value === undefined) {
    select.append(createElement(documentRef, "option", { value: "__undefined__", textContent: "unset" }));
    select.value = "__undefined__";
  }
  for (const candidate of schema.enum) {
    select.append(
      createElement(documentRef, "option", {
        value: enumValue(candidate),
        textContent: candidate === null ? "null" : String(candidate)
      })
    );
  }
  if (value !== undefined) select.value = enumValue(value);
  field.append(select);
  controls.push({
    path,
    read: () => parseEnumValue(select.value)
  });
}

function appendBooleanField({ documentRef, container, path, value, editable, optional, controls }) {
  const field = appendFieldShell(documentRef, container, path, editable);
  const input = createElement(documentRef, "input", {
    type: "checkbox",
    name: fieldLabel(path),
    checked: Boolean(value),
    disabled: !editable
  });
  field.append(createElement(documentRef, "span", { className: "toggle-track" }, input));
  controls.push({
    path,
    read: () => (optional && value === undefined && !input.checked ? undefined : Boolean(input.checked))
  });
}

function appendNumberField({ documentRef, container, path, schema, value, editable, optional, controls }) {
  const field = appendFieldShell(documentRef, container, path, editable);
  const { min, max, step } = numberBounds(schema, path);
  const initial = Number.isFinite(value) ? value : min;
  const row = createElement(documentRef, "div", { className: "range-row" });
  const range = createElement(documentRef, "input", {
    type: "range",
    name: fieldLabel(path),
    min,
    max,
    step,
    value: initial,
    disabled: !editable
  });
  const number = createElement(documentRef, "input", {
    type: "number",
    min,
    max,
    step,
    value: initial,
    disabled: !editable
  });
  const sync = (source, target) => {
    target.value = source.value;
  };
  range.addEventListener("input", () => sync(range, number));
  number.addEventListener("input", () => sync(number, range));
  row.append(range, number);
  field.append(row);
  controls.push({
    path,
    read: () => {
      const parsed = Number(number.value);
      if (optional && value === undefined && number.value === "") return undefined;
      return Number.isFinite(parsed) ? parsed : undefined;
    }
  });
}

function appendStringField({ documentRef, container, path, schema, value, editable, optional, controls }) {
  const field = appendFieldShell(documentRef, container, path, editable);
  const useTextarea = path.includes("narration") || schema.maxLength > 256;
  const input = createElement(documentRef, useTextarea ? "textarea" : "input", {
    name: fieldLabel(path),
    value: value ?? "",
    rows: useTextarea ? 5 : undefined,
    maxLength: schema.maxLength,
    disabled: !editable
  });
  if (useTextarea) input.textContent = value ?? "";
  field.append(input);
  controls.push({
    path,
    read: () => parseScalarText(input.value, { optional })
  });
}

function appendArrayField({ documentRef, container, path, value, editable, optional, controls }) {
  const field = appendFieldShell(documentRef, container, path, editable);
  const input = createElement(documentRef, "textarea", {
    name: fieldLabel(path),
    rows: 4,
    disabled: !editable
  });
  input.value = Array.isArray(value) ? value.join("\n") : "";
  input.textContent = input.value;
  field.append(input);
  controls.push({
    path,
    read: () => parseArrayText(input.value, path, optional)
  });
}

function appendMissingObject(documentRef, container, path, editable) {
  const fieldset = createElement(documentRef, "fieldset", {
    className: `field-group is-empty${editable ? "" : " is-readonly"}`,
    dataset: { field: fieldLabel(path) }
  });
  fieldset.append(createElement(documentRef, "legend", { textContent: fieldLabel(path) }));
  fieldset.append(createElement(documentRef, "p", { className: "empty-field", textContent: "unset" }));
  container.append(fieldset);
}

function appendObjectFields({
  documentRef,
  container,
  path,
  schema,
  rootSchema,
  rootSceneSchema,
  value,
  editable,
  controls
}) {
  if (value === undefined && path.length > 0) {
    appendMissingObject(documentRef, container, path, editable);
    return;
  }

  const group =
    path.length === 0
      ? container
      : createElement(documentRef, "fieldset", {
          className: `field-group${editable ? "" : " is-readonly"}`,
          dataset: { field: fieldLabel(path) }
        });
  if (path.length > 0) {
    group.append(createElement(documentRef, "legend", { textContent: fieldLabel(path) }));
    container.append(group);
  }

  for (const [key, rawChildSchema] of Object.entries(schema.properties ?? {})) {
    const childPath = [...path, key];
    const childSchema = resolveSchema(rawChildSchema, rootSchema);
    const childValue = valueAt(value ?? {}, [key]);
    const childEditable = editable && (path.length > 0 || PATCH_FIELDS.has(key));
    appendField({
      documentRef,
      container: group,
      path: childPath,
      schema: childSchema,
      parentSchema: schema,
      rootSchema,
      rootSceneSchema,
      value: childValue,
      editable: childEditable,
      controls
    });
  }
}

function appendField({
  documentRef,
  container,
  path,
  schema,
  parentSchema,
  rootSchema,
  rootSceneSchema,
  value,
  editable,
  controls
}) {
  const resolved = resolveSchema(schema, rootSchema);
  const topLevel = path[0];
  const optional = !isRequired(path, rootSceneSchema, parentSchema);
  const canPatch = PATCH_FIELDS.has(topLevel);
  const effectiveEditable = editable && canPatch;

  if (Array.isArray(resolved.enum)) {
    appendEnumField({ documentRef, container, path, schema: resolved, value, editable: effectiveEditable, optional, controls });
    return;
  }

  if (resolved.type === "object" || resolved.properties) {
    appendObjectFields({
      documentRef,
      container,
      path,
      schema: resolved,
      rootSchema,
      rootSceneSchema,
      value,
      editable: effectiveEditable,
      controls
    });
    return;
  }

  if (resolved.type === "array") {
    appendArrayField({ documentRef, container, path, value, editable: effectiveEditable, optional, controls });
    return;
  }

  if (resolved.type === "boolean") {
    appendBooleanField({ documentRef, container, path, value, editable: effectiveEditable, optional, controls });
    return;
  }

  if (resolved.type === "number" || resolved.type === "integer") {
    appendNumberField({ documentRef, container, path, schema: resolved, value, editable: effectiveEditable, optional, controls });
    return;
  }

  appendStringField({ documentRef, container, path, schema: resolved, value, editable: effectiveEditable, optional, controls });
}

export function createPatchFromControls(scene, controls) {
  const draft = clone(scene);
  for (const control of controls) {
    if (!PATCH_FIELDS.has(control.path[0])) continue;
    setAt(draft, control.path, control.read());
  }

  const patch = {};
  for (const field of PATCH_FIELDS) {
    if (!jsonEqual(scene?.[field], draft?.[field])) patch[field] = draft[field];
  }
  return patch;
}

export function renderSceneForm({ documentRef = globalThis.document, container, rootSchema, scene, onSave }) {
  const rootSceneSchema = sceneSchema(rootSchema);
  const controls = [];
  container.replaceChildren();

  const form = createElement(documentRef, "form", { className: "scene-form" });
  appendObjectFields({
    documentRef,
    container: form,
    path: [],
    schema: rootSceneSchema,
    rootSchema,
    rootSceneSchema,
    value: scene,
    editable: true,
    controls
  });

  const footer = createElement(documentRef, "div", { className: "form-footer" });
  const saveButton = createElement(documentRef, "button", { type: "submit", className: "primary-button", textContent: "저장" });
  footer.append(saveButton);
  form.append(footer);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSave?.(createPatchFromControls(scene, controls));
  });

  container.append(form);
  return {
    form,
    controls,
    collectPatch: () => createPatchFromControls(scene, controls)
  };
}

export function impactDetails(impactClass) {
  return IMPACT_COPY[impactClass] ?? { label: "대기", tone: "idle", actions: {} };
}

export function actionLabel(action) {
  for (const details of Object.values(IMPACT_COPY)) {
    if (details.actions[action]) return details.actions[action];
  }
  return action;
}

import { SCENE_SCHEMA_FALLBACK } from "./schema-fallback.js";

const SCHEMA_CANDIDATES = [
  "/schemas/scene-specs.schema.json",
  "./scene-specs.schema.json",
  "../../../schemas/scene-specs.schema.json"
];

async function fetchJson(fetchImpl, url) {
  const response = await fetchImpl(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`schema fetch failed: ${response.status}`);
  return response.json();
}

export async function loadSceneSpecsSchema({ fetchImpl = globalThis.fetch, windowRef = globalThis.window } = {}) {
  if (windowRef?.__RF_SCENE_SCHEMA) return windowRef.__RF_SCENE_SCHEMA;
  if (typeof fetchImpl === "function" && windowRef?.location?.protocol !== "file:") {
    for (const candidate of SCHEMA_CANDIDATES) {
      try {
        return await fetchJson(fetchImpl, candidate);
      } catch {
        // The panel may be served without schemas mounted. Fall back to the embedded copy.
      }
    }
  }
  return SCENE_SCHEMA_FALLBACK;
}

export function getSchemaRef(rootSchema, ref) {
  if (typeof ref !== "string" || !ref.startsWith("#/")) return null;
  return ref
    .slice(2)
    .split("/")
    .reduce((node, key) => (node && Object.hasOwn(node, key) ? node[key] : null), rootSchema);
}

function mergeSchemas(parts) {
  const merged = {};
  for (const part of parts) {
    const properties = { ...(merged.properties ?? {}), ...(part.properties ?? {}) };
    Object.assign(merged, part);
    if (Object.keys(properties).length > 0) merged.properties = properties;
    if (merged.required || part.required) {
      merged.required = [...new Set([...(merged.required ?? []), ...(part.required ?? [])])];
    }
  }
  return merged;
}

export function resolveSchema(schema, rootSchema) {
  if (!schema || typeof schema !== "object") return {};
  if (schema.$ref) {
    return resolveSchema(getSchemaRef(rootSchema, schema.$ref) ?? {}, rootSchema);
  }
  if (Array.isArray(schema.allOf)) {
    return mergeSchemas(schema.allOf.map((part) => resolveSchema(part, rootSchema)));
  }
  if (Array.isArray(schema.oneOf) && !schema.type && !schema.enum) {
    return { ...schema, type: schema.oneOf.map((part) => resolveSchema(part, rootSchema).type).filter(Boolean) };
  }
  return schema;
}

export function sceneSchema(rootSchema) {
  return resolveSchema(rootSchema?.$defs?.scene ?? {}, rootSchema);
}

export function transitionSchema(rootSchema) {
  return resolveSchema(rootSchema?.$defs?.transition ?? {}, rootSchema);
}

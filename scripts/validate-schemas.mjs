#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = process.cwd();
const schemaPaths = [
  "schemas/scene-specs.schema.json",
  "schemas/audio-meta.schema.json",
  "schemas/design-tokens.schema.json",
  "schemas/versions.schema.json",
  "schemas/render-manifest.schema.json",
  "schemas/pipeline-state.schema.json"
];

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  validateSchema: true,
  allowUnionTypes: false
});
addFormats(ajv);

const schemas = [];
for (const relativePath of schemaPaths) {
  const absolutePath = path.join(root, relativePath);
  const schema = JSON.parse(await readFile(absolutePath, "utf8"));
  schemas.push({ relativePath, schema });
}

for (const { relativePath, schema } of schemas) {
  const valid = ajv.validateSchema(schema);
  if (!valid) {
    console.error(`${relativePath}: invalid JSON Schema`);
    console.error(ajv.errorsText(ajv.errors, { separator: "\n" }));
    process.exit(1);
  }
}

for (const { schema } of schemas) {
  ajv.addSchema(schema);
}

for (const { relativePath, schema } of schemas) {
  try {
    ajv.compile(schema);
  } catch (error) {
    console.error(`${relativePath}: failed to compile or resolve $ref`);
    console.error(error.message);
    process.exit(1);
  }
}

console.log(`schemas: ${schemaPaths.length} schemas are valid and all $ref targets resolve`);

#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const schemaSpecs = [
  {
    name: "scene-specs",
    schemaPath: "schemas/scene-specs.schema.json",
    minFixtures: 20
  },
  {
    name: "audio-meta",
    schemaPath: "schemas/audio-meta.schema.json",
    minFixtures: 8
  },
  {
    name: "design-tokens",
    schemaPath: "schemas/design-tokens.schema.json",
    minFixtures: 8
  },
  {
    name: "versions",
    schemaPath: "schemas/versions.schema.json",
    minFixtures: 6
  },
  {
    name: "render-manifest",
    schemaPath: "schemas/render-manifest.schema.json",
    minFixtures: 10
  },
  {
    name: "pilot-report",
    schemaPath: "schemas/pilot-report.schema.json",
    minFixtures: 5
  }
];

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  validateSchema: true,
  allowUnionTypes: false
});
addFormats(ajv);

const schemas = new Map();
for (const spec of schemaSpecs) {
  const schema = JSON.parse(await readFile(path.join(repoRoot, spec.schemaPath), "utf8"));
  schemas.set(spec.name, schema);
  ajv.addSchema(schema);
}

const validators = new Map();
for (const spec of schemaSpecs) {
  const schema = schemas.get(spec.name);
  const validate = ajv.getSchema(schema.$id);
  if (!validate) {
    throw new Error(`${spec.schemaPath}: schema was not registered`);
  }
  validators.set(spec.name, validate);
}

async function listFixtures(schemaName) {
  const dir = path.join(repoRoot, "fixtures", "negative", schemaName);
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonc"))
    .map((entry) => path.join(dir, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

function parseFixture(raw, relativePath) {
  const lines = raw.split(/\r?\n/);
  const comment = lines[0] ?? "";
  if (!/^\/\/\s*위반 규칙:\s+\S/.test(comment)) {
    throw new Error(`${relativePath}: first line must be '// 위반 규칙: ...'`);
  }
  return JSON.parse(lines.slice(1).join("\n"));
}

const unexpectedPasses = [];
const fixtureErrors = [];
const summary = [];
let total = 0;

for (const spec of schemaSpecs) {
  let fixtures;
  try {
    fixtures = await listFixtures(spec.name);
  } catch (error) {
    fixtureErrors.push(`fixtures/negative/${spec.name}: ${error.message}`);
    continue;
  }

  if (fixtures.length < spec.minFixtures) {
    fixtureErrors.push(
      `fixtures/negative/${spec.name}: expected at least ${spec.minFixtures} fixtures, found ${fixtures.length}`
    );
  }

  const validate = validators.get(spec.name);
  let rejected = 0;
  for (const fixture of fixtures) {
    const relativePath = path.relative(repoRoot, fixture).split(path.sep).join("/");
    let data;
    try {
      data = parseFixture(await readFile(fixture, "utf8"), relativePath);
    } catch (error) {
      fixtureErrors.push(error.message);
      continue;
    }

    if (validate(data)) {
      unexpectedPasses.push(relativePath);
    } else {
      rejected += 1;
    }
  }

  total += fixtures.length;
  summary.push({ name: spec.name, rejected, total: fixtures.length });
}

if (fixtureErrors.length > 0 || unexpectedPasses.length > 0) {
  if (fixtureErrors.length > 0) {
    console.error("negative-suite: fixture errors");
    for (const error of fixtureErrors) console.error(`- ${error}`);
  }
  if (unexpectedPasses.length > 0) {
    console.error("negative-suite: fixtures unexpectedly passed Ajv validation");
    for (const fixture of unexpectedPasses) console.error(`- ${fixture}`);
  }
  process.exit(1);
}

console.log("negative-suite: pass");
for (const item of summary) {
  console.log(`${item.name}: ${item.rejected}/${item.total} rejected by Ajv`);
}
console.log(`total: ${total} fixtures rejected by Ajv`);

#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "vendor", "vendor-checksums.json");

const assets = [
  {
    id: "gsap-core",
    file: "vendor/gsap/3.14.2/gsap.min.js",
    kind: "script",
    name: "GSAP",
    version: "3.14.2",
    license: "GreenSock Standard 'no charge' license — https://gsap.com/standard-license",
    sourceUrl: "https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js",
    provenance: "Official gsap npm package dist build; redistributed unmodified."
  }
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function download(asset) {
  const response = await fetch(asset.sourceUrl, {
    headers: { "user-agent": "reelforge-vendor-fetcher/1.0" }
  });
  if (!response.ok) {
    throw new Error(`${asset.id}: download failed ${response.status} ${response.statusText}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) throw new Error(`${asset.id}: empty response`);
  if (asset.kind === "script" && !/gsap/i.test(bytes.subarray(0, 4096).toString("utf8"))) {
    throw new Error(`${asset.id}: response does not look like a gsap build`);
  }
  return bytes;
}

async function writeAtomic(filePath, bytes) {
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(tmpPath, bytes);
  await rename(tmpPath, filePath);
}

async function main() {
  let previous = { schemaVersion: 1, policy: "", records: [] };
  try {
    previous = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    // first run: manifest is created below
  }

  const records = [];
  for (const asset of assets) {
    const bytes = await download(asset);
    const targetPath = path.join(repoRoot, asset.file);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeAtomic(targetPath, bytes);
    const digest = sha256(bytes);
    const prior = (previous.records ?? []).find((record) => record.id === asset.id);
    if (prior?.sha256 && prior.sha256 !== digest) {
      console.warn(`${asset.id}: sha256 CHANGED ${prior.sha256} -> ${digest} (upstream drift; re-run the frame regression suite)`);
    }
    records.push({ ...asset, bytes: bytes.length, sha256: digest });
    console.log(`${asset.file} ${bytes.length} ${digest}`);
  }

  const manifest = {
    schemaVersion: 1,
    policy:
      "Runtime vendor assets are version-pinned, hash-verified local copies. The compiler stages them into build/vendor/ and refuses to build on a missing or hash-mismatched copy. Generated compositions must never reference a CDN.",
    records
  };
  await writeAtomic(manifestPath, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

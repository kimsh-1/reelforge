#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fontsDir = path.join(repoRoot, "assets", "fonts");

const assets = [
  {
    id: "pretendard-variable",
    file: "PretendardVariable.woff2",
    kind: "font",
    family: "Pretendard Variable",
    version: "1.3.9",
    license: "OFL-1.1",
    sourceUrl: "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/woff2/PretendardVariable.woff2",
    provenance: "Official Pretendard npm CDN build; redistributed unmodified."
  },
  {
    id: "pretendard-ofl",
    file: "Pretendard-OFL.txt",
    kind: "license",
    family: "Pretendard Variable",
    version: "1.3.9",
    license: "OFL-1.1",
    sourceUrl: "https://raw.githubusercontent.com/orioncactus/pretendard/v1.3.9/LICENSE",
    provenance: "Pretendard upstream license with RFN declarations."
  },
  {
    id: "d2coding-regular",
    file: "D2Coding.woff2",
    kind: "font",
    family: "D2Coding",
    version: "1.3.2",
    license: "OFL-1.1",
    sourceUrl: "https://cdn.jsdelivr.net/gh/Joungkyun/font-d2coding@1.3.2/D2Coding.woff2",
    provenance: "Version-pinned D2Coding webfont package generated from NAVER D2Coding 1.3.2; redistributed unmodified from this webfont release."
  },
  {
    id: "d2coding-ofl",
    file: "D2Coding-OFL.txt",
    kind: "license",
    family: "D2Coding",
    version: "1.3.2",
    license: "OFL-1.1",
    sourceUrl: "https://cdn.jsdelivr.net/gh/Joungkyun/font-d2coding@1.3.2/License",
    provenance: "D2Coding webfont package OFL text."
  },
  {
    id: "d2coding-notice",
    file: "D2Coding-NOTICE.md",
    kind: "notice",
    family: "D2Coding",
    version: "1.3.2",
    license: "OFL-1.1",
    sourceUrl: "https://cdn.jsdelivr.net/gh/Joungkyun/font-d2coding@1.3.2/README.md",
    provenance: "D2Coding webfont README with NAVER copyright notice and webfont provenance."
  }
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function download(asset) {
  const response = await fetch(asset.sourceUrl, {
    headers: { "user-agent": "reelforge-font-fetcher/1.0" }
  });
  if (!response.ok) {
    throw new Error(`${asset.id}: download failed ${response.status} ${response.statusText}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) throw new Error(`${asset.id}: empty response`);
  if (asset.kind === "font" && bytes.subarray(0, 4).toString("ascii") !== "wOF2") {
    throw new Error(`${asset.id}: expected WOFF2 signature`);
  }
  return bytes;
}

async function writeAtomic(filePath, bytes) {
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(tmpPath, bytes);
  await rename(tmpPath, filePath);
}

async function main() {
  await mkdir(fontsDir, { recursive: true });
  const records = [];

  for (const asset of assets) {
    const bytes = await download(asset);
    const targetPath = path.join(fontsDir, asset.file);
    await writeAtomic(targetPath, bytes);
    records.push({
      id: asset.id,
      file: `assets/fonts/${asset.file}`,
      kind: asset.kind,
      family: asset.family,
      version: asset.version,
      license: asset.license,
      sourceUrl: asset.sourceUrl,
      provenance: asset.provenance,
      bytes: bytes.length,
      sha256: sha256(bytes)
    });
    console.log(`${asset.file} ${bytes.length} ${sha256(bytes)}`);
  }

  const manifest = {
    schemaVersion: 1,
    policy: "OFL fonts only; keep RFN fonts as official upstream builds or pinned upstream webfont release files, unmodified.",
    records
  };
  await writeAtomic(
    path.join(fontsDir, "font-checksums.json"),
    Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8")
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

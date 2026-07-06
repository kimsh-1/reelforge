export const gateRegistry = {
  p0a: {
    gate: "P0a",
    title: "environment and static render",
    script: "poc/scripts/gate-p0a.mjs",
    legacyReport: "poc/reports/P0a-report.json",
    render: false,
    inputSet: ["poc/fixtures/p0a", "poc/reports/doctor.json", "poc/scripts/gate-p0a.mjs"]
  },
  p0b: {
    gate: "P0b",
    title: "sub-composition mount and orphan behavior",
    script: "poc/scripts/gate-p0b.mjs",
    legacyReport: "poc/reports/P0b-report.json",
    render: true,
    inputSet: ["poc/fixtures/p0b", "poc/scripts/gate-p0b.mjs"]
  },
  p0c: {
    gate: "P0c",
    title: "Korean TTS, CJK render, OCR, and stress evidence",
    script: "poc/scripts/gate-p0c.mjs",
    legacyReport: "poc/reports/P0c-report.json",
    render: false,
    inputSet: [
      "poc/fixtures/p0c",
      "poc/reports/p0c-ocr.json",
      "poc/reports/p0c-stress.json",
      "poc/scripts/gate-p0c.mjs",
      "poc/scripts/p0c-ocr.mjs",
      "poc/scripts/p0c-stress.mjs"
    ]
  },
  p0d: {
    gate: "P0d",
    title: "edit loop, selective re-TTS, and full recompile",
    script: "poc/scripts/gate-p0d.mjs",
    legacyReport: "poc/reports/P0d-report.json",
    render: true,
    inputSet: ["poc/fixtures/p0d", "poc/scripts/compile-p0d.mjs", "poc/scripts/gate-p0d.mjs"]
  }
};

export function listGates() {
  return Object.entries(gateRegistry).map(([id, gate]) => ({
    id,
    gate: gate.gate,
    title: gate.title,
    render: gate.render,
    script: gate.script,
    legacyReport: gate.legacyReport
  }));
}

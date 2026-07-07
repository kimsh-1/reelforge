import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const DEFAULT_EDGE_VOICE = "ko-KR-SunHiNeural";
export const EDGE_VOICE_ALIASES = new Map([
  ["sunhi", "ko-KR-SunHiNeural"],
  ["female", "ko-KR-SunHiNeural"],
  ["ko-KR-SunHiNeural", "ko-KR-SunHiNeural"],
  ["injoon", "ko-KR-InJoonNeural"],
  ["male", "ko-KR-InJoonNeural"],
  ["ko-KR-InJoonNeural", "ko-KR-InJoonNeural"]
]);

const VALID_PROVIDERS = new Set(["auto", "edge", "melo"]);

function boolValue(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function intValue(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function resolveMaybePath(root, value, fallback) {
  const raw = value || fallback;
  return path.isAbsolute(raw) ? raw : path.join(root, raw);
}

function readProjectConfig(projectDir) {
  const configPath = path.join(projectDir, "tts.config.json");
  if (!existsSync(configPath)) return {};
  return JSON.parse(readFileSync(configPath, "utf8"));
}

function normalizeProvider(value) {
  const provider = String(value || "auto").trim().toLowerCase();
  if (!VALID_PROVIDERS.has(provider)) {
    throw new Error(`invalid TTS provider "${value}"; expected auto, edge, or melo`);
  }
  return provider;
}

export function normalizeEdgeVoice(value = DEFAULT_EDGE_VOICE) {
  const voice = EDGE_VOICE_ALIASES.get(String(value).trim());
  if (!voice) {
    throw new Error(`unsupported Korean edge-tts voice "${value}"; expected ko-KR-SunHiNeural or ko-KR-InJoonNeural`);
  }
  return voice;
}

export function loadTtsConfig({ repoRoot, projectDir, env = process.env, overrides = {} }) {
  const projectConfig = readProjectConfig(projectDir);
  const edgeConfig = projectConfig.edge ?? {};
  const meloConfig = projectConfig.melo ?? {};
  const whisperConfig = projectConfig.whisper ?? {};

  const provider = normalizeProvider(overrides.provider ?? env.VF_TTS_PROVIDER ?? projectConfig.provider ?? "auto");
  const edgeVoice = normalizeEdgeVoice(
    overrides.edgeVoice ??
      overrides.voice ??
      env.VF_TTS_EDGE_VOICE ??
      env.VF_TTS_VOICE ??
      edgeConfig.voice ??
      DEFAULT_EDGE_VOICE
  );

  return {
    provider,
    concurrency: intValue(overrides.concurrency ?? env.VF_TTS_CONCURRENCY ?? projectConfig.concurrency, 4, {
      min: 1,
      max: 4
    }),
    forceRetts: boolValue(overrides.forceRetts ?? env.VF_TTS_FORCE ?? projectConfig.forceRetts, false),
    backoffMs: intValue(overrides.backoffMs ?? env.VF_TTS_BACKOFF_MS ?? projectConfig.backoffMs, 1200, {
      min: 0,
      max: 30000
    }),
    edge: {
      voice: edgeVoice,
      rate: overrides.rate ?? env.VF_TTS_EDGE_RATE ?? edgeConfig.rate ?? "+0%",
      pitch: overrides.pitch ?? env.VF_TTS_EDGE_PITCH ?? edgeConfig.pitch ?? "+0Hz",
      volume: overrides.volume ?? env.VF_TTS_EDGE_VOLUME ?? edgeConfig.volume ?? "+0%",
      timeoutMs: intValue(overrides.edgeTimeoutMs ?? env.VF_TTS_EDGE_TIMEOUT_MS ?? edgeConfig.timeoutMs, 45000, {
        min: 1000,
        max: 300000
      }),
      venvPath: resolveMaybePath(
        repoRoot,
        overrides.edgeVenvPath ?? env.VF_TTS_EDGE_VENV ?? edgeConfig.venvPath,
        ".venv-tts"
      ),
      pythonBin: overrides.pythonBin ?? env.VF_TTS_PYTHON ?? edgeConfig.pythonBin ?? "python3",
      allowInstall: boolValue(overrides.allowInstall ?? env.VF_TTS_ALLOW_INSTALL ?? edgeConfig.allowInstall, true)
    },
    melo: {
      voice: "KR",
      speed: Number(overrides.meloSpeed ?? env.VF_TTS_MELO_SPEED ?? meloConfig.speed ?? 1.0),
      device: overrides.meloDevice ?? env.VF_TTS_MELO_DEVICE ?? meloConfig.device ?? "cpu",
      timeoutMs: intValue(overrides.meloTimeoutMs ?? env.VF_TTS_MELO_TIMEOUT_MS ?? meloConfig.timeoutMs, 180000, {
        min: 1000,
        max: 900000
      }),
      venvPath: resolveMaybePath(
        repoRoot,
        overrides.meloVenvPath ?? env.VF_TTS_MELO_VENV ?? meloConfig.venvPath,
        ".venv-melotts"
      )
    },
    whisper: {
      pythonBin: overrides.whisperPython ?? env.VF_TTS_WHISPER_PYTHON ?? whisperConfig.pythonBin ?? null,
      model: overrides.whisperModel ?? env.VF_TTS_WHISPER_MODEL ?? whisperConfig.model ?? "base",
      device: overrides.whisperDevice ?? env.VF_TTS_WHISPER_DEVICE ?? whisperConfig.device ?? "cpu",
      computeType: overrides.whisperComputeType ?? env.VF_TTS_WHISPER_COMPUTE_TYPE ?? whisperConfig.computeType ?? "int8",
      timeoutMs: intValue(overrides.whisperTimeoutMs ?? env.VF_TTS_WHISPER_TIMEOUT_MS ?? whisperConfig.timeoutMs, 180000, {
        min: 1000,
        max: 900000
      })
    },
    ffmpegBin: overrides.ffmpegBin ?? env.FFMPEG_BIN ?? projectConfig.ffmpegBin ?? "ffmpeg",
    ffprobeBin: overrides.ffprobeBin ?? env.FFPROBE_BIN ?? projectConfig.ffprobeBin ?? "ffprobe"
  };
}

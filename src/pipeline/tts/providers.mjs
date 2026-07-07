import { spawn } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ttsDir = path.dirname(fileURLToPath(import.meta.url));
const edgeRuntimePromises = new Map();

export class TtsProviderError extends Error {
  constructor(message, { code = "provider-error", retryable = false, stdout = "", stderr = "" } = {}) {
    super(message);
    this.name = "TtsProviderError";
    this.code = code;
    this.retryable = retryable;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

export function isRetryableTtsError(error) {
  if (error?.retryable === true) return true;
  const text = `${error?.message ?? ""}\n${error?.stdout ?? ""}\n${error?.stderr ?? ""}`.toLowerCase();
  return [
    "403",
    "429",
    "timeout",
    "timed out",
    "etimedout",
    "econnreset",
    "connection reset",
    "network is unreachable",
    "temporary failure",
    "name or service not known",
    "could not fetch url",
    "proxy error"
  ].some((needle) => text.includes(needle));
}

function pythonInVenv(venvPath) {
  return path.join(venvPath, "bin", "python");
}

function commandError(command, args, result, timedOut = false) {
  const text = [`${command} ${args.join(" ")}`, result.stderr, result.stdout].filter(Boolean).join("\n");
  return new TtsProviderError(text.trim(), {
    code: timedOut ? "timeout" : "process-failed",
    retryable: timedOut || isRetryableTtsError({ message: text }),
    stdout: result.stdout,
    stderr: result.stderr
  });
}

export function runProcess(command, args, { cwd, input = "", env = process.env, timeoutMs = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 1000).unref();
    }, timeoutMs);
    timer.unref();

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(
        new TtsProviderError(error.message, {
          code: "spawn-error",
          retryable: isRetryableTtsError(error)
        })
      );
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const result = { stdout, stderr, code, signal };
      if (timedOut || code !== 0) reject(commandError(command, args, result, timedOut));
      else resolve(result);
    });
    if (input) child.stdin.end(input);
    else child.stdin.end();
  });
}

async function ensurePythonImport(pythonBin, moduleName, timeoutMs = 30000) {
  await runProcess(pythonBin, ["-c", `import ${moduleName}`], { timeoutMs });
}

async function ensureEdgeRuntime(config) {
  const venvPath = config.edge.venvPath;
  const pending = edgeRuntimePromises.get(venvPath);
  if (pending) return pending;

  const promise = ensureEdgeRuntimeUncached(config);
  edgeRuntimePromises.set(venvPath, promise);
  try {
    return await promise;
  } catch (error) {
    edgeRuntimePromises.delete(venvPath);
    throw error;
  }
}

async function ensureEdgeRuntimeUncached(config) {
  const venvPath = config.edge.venvPath;
  const pythonBin = pythonInVenv(venvPath);
  if (!existsSync(pythonBin)) {
    mkdirSync(path.dirname(venvPath), { recursive: true });
    await runProcess(config.edge.pythonBin, ["-m", "venv", venvPath], { timeoutMs: 120000 });
  }

  try {
    await ensurePythonImport(pythonBin, "edge_tts");
  } catch (error) {
    if (!config.edge.allowInstall) throw error;
    await runProcess(
      pythonBin,
      ["-m", "pip", "install", "--disable-pip-version-check", "edge-tts==7.2.8"],
      { timeoutMs: 180000 }
    );
    await ensurePythonImport(pythonBin, "edge_tts");
  }
  return pythonBin;
}

function assertOutputFile(filePath, label) {
  if (!existsSync(filePath) || !statSync(filePath).isFile() || statSync(filePath).size === 0) {
    throw new TtsProviderError(`${label} did not create a non-empty output file: ${filePath}`, {
      code: "empty-output",
      retryable: false
    });
  }
}

function parseProviderJson(stdout, label) {
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new TtsProviderError(`${label} returned invalid JSON: ${error.message}\n${stdout}`.trim(), {
      code: "invalid-json",
      retryable: false,
      stdout
    });
  }
}

async function edgeSynthesize({ text, outputPath, config }) {
  const pythonBin = await ensureEdgeRuntime(config);
  const payload = {
    text,
    outputPath,
    voice: config.edge.voice,
    rate: config.edge.rate,
    pitch: config.edge.pitch,
    volume: config.edge.volume
  };
  const result = await runProcess(pythonBin, [path.join(ttsDir, "edge_synth.py")], {
    input: JSON.stringify(payload),
    timeoutMs: config.edge.timeoutMs
  });
  assertOutputFile(outputPath, "edge-tts");
  const data = parseProviderJson(result.stdout, "edge-tts");
  return {
    provider: "edge-tts",
    voice: data.voice ?? config.edge.voice,
    words: data.words ?? []
  };
}

async function resolveMeloPython(config) {
  const pythonBin = pythonInVenv(config.melo.venvPath);
  if (!existsSync(pythonBin)) {
    throw new TtsProviderError(
      `MeloTTS venv is missing at ${config.melo.venvPath}; run bash src/pipeline/tts/bootstrap-melo.sh first`,
      { code: "melo-missing", retryable: false }
    );
  }
  await ensurePythonImport(pythonBin, "melo");
  return pythonBin;
}

async function resolveWhisperPython(config, fallbackPython) {
  const candidates = [config.whisper.pythonBin, fallbackPython, config.edge.pythonBin].filter(Boolean);
  const seen = new Set();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    try {
      await ensurePythonImport(candidate, "faster_whisper");
      return candidate;
    } catch {
      // Try the next configured interpreter.
    }
  }
  throw new TtsProviderError(
    "faster-whisper is unavailable; set VF_TTS_WHISPER_PYTHON or install it in the MeloTTS venv",
    { code: "whisper-missing", retryable: false }
  );
}

async function meloSynthesize({ text, outputPath, config }) {
  const meloPython = await resolveMeloPython(config);
  const wavPath = `${outputPath}.melo.wav`;
  const payload = {
    text,
    outputPath: wavPath,
    language: "KR",
    speaker: config.melo.voice,
    speed: config.melo.speed,
    device: config.melo.device
  };
  await runProcess(meloPython, [path.join(ttsDir, "melo_synth.py")], {
    input: JSON.stringify(payload),
    timeoutMs: config.melo.timeoutMs
  });
  assertOutputFile(wavPath, "MeloTTS");

  await runProcess(
    config.ffmpegBin,
    ["-v", "error", "-i", wavPath, "-codec:a", "libmp3lame", "-b:a", "128k", "-y", outputPath],
    { timeoutMs: 120000 }
  );
  assertOutputFile(outputPath, "MeloTTS mp3 conversion");

  const whisperPython = await resolveWhisperPython(config, meloPython);
  const alignPayload = {
    audioPath: outputPath,
    model: config.whisper.model,
    device: config.whisper.device,
    computeType: config.whisper.computeType,
    language: "ko"
  };
  const result = await runProcess(whisperPython, [path.join(ttsDir, "whisper_align.py")], {
    input: JSON.stringify(alignPayload),
    timeoutMs: config.whisper.timeoutMs
  });
  const data = parseProviderJson(result.stdout, "faster-whisper");
  return {
    provider: "melotts-korean+faster-whisper",
    voice: `MeloTTS-${config.melo.voice}`,
    words: data.words ?? []
  };
}

export function createDefaultProviders() {
  return {
    edge: {
      synthesize: edgeSynthesize
    },
    melo: {
      synthesize: meloSynthesize
    }
  };
}

import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

export const PIPELINE_LOCK_FILE = ".pipeline/pipeline.lock";

export class PipelineLockError extends Error {
  constructor(message = "다른 실행 진행 중", owner = null) {
    super(message);
    this.name = "PipelineLockError";
    this.owner = owner;
  }
}

function lockPath(projectDir) {
  return path.join(projectDir, PIPELINE_LOCK_FILE);
}

function readLockOwner(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function writeNewLock(filePath, owner) {
  const fd = openSync(filePath, "wx");
  try {
    writeFileSync(fd, `${JSON.stringify(owner, null, 2)}\n`);
  } finally {
    closeSync(fd);
  }
}

export function acquirePipelineLock({ projectDir, command = "vf pipeline run" }) {
  const filePath = lockPath(projectDir);
  mkdirSync(path.dirname(filePath), { recursive: true });
  const token = `${process.pid}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
  const owner = {
    pid: process.pid,
    token,
    command,
    acquiredAt: new Date().toISOString()
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      writeNewLock(filePath, owner);
      return {
        filePath,
        owner,
        release() {
          const current = readLockOwner(filePath);
          if (current?.token === token) rmSync(filePath, { force: true });
        }
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const current = readLockOwner(filePath);
      if (processIsAlive(current?.pid)) {
        throw new PipelineLockError("다른 실행 진행 중", current);
      }
      rmSync(filePath, { force: true });
    }
  }

  throw new PipelineLockError("다른 실행 진행 중", readLockOwner(filePath));
}

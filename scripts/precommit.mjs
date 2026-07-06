#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const steps = [
  ["npm", ["run", "lint"]],
  ["node", ["bin/vf", "gate", "l0-1"]]
];

for (const [command, args] of steps) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

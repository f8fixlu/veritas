// Cross-platform launcher: routes npm run deploy / publish to the
// correct shell script for the current operating system.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { spawnSync } = require("child_process");
const path = require("path");

const isWin = process.platform === "win32";
const task = process.argv[2];
const extra = process.argv.slice(3);

const commands = {
  deploy: isWin
    ? [
        "powershell",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join("scripts", "deploy.ps1"),
      ]
    : ["bash", path.join("scripts", "deploy.sh")],
  update: isWin
    ? null
    : ["bash", path.join("scripts", "update.sh")],
  publish: isWin
    ? [
        "powershell",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join("scripts", "publish.ps1"),
      ]
    : ["bash", path.join("scripts", "publish.sh")],
};

if (!(task in commands)) {
  console.error(`Unknown task: ${task}. Use deploy, update, or publish.`);
  process.exit(1);
}
if (!commands[task]) {
  console.error("Error: 'update' runs on the server (needs systemd). Use deploy on Windows.");
  process.exit(1);
}

const result = spawnSync(commands[task][0], [...commands[task].slice(1), ...extra], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);

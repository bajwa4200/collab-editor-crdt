import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(fileURLToPath(import.meta.url), "..", "..");

const server = spawn("npm", ["run", "build", "-w", "server"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

server.on("exit", (code) => {
  if (code !== 0) process.exit(code ?? 1);
  const proc = spawn("node", ["server/dist/server.js"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, PORT: "8787" },
  });
  const client = spawn("npm", ["run", "dev", "-w", "client"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
  proc.on("exit", (c) => process.exit(c ?? 0));
  client.on("exit", (c) => process.exit(c ?? 0));
});

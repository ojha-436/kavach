/**
 * Serves the standalone build the same way the container does.
 *
 * `next start` and `node .next/standalone/server.js` are not the same server,
 * and Next says so out loud when you mix them. Since the e2e and axe suites
 * exist to catch things the dev server hides — CSP headers, static prerender
 * output, the pre-paint theme script — running them against a server we do not
 * ship would quietly narrow what they can catch.
 *
 * This mirrors the Dockerfile's assembly step: the standalone output does not
 * include .next/static or public/, so both are copied in before booting.
 */
import { cp, access } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

try {
  await access(path.join(standalone, "server.js"));
} catch {
  console.error("No standalone build found. Run `npm run build` first.");
  process.exit(1);
}

await cp(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), {
  recursive: true,
});
await cp(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });

// rules/ is read at runtime by the rule pack loader; the container copies it too.
await cp(path.join(root, "rules"), path.join(standalone, "rules"), { recursive: true });

const port = process.env.PORT ?? "3100";
spawn(process.execPath, [path.join(standalone, "server.js")], {
  stdio: "inherit",
  env: { ...process.env, PORT: port, HOSTNAME: "127.0.0.1" },
}).on("exit", (code) => process.exit(code ?? 0));

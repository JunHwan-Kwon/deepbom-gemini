import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scratch = await mkdtemp(path.join(tmpdir(), "deepbom-gemini-host-"));
const env = { ...process.env, GEMINI_CLI_HOME: scratch, GEMINI_CLI_NO_RELAUNCH: "1", NO_COLOR: "1", CI: "1" };
// Resolve the JS entry through npm so Windows does not need a shell or .cmd quoting.
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npmRoot = execFileSync(npm, ["root", "-g"], { encoding: "utf8", shell: process.platform === "win32" }).trim();
const gemini = path.join(npmRoot, "@google", "gemini-cli", "bundle", "gemini.js");
function run(args, input = "") {
  const result = spawnSync(process.execPath, [gemini, ...args], { cwd: root, env, encoding: "utf8", timeout: 60000, killSignal: "SIGKILL", input, stdio: ["pipe", "pipe", "pipe"] });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  assert.equal(result.status, 0, `${args.join(" ")}: ${result.error?.message || output}`);
  return output;
}
try {
  console.log(`Gemini CLI ${run(["--version"]).trim()}`);
  console.log(run(["extensions", "install", root, "--consent"], "y\n"));
  const extensions = run(["extensions", "list"]);
  assert.match(extensions, /deepbom/);
  console.log(extensions);
  const servers = run(["mcp", "list"]);
  assert.match(servers, /deepbom/);
  assert.match(servers, /Connected/i);
  assert.doesNotMatch(servers, /Disconnected|Failed/i);
  console.log(servers);
  console.log("Gemini CLI loaded the extension and connected to its MCP server. No model API call was made.");
} finally { await rm(scratch, { recursive: true, force: true }); }

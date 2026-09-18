import { realpathSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Use cwd as the engine's single allowed root. Do not inherit a broader root
// allowlist, and do not split paths that contain the platform list delimiter.
const workspace = process.argv[2];
if (process.argv.length !== 3 || !workspace || !path.isAbsolute(workspace)) {
  console.error("DEEPBOM requires the absolute Gemini workspace path. Restart Gemini CLI from your model directory.");
  process.exit(1);
}
try {
  const root = realpathSync(workspace);
  if (!statSync(root).isDirectory()) throw new Error("The workspace must be a directory.");
  process.chdir(root);
  delete process.env.DEEPBOM_MCP_ALLOWED_ROOTS;
  const entry = new URL("./vendor/deepbom/bin/deepbom.mjs", import.meta.url);
  process.argv = [process.execPath, fileURLToPath(entry), "mcp"];
  await import(entry.href);
} catch (error) {
  console.error(`DEEPBOM could not start: ${error.message}`);
  process.exitCode = 1;
}

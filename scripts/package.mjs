import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import AdmZip from "adm-zip";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
execFileSync(process.execPath, [path.join(root, "scripts", "vendor.mjs"), "--check"], { stdio: "inherit" });
const manifest = JSON.parse(await readFile(path.join(root, "gemini-extension.json"), "utf8"));
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
assert.equal(manifest.version, pkg.version);
const zip = new AdmZip();
async function add(name) {
  const file = path.join(root, name);
  const { stat } = await import("node:fs/promises");
  if ((await stat(file)).isDirectory()) {
    for (const child of (await readdir(file)).sort()) await add(`${name}/${child}`);
  } else {
    zip.addFile(name, await readFile(file));
    zip.getEntry(name).header.time = new Date(1980, 0, 1);
  }
}
for (const name of ["gemini-extension.json", "GEMINI.md", "server.mjs", "commands", "vendor", "README.md", "LICENSE", "NOTICE", "VALIDATION.md"]) await add(name);
const out = path.join(root, "dist");
await mkdir(out, { recursive: true });
const name = `deepbom-gemini-${manifest.version}.zip`;
const bytes = zip.toBuffer();
await writeFile(path.join(out, name), bytes);
await writeFile(path.join(out, "SHA256SUMS"), `${createHash("sha256").update(bytes).digest("hex")}  ${name}\n`);
console.log(`Packaged ${name} (${bytes.length} bytes), with manifest at archive root.`);

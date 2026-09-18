import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "node_modules", "deepbom");
const target = path.join(root, "vendor", "deepbom");
const config = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const engine = JSON.parse(await readFile(path.join(source, "package.json"), "utf8"));
assert.equal(engine.version, config.devDependencies.deepbom);
// Copy only the already-public npm distribution, never private monorepo files.
const files = ["LICENSE", "README.md", "package.json", "bin/deepbom.mjs", "bin/deepbom-self-test.onnx", "pkg/release-manifest.json", "pkg/tflite_wasm_audit_bg.wasm"].sort();
const hashes = {};
for (const name of files) hashes[name] = createHash("sha256").update(await readFile(path.join(source, name))).digest("hex");
const lock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
const receipt = {
  name: engine.name, version: engine.version,
  source: `https://registry.npmjs.org/deepbom/-/deepbom-${engine.version}.tgz`,
  npm_integrity: lock.packages["node_modules/deepbom"].integrity,
  files: hashes,
};
if (process.argv.includes("--check")) {
  const actualFiles = [];
  async function collect(dir, prefix = "") {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const name = prefix + entry.name;
      if (entry.isDirectory()) await collect(path.join(dir, entry.name), `${name}/`);
      else { assert.ok(entry.isFile(), `Unexpected entry: ${name}`); actualFiles.push(name); }
    }
  }
  await collect(target);
  assert.deepEqual(actualFiles.sort(), files);
  for (const name of files) assert.equal(createHash("sha256").update(await readFile(path.join(target, name))).digest("hex"), hashes[name], name);
  assert.deepEqual(JSON.parse(await readFile(path.join(root, "vendor", "provenance.json"), "utf8")), receipt);
  console.log(`Verified bundled DEEPBOM ${engine.version} against npm lockfile and ${files.length} published files.`);
} else {
  await rm(target, { recursive: true, force: true });
  for (const name of files) {
    await mkdir(path.dirname(path.join(target, name)), { recursive: true });
    await cp(path.join(source, name), path.join(target, name));
  }
  await writeFile(path.join(root, "vendor", "provenance.json"), JSON.stringify(receipt, null, 2) + "\n");
  console.log(`Bundled DEEPBOM ${engine.version}.`);
}

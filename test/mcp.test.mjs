import test from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, readFile, copyFile, rm, writeFile, mkdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import AdmZip from "adm-zip";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

async function exercise(extensionRoot) {
  const work = await mkdtemp(path.join(tmpdir(), "deepbom gemini "));
  const workspace = path.join(work, process.platform === "win32" ? "model folder" : "model:folder");
  await mkdir(workspace);
  const fixture = path.join(workspace, "model with spaces.onnx");
  const source = path.join(extensionRoot, "vendor", "deepbom", "bin", "deepbom-self-test.onnx");
  await copyFile(source, fixture);
  const manifest = JSON.parse(await readFile(path.join(extensionRoot, "gemini-extension.json"), "utf8"));
  const config = manifest.mcpServers.deepbom;
  const expand = value => value.replaceAll("${extensionPath}", extensionRoot).replaceAll("${workspacePath}", workspace);
  const child = spawn(process.execPath, config.args.map(expand), {
    cwd: expand(config.cwd), env: { ...process.env, DEEPBOM_MCP_ALLOWED_ROOTS: work },
    stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
  });
  const waiters = new Map();
  let buffer = "", stderr = "", nextId = 0;
  child.stderr.on("data", chunk => { stderr += chunk; });
  const closed = new Promise(resolve => child.on("close", resolve));
  const rejectAll = error => { for (const w of waiters.values()) { clearTimeout(w.timer); w.reject(error); } waiters.clear(); };
  child.on("error", rejectAll);
  child.on("close", code => rejectAll(new Error(`MCP closed (${code}): ${stderr}`)));
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", chunk => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl); buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let frame;
      try { frame = JSON.parse(line); } catch (error) { rejectAll(error); return; }
      const w = waiters.get(frame.id);
      if (!w) continue;
      clearTimeout(w.timer); waiters.delete(frame.id);
      frame.error ? w.reject(new Error(frame.error.message)) : w.resolve(frame.result);
    }
  });
  const request = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { waiters.delete(id); reject(new Error(`Timeout: ${method}`)); }, 20000);
    waiters.set(id, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
  const call = (name, args) => request("tools/call", { name, arguments: args });
  try {
    const init = await request("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "deepbom-gemini-test", version: "1.0.0" } });
    assert.equal(init.serverInfo.version, "1.103.0");
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
    const tools = (await request("tools/list")).tools;
    assert.deepEqual(tools.map(t => t.name), ["deepbom_capabilities", "deepbom_audit", "deepbom_diff", "deepbom_explain_rule"]);
    const caps = JSON.parse((await call("deepbom_capabilities", {})).content[0].text);
    assert.equal(caps.privacy.analysis_location, "local_process");
    assert.equal(caps.privacy.model_bytes_network_transfer, false);
    const audit = await call("deepbom_audit", { path: path.basename(fixture), output_format: "json-compact", section: "summary" });
    assert.ok(!audit.isError, JSON.stringify(audit));
    const summary = JSON.parse(audit.content[0].text).sections.summary;
    const sha = digest(await readFile(fixture));
    assert.equal(summary.artifact.sha256, sha);
    assert.equal(summary.verdict.artifact_defect_count, summary.findings.artifact_defects.length);
    assert.equal(summary.verdict.caution_count, summary.findings.cautions.length);
    assert.equal(summary.verdict.evidence_needed_count, summary.findings.evidence_needed.length);
    assert.ok(summary.findings.cautions.length > 0);
    const detail = await call("deepbom_audit", { path: fixture, output_format: "json-compact", section: "model_summary", expected_sha256: sha });
    assert.ok(!detail.isError, JSON.stringify(detail));
    const model = JSON.parse(detail.content[0].text).sections.model_summary;
    assert.equal(model.artifact.sha256, sha);
    assert.ok(model.rows.length > 0);
    assert.equal(model.projection.ordering.runtime_order_claim, false);
    const comparison = await call("deepbom_diff", { baseline: fixture, candidate: fixture });
    assert.ok(!comparison.isError, JSON.stringify(comparison));
    const diff = JSON.parse(comparison.content[0].text);
    assert.equal(diff.schema, "deepbom.semantic_artifact_diff.v1");
    assert.equal(diff.baseline.sha256, sha);
    assert.equal(diff.candidate.sha256, sha);
    const badHash = await call("deepbom_audit", { path: fixture, expected_sha256: "0".repeat(64) });
    assert.equal(badHash.isError, true);
    const outsideFile = path.join(work, "outside.onnx");
    await copyFile(source, outsideFile);
    assert.equal((await call("deepbom_audit", { path: outsideFile })).isError, true, "inherited broad roots cannot expand access");
    const link = path.join(workspace, "escape");
    await symlink(work, link, process.platform === "win32" ? "junction" : "dir");
    assert.equal((await call("deepbom_audit", { path: path.join(link, "outside.onnx") })).isError, true, "symlinks cannot escape the workspace");
    const safetensors = path.join(workspace, "weight.safetensors");
    const header = Buffer.from(JSON.stringify({ weight: { dtype: "F32", shape: [1], data_offsets: [0, 4] } }).padEnd(72, " "));
    const length = Buffer.alloc(8); length.writeBigUInt64LE(BigInt(header.length));
    const value = Buffer.alloc(4); value.writeFloatLE(1);
    const bytes = Buffer.concat([length, header, value]);
    await writeFile(safetensors, bytes);
    const tensorResult = await call("deepbom_audit", { path: safetensors, output_format: "json-compact", section: "summary" });
    assert.ok(!tensorResult.isError, JSON.stringify(tensorResult));
    assert.equal(JSON.parse(tensorResult.content[0].text).sections.summary.artifact.sha256, digest(bytes));
  } finally {
    child.stdin.end();
    const timer = setTimeout(() => child.kill(), 2000);
    await closed; clearTimeout(timer);
    await rm(work, { recursive: true, force: true });
  }
}

test("repository extension: real MCP analysis and workspace isolation", { timeout: 90000 }, () => exercise(root));
test("release archive: self-contained installation and real MCP analysis", { timeout: 90000 }, async () => {
  execFileSync(process.execPath, [path.join(root, "scripts", "package.mjs")], { cwd: root, stdio: "pipe" });
  const manifest = JSON.parse(await readFile(path.join(root, "gemini-extension.json"), "utf8"));
  const archive = path.join(root, "dist", `deepbom-gemini-${manifest.version}.zip`);
  const zip = new AdmZip(archive);
  assert.ok(zip.getEntry("gemini-extension.json"));
  assert.ok(!zip.getEntry("node_modules/"));
  const extracted = await mkdtemp(path.join(tmpdir(), "deepbom extension "));
  try {
    zip.extractAllTo(extracted);
    await exercise(extracted);
    const first = digest(await readFile(archive));
    execFileSync(process.execPath, [path.join(root, "scripts", "package.mjs")], { cwd: root, stdio: "pipe" });
    assert.equal(digest(await readFile(archive)), first, "rebuilding the same release is deterministic");
  } finally { await rm(extracted, { recursive: true, force: true }); }
});

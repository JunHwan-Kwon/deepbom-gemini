# DEEPBOM for Gemini CLI

Inspect AI model deployment artifacts locally without executing model code. Report the full SHA-256, serialized structure, quantization evidence, artifact defects, cautions, and evidence gaps in your Gemini CLI conversation.

Extension **1.0.0** includes **DEEPBOM 1.103.0**. The engine is bundled: installation needs no separate DEEPBOM setup or npm download at analysis time. This is an independently maintained community extension.

## Install

Install [Gemini CLI](https://geminicli.com/docs/get-started/installation/) and use a supported Gemini sign-in method. Node.js 20 or newer must be on `PATH` for DEEPBOM; Gemini CLI itself may require a newer Node version. From your terminal, outside an interactive Gemini session:

```sh
gemini extensions install https://github.com/JunHwan-Kwon/deepbom-gemini
```

Review and accept the extension installation prompt. Then open a terminal in the directory containing your model files and start `gemini`. Run `/mcp` to check that **deepbom** is connected. Restart any Gemini session that was already running.

The same extension is used on Windows, macOS, and Linux. See [VALIDATION.md](VALIDATION.md) for tested hosts and limits. The extension can read models only beneath the directory where Gemini CLI starts; additional workspace folders are not implicitly included. Start a new session in a different directory to change that boundary. If you already have a manually configured `deepbom` server, inspect it first: Gemini gives that configuration precedence over this extension. Remove the old entry only if you intend to replace it.

## Inspect and compare

Inside Gemini CLI:

```text
/deepbom:inspect ./model.onnx
```

For an operation table:

```text
/deepbom:inspect ./model.onnx. Include the operation table and output shapes.
```

For comparison, identify both paths and their roles:

```text
/deepbom:compare baseline ./before.onnx, candidate ./after.onnx
```

Check support and output options with `/deepbom:capabilities`. Natural-language requests work too:

```text
Use DEEPBOM to inspect ./model.onnx without executing model code.
Report the full SHA-256, structure, all defects, cautions, evidence gaps,
and the limits of the analysis.
```

Supported families include ONNX, TFLite, GGUF, SafeTensors, Core ML, and ExecuTorch. Exact coverage depends on artifact structure and sidecars. Interactive diagrams are available in the [web workspace](https://deepbom.org/) and [desktop app](https://deepbom.org/get-started/#desktop); this extension provides MCP tools and text evidence. A tool response is not automatically a downloaded report file.

## Tool permissions

The routine workflow requests one selected audit containing all findings. It calls capabilities when necessary and requests a separate model-summary table only when needed. This reduces redundant calls; the actual number depends on the request and host.

Gemini controls tool approvals. The extension does not set `trust`, install approval policies, or change your settings. The engine advertises audit and comparison tools as potentially downloading immutable remote artifacts into a local cache, so they are not blanket read-only tools. You can keep normal per-tool approval controls.

## Privacy and limitations

Local model bytes are read by the bundled analyzer, without executing model code or uploading those bytes to a DEEPBOM service. Tool results, including file names, hashes, structure, and findings, are returned to Gemini and handled under your Google account's applicable terms. Do not equate local parsing with an offline AI conversation. Explicitly requested immutable remote models may be downloaded into a local cache.

This extension adds no usage telemetry, browser identifiers, account collection, or hosted storage. Installation and updates contact GitHub. Findings are static evidence; they do not establish measured latency, task accuracy, actual hardware placement, clinical validity, or regulatory compliance. [Privacy](https://deepbom.org/privacy) · [Support](https://deepbom.org/support).

## Update or remove

```sh
gemini extensions update deepbom
gemini extensions uninstall deepbom
```

Run only the command for the action you want, then restart Gemini. Engine versions change with extension releases; the extension does not silently fetch the latest analyzer at startup.

## Offline installation and reproducibility

Download and extract the ZIP from [Releases](https://github.com/JunHwan-Kwon/deepbom-gemini/releases), then install that local directory:

```sh
gemini extensions install "/path/to/extracted/deepbom"
```

Use the actual directory containing `gemini-extension.json`. The release includes `SHA256SUMS`; `vendor/provenance.json` binds every bundled engine file to the pinned public npm distribution. The analyzer can inspect local files offline, while a normal Gemini conversation needs its own service connection.

## Development

```sh
npm ci --ignore-scripts
npm run check:vendor
npm test
npm run package
```

The repository and release ZIP both contain a ready-to-use engine. `npm run vendor` refreshes the bundled public npm files after an intentional engine-version change. The lockfile pins npm integrity, and CI checks the bundled file hashes before testing and packaging. No private DEEPBOM repository files are copied into this project.

Publication uses the `gemini-cli-extension` GitHub topic so the [official gallery crawler](https://geminicli.com/docs/extensions/releasing/) can discover it. Gallery appearance depends on Google's crawl and validation; a public repository is not a claim of Google endorsement or a Gemini web/mobile app listing.

Licensed under Apache-2.0. [DEEPBOM source](https://github.com/JunHwan-Kwon/deepbom).

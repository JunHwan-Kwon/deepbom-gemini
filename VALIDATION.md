# Validation

Extension: 1.0.0. Bundled analyzer: 1.103.0.

The automated suite starts the real bundled engine through the extension manifest over MCP. It checks artifact hashes, complete finding categories, operation-table evidence, comparisons, a second format, rejection of mismatched hashes, and the workspace boundary including symlinks. Both repository and release ZIP contents are tested.

GitHub Actions runs the suite on Linux, Windows, and macOS, and checks Gemini CLI extension installation and MCP connection. Workflow results are available in this repository's Actions tab.

Natural-language model responses and provider authentication are separate from extension loading and MCP protocol checks. They require a working Gemini account and are not implied by these tests. The extension does not supply a Google API key or change login settings.

## Local check — 18 September 2026

On Linux x64 with Node.js 24.12.0 and Gemini CLI 0.60.0:

- Installed the extension using `gemini extensions install` in an isolated Gemini configuration.
- `gemini extensions list` reported DEEPBOM 1.0.0 enabled and loaded `GEMINI.md`.
- `gemini mcp list` reported the extension's `deepbom` server as **Connected**.
- Both MCP integration tests passed, including the extracted release archive.
- Rebuilding the same ZIP produced the same SHA-256.

The host-loading check did not call the Gemini model API, modify the user's Gemini settings, or test a signed-in natural-language conversation. Run `/deepbom:inspect ./model.onnx` in your own signed-in Gemini session to check that final interaction.

# First-Party MCP Release-Incident Vertical Slice

**Status:** **Foundation implemented and validated.** `sentinelforge-tools` is a first-party, read-only MCP server mounted at `/api/mcp/sentinelforge-tools`. It replaces the previous dependency on the external GitHub MCP connector’s `resource.text` delivery behavior for the release-incident workflow.

## Safety Contract

| Control | Implementation |
| --- | --- |
| Allowed repository | Exactly `Aayushashsahu/sentinelforge-incident-fixture` |
| GitHub access | Backend-only `GITHUB_READ_TOKEN`; never returned, logged, or persisted |
| Permitted operations | Read repository metadata, decoded file text, issues, and workflow-run metadata |
| Prohibited operations | Any GitHub mutation, arbitrary repository access, token disclosure, sandbox execution, approval continuation, branch, commit, or pull request |
| MCP result format | Exactly ordinary `{ content: [{ type: "text", text: ... }] }`; no `EmbeddedResource` or `ResourceLink` |

The endpoint implements session-aware Streamable HTTP MCP transport. Each MCP client is assigned an isolated MCP session, allowing standard `initialize`, `notifications/initialized`, tool calls, and close semantics.

## Available Tools

| Tool | Input | Ordinary text output |
| --- | --- | --- |
| `get_repository` | `owner`, `repo` | Allowlisted repository metadata JSON |
| `get_file` | `owner`, `repo`, `path`, `ref` | Repository/path/ref header followed by decoded UTF-8 file body |
| `get_issue` | `owner`, `repo`, `issue_number` | Allowlisted issue JSON |
| `get_workflow_run` | `owner`, `repo`, `run_id` | Allowlisted Actions run JSON |

## Verified Fixture Evidence

An authenticated end-to-end MCP client connected to the local `sentinelforge-tools` endpoint and invoked `get_file` against the public incident fixture. All three calls returned one ordinary `text` block with actual decoded file body content:

| File | Verified body fact |
| --- | --- |
| `package.json` | Version is `1.4.0` |
| `release-manifest.json` | Version is `1.3.0` |
| `test.js` | Contains deterministic release-manifest/version validation logic |

This is **REAL** GitHub file data passing through the first-party MCP implementation. It supplies the narrow evidence needed for the fixture’s version-drift root cause without relying on GitHub MCP resource blocks.

## Investigator and Repairer Contract

The read-only Investigator and Repair Engineer policies now select only the explicit `sentinelforge-tools` tool names. Their prompts require ordinary file-text evidence and reject SHA, URI, filename, metadata, error strings, `EmbeddedResource`, and `ResourceLink` as source content. Both remain sandbox-disabled and have no write tools. Existing persistent mission, event, evidence, repair-proposal, deterministic verifier, approval, and idempotency boundaries are retained.

## Required Runtime Registration Before a Real Agent Turn

The external TrueForge runtime must register a remote MCP server named `sentinelforge-tools` pointing to the **published SentinelForge origin** plus:

```text
/api/mcp/sentinelforge-tools
```

The runtime must permit only `get_repository`, `get_file`, `get_issue`, and `get_workflow_run` for the Investigator and Repairer policies. SentinelForge cannot register this server through the currently exposed TrueForge HTTP API, and it does not modify TrueForge internals. Until the runtime owner registers the endpoint and confirms it is reachable from the runtime, a live TrueForge Investigator session using this MCP server is **BLOCKED**. No GitHub write is needed for that registration step.

The official registry example uses an `mcp_servers` entry with a `name` and `url`. The runtime owner should add the equivalent of the following to the runtime-owned registry, substituting the stable published SentinelForge origin (not a browser-visible secret and not a localhost URL):

```yaml
mcp_servers:
  - name: sentinelforge-tools
    url: https://<published-sentinelforge-origin>/api/mcp/sentinelforge-tools
```

No MCP header credential is required for the current public-fixture-only implementation. The GitHub read token remains inside SentinelForge and is never copied into the TrueForge registry.

## Quality and External-Action Status

The server has deterministic unit coverage for decoded ordinary-text output, token non-disclosure, and allowlist rejection. Its real MCP contract test passed using the fixture. The user has prohibited GitHub writes, so Qodo-backed source pull requests and all branch/commit/PR actions remain **BLOCKED / not attempted**. Sandbox verification remains separately blocked and is never represented as real.

The existing approval persistence and idempotency contracts remain intact, but they remain **GATED** behind the required ordered prerequisites: a real first-party-MCP Investigator result, a valid read-only repair proposal, a real verifier result, and a real approval-required event. No code path grants the Actor GitHub mutation capability before those prerequisites and an explicit new authorization.

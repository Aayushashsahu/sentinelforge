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

SentinelForge also exposes the token-safe read-only tRPC observation `tools.status`. It reports the MCP name, endpoint path, transport, allowlisted repository, four tool names, and boolean configuration state; it never returns the GitHub token and never enables a write action.

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

## Real TrueForge Investigator Outcome

After the runtime owner registered the first-party endpoint, SentinelForge read the actual TrueForge catalog and verified `sentinelforge-tools` was initialized with exactly the four declared read-only methods and no authentication requirement. One and only one real Investigator turn then completed:

| Correlation | Verified value |
| --- | --- |
| Mission | `SF_xF37FKFqr1NvtA` |
| TrueForge session | `01m0waamsttyeb0y0r3xxnvrff` |
| TrueForge turn | `01m0waaw5c98fxev1hybsk87qa.local` |
| Model | `nvidia-nim/nemotron-3-5-lightning-30b-a3b` |
| Mission state after ingestion | `PLANNING_FIX` |

The read-only session history confirmed use of `get_repository`, `get_file`, and `get_workflow_run`; no issue, sandbox, approval, or GitHub write tool was used. The Investigator persisted body-backed observations from `.github/workflows/test.yml`, `test.js`, `package.json`, and `release-manifest.json`. In particular, it recorded `package.json` `version: "1.4.0"`, `release-manifest.json` `version: "1.3.0"`, and the test logic that exits with code 1 when those values differ.

> **Root cause:** mismatched version strings between `package.json` and `release-manifest.json`.

The minimum repair is a read-only proposal to align `release-manifest.json` to the package version. No proposal was applied, no branch, commit, pull request, approval continuation, or sandbox verification was performed. This successful live outcome establishes that actual ordinary file text reached the model; it is not inferred from metadata.

## Separate Repair Engineer Authorization Boundary

The completed Investigator result supplies the required evidence basis for a Repair Engineer proposal, but it does **not** authorize a second agent turn. Before SentinelForge creates a Repair Engineer session, the owner must explicitly authorize exactly one new **read-only** turn for mission `SF_xF37FKFqr1NvtA`.

The permitted session must attach only `sentinelforge-tools`, use only its four read methods, keep sandbox and dynamic subagents disabled, and return one structured proposal. The expected minimal proposal is an un-applied patch to `release-manifest.json` changing `1.3.0` to `1.4.0`; it must persist as a proposal only. The turn must not create a branch, commit, pull request, GitHub write, approval continuation, or verification claim.

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

The requested Qodo Dev integration is not currently configured as a task connector. SentinelForge has therefore not requested a Qodo review and has not created a branch, commit, or pull request. A Qodo-backed review or PR remains a separate user-authorized step after a connector is available and the existing evidence, verification, approval, and GitHub-write gates have been satisfied.

The active TrueForge catalog was inspected and currently lists only its legacy `github` MCP server. The runtime’s supported MCP API is catalog-only; registration must be performed through the runtime host’s `mcp.yaml` configuration and reload process. See [TRUEFORGE_FIRST_PARTY_MCP_REGISTRATION_BLOCKER.md](./TRUEFORGE_FIRST_PARTY_MCP_REGISTRATION_BLOCKER.md) for the exact observed result and the safe host-side change.

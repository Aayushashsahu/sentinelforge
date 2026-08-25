# First-Party MCP Release-Incident Vertical Slice

**Status:** **Foundation implemented and validated.** `sentinelforge-tools` is a first-party, read-only MCP server mounted at `/api/mcp/sentinelforge-tools`. It replaces the previous dependency on the external GitHub MCP connector’s `resource.text` delivery behavior for the release-incident workflow.

## Safety Contract

| Control | Implementation |
| --- | --- |
| Allowed repository | Exactly `Aayushashsahu/sentinelforge-incident-fixture` |
| GitHub access | Backend-only `GITHUB_READ_TOKEN`; never returned, logged, or persisted |
| Permitted operations | Read repository metadata, decoded file text, issues, workflow-run metadata, and the constant-returning non-mutating `approval_probe` |
| Prohibited operations | Any GitHub mutation, arbitrary repository access, token disclosure, sandbox execution, approval continuation, branch, commit, or pull request |
| MCP result format | Exactly ordinary `{ content: [{ type: "text", text: ... }] }`; no `EmbeddedResource` or `ResourceLink` |

The endpoint implements session-aware Streamable HTTP MCP transport. Each MCP client is assigned an isolated MCP session, allowing standard `initialize`, `notifications/initialized`, tool calls, and close semantics.

SentinelForge also exposes the token-safe read-only tRPC observation `tools.status`. It reports the MCP name, endpoint path, transport, allowlisted repository, five tool names, and boolean configuration state; it never returns the GitHub token and never enables a write action.

## Available Tools

| Tool | Input | Ordinary text output |
| --- | --- | --- |
| `get_repository` | `owner`, `repo` | Allowlisted repository metadata JSON |
| `get_file` | `owner`, `repo`, `path`, `ref` | Repository/path/ref header followed by decoded UTF-8 file body |
| `get_issue` | `owner`, `repo`, `issue_number` | Allowlisted issue JSON |
| `get_workflow_run` | `owner`, `repo`, `run_id` | Allowlisted Actions run JSON |
| `approval_probe` | None | The constant `sentinelforge-approval-probe: harmless`; no mutation or network write |

The Investigator and Repair Engineer policies remain limited to the original four read tools. `approval_probe` is enabled only by the dedicated approval-mechanism agent, which uses TrueForge's source-verified literal-tool approval selector and disables sandboxing and all other tools. Its one authorized provider pause is recorded in [Approval Probe Feasibility](./APPROVAL_PROBE_FEASIBILITY.md).

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

## Real TrueForge Repair Engineer Outcome

After separate explicit authorization, one and only one additional **read-only** Repair Engineer session completed for the same mission. Its remote session history showed two actual `sentinelforge-tools` `get_file` calls, reading `release-manifest.json` and `package.json` at `main`. The model received ordinary file bodies and returned an evidence-backed object-shaped version proposal. The initial strict parser rejected the object-shaped patch, string evidence limitation, and descriptive `Low` risk; SentinelForge then performed a **read-only history recovery**, normalized only the bounded manifest-version shape, and persisted the proposal without creating a second session or turn.

| Correlation | Verified value |
| --- | --- |
| Mission | `SF_xF37FKFqr1NvtA` |
| TrueForge Repair Engineer session | `01m0wbj50nj21txhwzj9fk05qb` |
| TrueForge Repair Engineer turn | `01m0wbj6v8f0ych1e2aczmjtb9.local` |
| MCP methods called | `get_file` only, for `release-manifest.json` and `package.json` |
| Persisted mission state | `PLANNING_FIX` |
| Approval records / external-action records | `0` / `0` |

The persisted, un-applied equivalent unified diff is:

```diff
--- a/release-manifest.json
+++ b/release-manifest.json
@@
-  "version": "1.3.0"
+  "version": "1.4.0"
```

The Repair Engineer limited its evidence statement to the two read files and did not claim sandbox verification. The proposal remains un-applied, unverified, unapproved, and unsent to GitHub. No sandbox, Qodo, branch, commit, pull request, approval continuation, or GitHub write was invoked.

## Investigator and Repairer Contract

The read-only Investigator and Repair Engineer policies now select only the explicit `sentinelforge-tools` tool names. Their prompts require ordinary file-text evidence and reject SHA, URI, filename, metadata, error strings, `EmbeddedResource`, and `ResourceLink` as source content. Both remain sandbox-disabled and have no write tools. Existing persistent mission, event, evidence, repair-proposal, deterministic verifier, approval, and idempotency boundaries are retained.

## Resolved Runtime Registration

The external TrueForge runtime has registered a remote MCP server named `sentinelforge-tools` pointing to the **published SentinelForge origin** plus:

```text
/api/mcp/sentinelforge-tools
```

The runtime permits only `get_repository`, `get_file`, `get_issue`, and `get_workflow_run` for the Investigator and Repairer policies. The separate approval-probe policy selects only `approval_probe` and requires approval using its literal tool name. SentinelForge cannot register this server through the currently exposed TrueForge HTTP API and did not modify TrueForge internals; the runtime owner completed the host-side registration and SentinelForge validated the active catalog before either authorized live investigation turn.

The official registry example uses an `mcp_servers` entry with a `name` and `url`. The runtime owner should add the equivalent of the following to the runtime-owned registry, substituting the stable published SentinelForge origin (not a browser-visible secret and not a localhost URL):

```yaml
mcp_servers:
  - name: sentinelforge-tools
    url: https://<published-sentinelforge-origin>/api/mcp/sentinelforge-tools
```

No MCP header credential is required for the current public-fixture-only implementation. The GitHub read token remains inside SentinelForge and is never copied into the TrueForge registry.

## Quality and External-Action Status

The server has deterministic unit coverage for decoded ordinary-text output, token non-disclosure, and allowlist rejection. Its real MCP contract test passed using the fixture. The user has prohibited GitHub writes, so Qodo-backed source pull requests and all branch/commit/PR actions remain **BLOCKED / not attempted**. Sandbox verification remains separately blocked and is never represented as real.

The existing approval persistence and idempotency contracts remain intact. A genuine `tool.approval_required` event has now been captured and persisted for the non-mutating dedicated probe only; it does **not** satisfy the separate repair-verifier, repair-fingerprint, or GitHub-write prerequisites. No code path grants the Actor GitHub mutation capability before those prerequisites and an explicit new authorization.

The requested Qodo Dev integration is not currently configured as a task connector. SentinelForge has therefore not requested a Qodo review and has not created a branch, commit, or pull request. A Qodo-backed review or PR remains a separate user-authorized step after a connector is available and the existing evidence, verification, approval, and GitHub-write gates have been satisfied.

The runtime’s supported MCP API remains catalog-only, so registration remains a runtime-host concern. The Investigator and Repairer catalog policy remains the exact four read tools, while the dedicated approval-probe agent selects the separate harmless probe by literal name.

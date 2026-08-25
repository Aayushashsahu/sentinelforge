# GitHub MCP Resource-Text Delivery Blocker

**Date:** 2026-08-25  
**Status:** **BLOCKED at the TrueForge harness tool-result-to-model-context boundary.**

## Verified Trace

| Boundary | Verified observation |
| --- | --- |
| GitHub MCP response | GitHub's `get_file_contents` response can contain a normal acknowledgement followed by `{ "type": "resource", "resource": { "uri", "mimeType", "text" } }`. The body is `resource.text`, not the acknowledgement. [1] |
| TrueForge remote MCP client | The public `v0.1.4` `RemoteMCP.callTool()` returns the MCP SDK result without flattening it. [2] |
| **TrueForge tool-result conversion** | The public `v0.1.4` `packages/harness/src/core/mcp/executeToolCalls.ts` handles `result.content` by retaining only blocks whose type is `text`, then joining `c.text`. A `resource` block is excluded before the `LLMToolMessage` is built. [3] |
| TrueForge turn event | A newly authorized live session `01m0vr7xt5rh7rtpy56e7ggmh3` made a real configured GitHub MCP tool call. The raw event scan found **0** `resource`/`embeddedResource` blocks, and the final Investigator result was not parseable into evidence. |
| SentinelForge consumer | SentinelForge receives post-agent TrueForge SSE/history events. Its event sanitizer intentionally persists metadata only, but that is not the loss responsible for agent context: the public TrueForge source has already converted the tool result to text-only before the model turn. |

> The executable public `@truefoundry/trueforge@0.1.4` release is the source reference used for this trace. The active tunnel runtime's precise build version is not exposed by its documented `GET /healthz` response, and it accepts `agent.spec` where public `v0.1.4` source uses `agent_spec`; SentinelForge therefore does **not** claim exact binary parity. The observed live result is nevertheless consistent with the documented `v0.1.4` text-only conversion.

## Safe SentinelForge Handling

SentinelForge now has deterministic normalization coverage for MCP content it receives: plain `text`, `resource.text`, binary resource presence without decoding blobs, and `resource_link` metadata without fetching its URI. This code does not and cannot alter an agent's context after the remote harness has already dropped a resource block. The regression fixture proves that agent-visible normalized text contains `hello from the repository` when a `resource.text` block is present, and that SHA-only acknowledgements are not source text.

## One Live Read-Only Verification

The single newly authorized live verification used only the configured `github` MCP connector, explicitly selected `search_repositories` and `get_file_contents`, and instructed the Investigator to read only:

| Repository | Ref | Required paths | Result |
| --- | --- | --- | --- |
| `Aayushashsahu/sentinelforge` | `main` | `README.md`, `server/sentinelforge/workflow.ts`, `package.json` | A real GitHub MCP tool call was observed; no resource block, non-empty file body, or parseable body-backed Investigator evidence reached the event stream. |

No sandbox capability, custom GitHub client, direct GitHub REST call, curl request, Git CLI call, approval continuation, branch, commit, pull request, or other GitHub write was made.

## 2026-08-25 Patched-Runtime Verification Attempt

The runtime owner subsequently reported that the local `@truefoundry/trueforge@0.1.4` source had been patched, rebuilt, and restarted. SentinelForge made **exactly one** newly authorized read-only verification attempt with the constrained Investigator policy: `search_repositories`, then one `get_file_contents` request for `Aayushashsahu/sentinelforge` `README.md` at `main`. Before a session could be created, the initial read-only `GET /api/v1/models` request failed with Cloudflare Tunnel **HTTP 530 / Error 1033**: Cloudflare could not reach the tunnel origin.

| Check | Observed result |
| --- | --- |
| Runtime model catalogue | Not reached — HTTP 530 tunnel error before session creation. |
| TrueForge session / turn | Not created. |
| GitHub MCP tool call | Not made. |
| Raw MCP result blocks | None received. |
| Normalized resource text | None received. |
| Actual README body in Investigator context | **Not verified.** |

This is a transport availability failure, not a metadata-only result and not proof that the local patch failed. Because the user authorized one verification only, SentinelForge did not retry. Once the tunnel origin is reachable again, the runtime owner must explicitly authorize a fresh one-attempt verification.

### Fresh post-recovery authorization

The runtime owner later confirmed that `/healthz` was healthy and explicitly authorized one fresh model-catalogue preflight plus one README MCP read. SentinelForge performed that one attempt at 2026-08-25T07:57:32Z. The required `GET /api/v1/models` again failed with Cloudflare **HTTP 530 / Error 1033** before session creation (Ray ID `a3090be53c288e29`). Therefore the authorized `get_file_contents` call was not made, no raw or normalized MCP content exists, and actual README text still did not reach the Investigator. No retry was made.

### Subsequent route-only reachability check

On a later user request to “try now,” SentinelForge made one route-only `GET /healthz` check without creating a session or turn. DNS resolution failed for the configured Quick Tunnel hostname (`curl` error 6, HTTP status `000`) before the request reached TrueForge. The model-catalogue route was therefore not requested. This confirms the configured external tunnel is stale or unavailable from this environment; it supplies no evidence about the local patched runtime or MCP resource handling.

### Corrected-endpoint patched-runtime verification

The runtime owner then supplied a corrected active Quick Tunnel. SentinelForge stored it only in the server-side `TRUEFORGE_BASE_URL` secret and validated one no-auth `/healthz` request successfully. Under the owner's single-session authorization, SentinelForge resolved the configured model catalogue, created session `01m0w1wngneqzp1g7ta5r1wr2j`, and issued one constrained Investigator turn whose prompt allowed only the GitHub MCP `get_file_contents` read for `Aayushashsahu/sentinelforge` `README.md` at `main`.

| Observation | Verified result |
| --- | --- |
| Model-catalogue preflight | Completed before session creation. |
| GitHub MCP tool activity | Observed by the event classifier. |
| Agent-visible `resource` / `embeddedResource` block count | `0` |
| Investigator `README.md` evidence length | `0` |
| Investigator evidence sources | Empty |
| Structured finding | Unparseable; no body-backed result was accepted. |
| Completed-history envelope | `{ data, pagination }`; event records had `{ event, turn_id }`, and a recursive raw scan found no resource block. |

The passive history inspection fetched only the already completed session's `/events` history; it created no new session, turn, model call, MCP tool call, sandbox, approval, or GitHub action. The raw and normalized results therefore agree: **the corrected endpoint reaches TrueForge and GitHub MCP activity occurs, but actual `resource.text` still does not reach the Investigator or SentinelForge event boundary.** This is a failed success criterion, not metadata-based success. No second investigation was started.

## Public Limitation and Supported Remediation

There is no SentinelForge configuration or documented TrueForge HTTP API that changes this server-side `executeToolCalls` conversion. SentinelForge must not fabricate a resource block from metadata or bypass the configured MCP connector.

The smallest supported runtime-side fix is to update the official TrueForge harness's `executeToolCalls.ts` conversion so it retains `resource.text` alongside `text` blocks when constructing `LLMToolMessage.content`; resource blobs should remain typed/non-decoded, and `resource_link` values should retain metadata without URL fetching. That fix belongs in the TrueForge runtime source and requires rebuilding/redeploying the user-controlled runtime. It is not a SentinelForge-side patch.

The public release list currently shows `@truefoundry/trueforge@0.1.4` as the current executable package release, and its published notes do not identify a later resource-block fix. [4] No alternate configured official read-only GitHub MCP tool returning body text in a normal text block has been verified, so the hackathon demo cannot honestly proceed as live file-evidence-backed until the runtime is patched or a documented upgraded release provides equivalent behavior.

## Exact Next Action

Patch or upgrade the **TrueForge runtime host**, then separately authorize one new bounded read-only verification. The acceptance condition is strict: each requested file must arrive as an actual non-empty `resource.text`-derived body in the Investigator evidence. Sandbox verification, repair proposal application, approval continuation, and GitHub writes remain prohibited until then.

## References

[1] [GitHub MCP issue #607 — `get_file_contents` resource response shape](https://github.com/github/github-mcp-server/issues/607)  
[2] [TrueForge v0.1.4 `RemoteMCP.ts`](https://github.com/truefoundry/trueforge/blob/v0.1.4/packages/harness/src/core/mcp/RemoteMCP.ts)  
[3] [TrueForge v0.1.4 `executeToolCalls.ts`](https://github.com/truefoundry/trueforge/blob/v0.1.4/packages/harness/src/core/mcp/executeToolCalls.ts)  
[4] [TrueForge releases](https://github.com/truefoundry/trueforge/releases)

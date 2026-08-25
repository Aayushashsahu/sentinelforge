# TrueForge Local Runtime Resource-Text Hotfix Blocker

**Date:** 2026-08-25  
**Status:** **BLOCKED — the actual local TrueForge v0.1.4 runtime host and running artifact are not accessible from this SentinelForge environment.**

## Requested Hotfix

The requested surgical change belongs in the runtime source file:

```text
packages/harness/src/core/mcp/executeToolCalls.ts
```

The public `v0.1.4` implementation derives `textContent` by retaining only `result.content` blocks with `type === "text"`. When GitHub MCP returns its download acknowledgement as a text block followed by a `resource` block containing `resource.text`, the non-empty acknowledgement wins the fallback and the actual body does not enter the `LLMToolMessage` sent to the model. The source-verified patch must include `resource.text` in that same model-context construction; it must not substitute a URI, SHA, or acknowledgement. Resource blobs must retain their established typed handling without decoding, and `resource_link` values must remain metadata only with no URL fetch.

## Access Assessment

| Requirement for safe patch | Observed in this task | Conclusion |
| --- | --- | --- |
| Actual TrueForge process filesystem | Not attached. The earlier runtime was stated to run in the user's WSL2 environment; this task has no local-computer filesystem connector. | Cannot locate or patch the running source/build artifact. |
| Process control for the user’s TrueForge server | Not available. The configured tunnel only exposes the documented HTTP runtime API, not host source, build, or restart control. | Cannot rebuild or restart the active local process. |
| Supported local-host attachment | The session configuration exposes **My Browser** only; it does not expose a local computer/runtime host. | A browser connection cannot modify WSL source or restart a process. |
| Offline TrueForge material in Manus | Only an audit tarball/reference exists under `/home/ubuntu/trueforge-core-audit/`. It is not demonstrated to be the running local server artifact. | Patching it would violate the instruction not to modify an unrelated copy. |

## What Was Not Done

No TrueForge source file was changed. No runtime artifact was rebuilt. No server restart was attempted. No SentinelForge architecture was changed to bypass the runtime defect. No sandbox, GitHub REST/custom client, direct GitHub mutation, approval continuation, branch, commit, pull request, or other write was performed.

## Exact Safe Next Step

Attach the user-controlled WSL/local computer that contains the running TrueForge v0.1.4 server, or provide a supported source/build/restart control plane for that runtime. Once that access exists, the minimum sequence is:

1. Verify the running artifact is built from the exact `v0.1.4` source tree.
2. Patch only `packages/harness/src/core/mcp/executeToolCalls.ts` to preserve `resource.text` with ordinary text blocks.
3. Add the two regression cases: acknowledgement plus `resource.text`, and `resource.text` alone.
4. Build the affected TrueForge package and restart the actual runtime using the new artifact.
5. Run exactly one read-only GitHub MCP verification for `Aayushashsahu/sentinelforge` `README.md` and then `server/sentinelforge/workflow.ts`, requiring actual body excerpts in Investigator evidence.

Until the actual runtime host is accessible and patched, SentinelForge must remain **BLOCKED** for live source-evidence investigation.

## Patched-Runtime Availability Update

The runtime owner later reported that the local hotfix had been applied and the server restarted. SentinelForge then used its single authorized verification attempt, but the tunnel failed before the model-catalogue preflight: `GET /api/v1/models` returned Cloudflare **HTTP 530 / Error 1033**, reporting that the tunnel origin was unreachable. No session, GitHub MCP call, resource result, or README text reached SentinelForge. The exact resource-text patch therefore remains **unverified**, rather than failed. No retry is allowed without fresh authorization after the tunnel becomes reachable.

## References

- [TrueForge v0.1.4 `executeToolCalls.ts`](https://github.com/truefoundry/trueforge/blob/v0.1.4/packages/harness/src/core/mcp/executeToolCalls.ts)
- [Detailed MCP resource delivery trace](./GITHUB_MCP_RESOURCE_BLOCKER.md)

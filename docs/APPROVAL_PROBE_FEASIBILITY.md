# Approval Probe Feasibility

**Status:** **VERIFIED — one provider turn paused before execution**  
**Scope:** A dedicated `approval_probe` MCP tool remains completely non-mutating while TrueForge pauses **before** invoking it because the inline agent selects its literal tool name in `require_approval_for_tools`.

## Verified Mechanism

TrueForge v0.1.4 supports literal tool names in `require_approval_for_tools`, in addition to the `@all`, `@write`, and `@destructive` selector tags. The official schema describes literal names as valid approval selectors, while the selector implementation matches a literal string exactly against the requested tool name. This permits `approval_probe` to be genuinely approval-gated without falsely labeling it as a write or destructive tool. [1] [2]

| Question | Verified answer |
| --- | --- |
| Can a named harmless tool require approval? | **Yes.** `require_approval_for_tools` accepts a literal tool name such as `approval_probe`. |
| Must `approval_probe` be classified as `@write` or `@destructive`? | **No.** Literal-name matching is independent of MCP annotations. |
| Does the gate run before the underlying MCP call? | **Yes.** The v0.1.4 `ToolSet` returns an approval-required response before calling its MCP transport when no decision is supplied. [3] |
| Does this authorize continuation or execution? | **No.** A later explicit approval message would be required; this task must not send one. |

> **Safety conclusion:** A literal `approval_probe` selector is the documented, honest configuration. SentinelForge must not repurpose a read-only tool as `@write` or `@destructive`, and it must never send an approval or continuation message during this verification.

## Required Bounded Configuration

The dedicated tool must return a constant harmless value, perform no mutation or network write, and be the only enabled MCP tool for the approval-probe agent. The agent must use `require_approval_for_tools: ["approval_probe"]`, with sandboxing disabled. The single authorized turn must request that exact tool, capture a genuine `tool.approval_required` event, persist it, and then stop.

## One Authorized Live Verification

One and only one fresh TrueForge turn was run for this mechanism. Its session was `01m0wsrgm4pvvfr3j2bke77tp4`, and its turn was `01m0wsrhyv84whrhqk2n4m4a29.local`. The runtime emitted `tool.approval_required` for `mcp:sentinelforge-tools/approval_probe`, and SentinelForge persisted the event with the provider correlation fields listed below.

| Field | Persisted value |
| --- | --- |
| Provider event ID | `01m0wsrr6yxj0w8hvsns7754ky` |
| Thread ID | `main` |
| Tool-call ID | `call-086145e6-ca9f-4313-9a04-87fc22a2a1bf` |
| Source model-event ID | `01m0wsrk2rvyf28j10gx36g7ya` |
| Turn state | `WAITING_APPROVAL` |
| External actions, approval decisions, and sandbox runs | None persisted |

The returned mission bundle contains the persisted provider event, its correlated waiting turn, and no approval decision, continuation, sandbox run, or external action. No GitHub write, branch, commit, pull request, Qodo action, or tool-approval response was sent. The runtime's pre-transport approval implementation, together with the absence of any continuation message in SentinelForge, means the underlying `approval_probe` call was not executed.

## References

[1]: https://github.com/truefoundry/trueforge/blob/v0.1.4/packages/harness/src/agent-session/schemas/agentSpec.ts "TrueForge v0.1.4 AgentSpec approval-selector schema"
[2]: https://github.com/truefoundry/trueforge/blob/v0.1.4/packages/harness/src/core/mcp/toolSelectors.ts "TrueForge v0.1.4 literal tool-selector implementation"
[3]: https://github.com/truefoundry/trueforge/blob/v0.1.4/packages/harness/src/core/mcp/ToolSet.ts "TrueForge v0.1.4 approval gate before MCP transport"

# Participant Architecture Brief

SentinelForge is an engineering incident responder that makes unsafe automation difficult by separating evidence, proposal, approval, verification, and external execution. This document describes the implementation that exists in the repository; it does not describe a planned system as though it were already running.

## Runtime and evidence architecture

| Component | Current implementation |
| --- | --- |
| TrueForge role | TrueForge provides the real live agent-session, turn, SSE, approval-pause, continuation, and sandbox-tool runtime boundary. |
| MCP architecture | The first-party `sentinelforge-tools` Streamable HTTP server exposes allowlisted read-only repository tools. It returns ordinary text rather than depending on a third-party resource-text conversion path. |
| Investigator | A real Investigator session used only first-party MCP reads and persisted observed evidence plus the version-drift root cause. |
| Repair Engineer | A real read-only Repair Engineer session persisted one minimal, unapplied repair proposal. |
| Repair proposal gate | The non-mutating `repair_proposal_gate` tool is selected by literal tool name for a genuine provider approval checkpoint. |

## Approval architecture

TrueForge emits `tool.approval_required`. SentinelForge maps the provider event into a durable approval request, retaining the session ID, turn ID, thread ID, tool-call ID, and required-action ID. The bridge constructs the exact provider continuation envelope:

```json
{
  "type": "user.tool_approval",
  "thread_id": "<persisted-thread-id>",
  "tool_call_id": "<persisted-tool-call-id>",
  "approval": { "status": "allow" }
}
```

Decisions are idempotent. The bridge uses durable continuation records and atomic pending-to-sending claims so a duplicate decision cannot send a duplicate continuation. One repair-specific continuation was sent and completed. Provider-history reconciliation can reconstruct a completed or paused provider sequence after a bounded SSE stream abort, but it rejects missing, malformed, inconsistent, or approval-less histories.

## Verification and external execution

The live sandbox boundary is real but currently unavailable for verification. The provider reached `truefoundry-system/exec`, then failed to bootstrap its environment because the proxy/package-index path could not install `pydantic`. SentinelForge persists the failed session, turn, run, exit code, stdout/stderr, evidence, and audit trail; it does not run the proposed repair on the host.

The GitHub boundary is deliberately a guarded intent, not a remote executor. A branch, commit, pull request, or GitHub write remains refused unless all of the following are independently present:

1. a genuine real-sandbox verification pass;
2. a matching, valid repair fingerprint;
3. correlated provider approval metadata;
4. separate write authorization; and
5. a write-scoped credential.

Because the real sandbox is blocked, `WRITE_BLOCKED` is the correct current state even after an approval continuation succeeds.

## Qodo role

Qodo Code Review is installed for the repository. PR #2 is a substantive unmerged implementation PR for the CI workflow compatibility scenario. Qodo found two correctness issues; both were fixed and Qodo updated the review to the remediation commit. The review record is maintained in [QODO_REVIEW_LOG.md](./QODO_REVIEW_LOG.md).

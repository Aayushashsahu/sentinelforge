# TrueForge Approval Bridge

**Status:** **Implemented and deterministically tested.** The verified paused `approval_probe` remains untouched as a reference artifact. A later repair-specific continuation and the separately authorized S2 fixture-proof continuation were each sent once through their own persisted correlations; neither resumed the reference probe. The bridge consumes the same provider correlation contract only when a real repair action emits `tool.approval_required`.

## Durable Model

The additive `approval_continuations` table preserves the operator decision, exact provider continuation payload, session/turn/thread/tool-call correlations, idempotency key, status, retry evidence, and send timestamp. Its one-to-one `approvalRequestId` constraint prevents a duplicate continuation record after restart or duplicate submission.

| Persisted concern | Control |
| --- | --- |
| Provider correlation | `trueforgeSessionId`, `turnId`, `threadId`, and `toolCallId` are stored alongside the approval request and required-action ID retained on the correlated turn. |
| Exact continuation | The server constructs only `user.tool_approval` with the persisted `thread_id`, `tool_call_id`, and an `allow` or `deny` decision. |
| Duplicate decisions | A unique approval-request relation and stable idempotency key return the same continuation for the same decision. A different concurrent decision fails closed. |
| Duplicate sends | An atomic `PENDING_SEND` → `SENDING` claim prevents a second caller from sending the same allow continuation. |
| Rejection | A rejection is stored as `NOT_SENT`; no sender path accepts rejected continuations. |
| Resume failure | The continuation is recorded as `FAILED` with a sanitized error. It is not silently retried or converted into a GitHub action. |

## Event Mapping and Decision Boundary

The provider event is parsed strictly from the observed TrueForge shape: `tool.approval_required`, event ID, creation time, thread ID, and exactly one tool-call identity. A correlated tool name is supplied from the preceding model tool-call metadata, then the mapping enters the existing repair-gated approval persistence helper. That helper still requires a `VERIFYING` mission, valid repair fingerprint, and correlated turn before it creates the `approval_requests` row and transitions the mission to `WAITING_APPROVAL`.

Operator decisions are server-side only. An approval decision stages a durable `PENDING_SEND` continuation but **does not** contact TrueForge. A rejection stages a durable deny payload as `NOT_SENT` and transitions the mission to `REJECTED`. The only function that can call the provider continuation endpoint is intentionally not exposed through a public procedure; invoking it needs a separate explicit authorization.

> No secret, TrueForge base URL, or authorization header is returned in mission bundles, audit events, or continuation records.

## Deterministic Coverage

The bridge tests cover allow staging, reject-without-resume, identical duplicate approvals, conflicting concurrent decisions, stale approval rejection, and resume failure. Provider-event adapter tests cover exact `tool.approval_required` mapping and malformed correlation rejection before repository access. No test starts a TrueForge session, resumes a turn, runs a sandbox, or writes to GitHub.

## Remaining Live PR Blocker

The bridge does **not** authorize a GitHub pull request by itself. The real-repair path still requires a real sandbox pass, a repair-specific verified approval event, separately authorized continuation, and the existing valid fingerprint/idempotency gates. The verified `approval_probe` event is non-mutating and cannot satisfy those repair-execution prerequisites. The completed S2 fixture proof is separately bounded and does not remove these real-repair conditions.

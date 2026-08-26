# SentinelForge Final Architecture

SentinelForge is an approval-gated release-incident responder. Its final architecture separates **evidence gathering**, **proposal formation**, **human approval**, **isolated verification**, and **external execution** so that a failure in any control boundary prevents an unsafe repository mutation.

## Runtime Flow

```text
First-party sentinelforge-tools MCP (read-only)
        ↓
TrueForge Investigator → persisted observed evidence and root cause
        ↓
TrueForge Repair Engineer → persisted unapplied patch proposal
        ↓
TrueForge repair_proposal_gate → provider approval_required checkpoint
        ↓
Durable approval bridge → one correlated user.tool_approval continuation
        ↓
Isolated TrueForge sandbox verification
        ↓
PASS: still requires separate write authorization and credential
FAIL/BLOCKED: deterministic GitHub PR intent remains inert
```

## Final Safety States

The persisted mission lifecycle remains conservative (`COMPLETED` means the provider workflow reached a safe terminal boundary). The dashboard exposes a separate derived demo timeline so a viewer cannot mistake safe completion for a repaired repository.

| Derived state | Meaning |
| --- | --- |
| `ROOT_CAUSE_FOUND` | Evidence-backed finding persisted. |
| `REPAIR_PROPOSED` | A minimal proposal exists but has not been applied. |
| `WAITING_APPROVAL` | A genuine provider action needs an operator decision. |
| `APPROVED` | The exact continuation was approved and sent once. |
| `SANDBOX_VERIFICATION_BLOCKED` | The real sandbox did not produce a verification pass. |
| `WRITE_BLOCKED` | Branch, commit, PR, and GitHub write are refused. |
| `COMPLETED_SAFE` | The workflow is safely closed with no repair applied and no external action record. |

## Execution Boundary

The deterministic GitHub plan includes one idempotency key per mission and repair fingerprint, a branch name, the approved changed-file set, and ordered future operations: create branch, commit the exact patch, then create pull request. It is not an executor. Any execution attempt is rejected unless it has a real verification pass, matching fingerprint, correlated provider approval, separate write authorization, and write-scoped credential.

## Current Sandbox Constraint

The sandbox is isolation-preserving but provider-blocked at bootstrap. It reached `truefoundry-system/exec`, then failed while installing pydantic through its proxy. SentinelForge preserves the failed session, turn, run, exit code, stderr, evidence, and audit event; it never falls back to host execution. See [SANDBOX_BLOCKER.md](./SANDBOX_BLOCKER.md).

## Review Trail

Qodo is available through the installed GitHub App. Two substantive, real review PRs were completed: PR #2 for CI workflow compatibility and PR #3 for dependency compatibility. Each received a real Qodo review, remediation, and follow-up update, then merged into `main` after separate authorization. Findings and decisions are recorded in [QODO_REVIEW_LOG.md](./QODO_REVIEW_LOG.md).

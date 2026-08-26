# SentinelForge Hackathon Demo

## Three-Minute Scenario

SentinelForge demonstrates an approval-gated engineering incident response for a deliberately broken release manifest. The demonstration is intentionally safety-first: the system investigates real repository evidence, proposes the smallest repair, pauses for a real provider approval, continues once approved, then visibly refuses a repository mutation because isolated verification is unavailable.

| Time | Demonstration step | Expected state |
| --- | --- | --- |
| 0:00–0:20 | Open the persisted mission `SF_xF37FKFqr1NvtA`. Introduce the release-version incident and the first-party MCP evidence boundary. | `INVESTIGATING` → `ROOT_CAUSE_FOUND` |
| 0:20–0:45 | Show observed `package.json` and `release-manifest.json` evidence, then the persisted root-cause explanation. | `ROOT_CAUSE_FOUND` |
| 0:45–1:05 | Show the exact unapplied `release-manifest.json` `1.3.0` → `1.4.0` patch. | `REPAIR_PROPOSED` |
| 1:05–1:30 | Show the genuine `tool.approval_required` correlation and persisted approval checkpoint. | `WAITING_APPROVAL` |
| 1:30–1:50 | Show the durable allow decision and exactly-once `user.tool_approval` continuation result. | `APPROVED` → `VERIFYING` |
| 1:50–2:20 | Open the isolated verification panel. Show the provider-real bootstrap error, empty stdout, exit code `2`, and failed run. | `SANDBOX_VERIFICATION_BLOCKED` |
| 2:20–2:45 | Show the deterministic branch/commit/pull-request intent, its fingerprint idempotency key, and why it is inert. | `WRITE_BLOCKED` |
| 2:45–3:00 | Close on the audit trail and zero external-action records. | `COMPLETED_SAFE` |

> **Final message:** Repair approved, but not applied because isolated verification is unavailable.

## What Is Real

The live TrueForge runtime, NVIDIA NIM model route, first-party `sentinelforge-tools` MCP server, Investigator evidence, Repair Engineer proposal, provider approval pause, persisted correlation, and one provider continuation are real. The sandbox also reached the real `truefoundry-system/exec` path, but bootstrap failed before the verifier command ran.

## What Is Blocked

Sandbox verification is formally `SANDBOX_VERIFICATION_BLOCKED`. The provider could not install `pydantic>=2.0.0,<3.0.0` through its configured proxy/package-index path. The repair was not applied in a sandbox, on the host, or to GitHub. The full material error and remediation order are preserved in [SANDBOX_BLOCKER.md](./SANDBOX_BLOCKER.md).

## Why GitHub Mutation Is Refused

The prepared GitHub execution plan stays `BLOCKED_SANDBOX_VERIFICATION`. It requires all of the following before any branch, commit, or pull request can exist: a real sandbox pass, matching approved repair fingerprint, valid provider correlation, separate write authorization, and a write-scoped credential. None of those missing conditions is inferred from approval alone.

## Integration Evidence

| Integration | Demonstrated behavior |
| --- | --- |
| TrueForge | Real session, approval pause, and exactly-once continuation are persisted. |
| First-party MCP | Investigator and Repair Engineer use the allowlisted read-only server for ordinary file text. |
| Approval flow | Correlated session, turn, thread, tool-call, and required-action records survive restarts. |
| Qodo | PR #2 and stacked PR #3 both received real Qodo review cycles, remediation, and follow-up review updates while remaining open and unmerged. See [QODO_REVIEW_LOG.md](./QODO_REVIEW_LOG.md). |

## Operator Notes

Do not retry the sandbox in the demo. Do not represent the deterministic fixture verifier as a real provider pass. Do not create a branch, commit, pull request, or GitHub write. The intended demonstration outcome is safe refusal with an explanatory audit trail.

## Final Rehearsal Status

The persisted mission and readiness views were rehearsed against the judging flow. The only presentation defect found was a sparse first-load message; it was replaced with an intentional persisted-evidence loading panel that explicitly states no provider action, sandbox retry, or GitHub write is occurring.

| Checklist | Status |
| --- | --- |
| Three-minute flow can be completed | **Ready** |
| Root cause is obvious within the first minute | **Ready** — observed versions are visible in the evidence ledger |
| Real MCP interaction, approval, and continuation are visible | **Ready** — persisted audit and state cards distinguish provider-real stages |
| Sandbox blocker and GitHub refusal are explained | **Ready** — both use explicit blocked/guarded state language |
| Safe completion is visible | **Ready** — `COMPLETED_SAFE` is explicitly not a repaired repository |
| No secrets in frontend, fake provider events, unsafe fallback, or GitHub write | **Confirmed by boundary design and deterministic checks** |
| Qodo review | **Ready** — PR #2 and PR #3 have real review, remediation, and follow-up evidence; both remain unmerged |

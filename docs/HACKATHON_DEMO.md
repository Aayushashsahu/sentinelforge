# SentinelForge Hackathon Demo

## Three-Minute Scenario

SentinelForge demonstrates an approval-gated engineering incident response for a deliberately broken release manifest. The completed S2 fixture proof is intentionally bounded: the server verifies canonical evidence, the provider emits a genuine approval pause, a human decision sends one same-turn continuation, and the executor creates exactly one branch, one manifest-only commit, and one open, unmerged pull request before stopping.

| Time | Demonstration step | Expected state |
| --- | --- | --- |
| 0:00–0:20 | Introduce the real release mismatch: authoritative `package.json` `1.4.0` versus `release-manifest.json` `1.3.0`. State that these two reads are **server-orchestrated evidence**, not provider file reads. | Exact bounded repair scope |
| 0:20–0:45 | Show the persisted one-file proposal and its fingerprint for mission `SF_kqb-rEpDFIUg-I`. | `PLANNING_FIX` before action staging |
| 0:45–1:15 | Show the provider approval checkpoint: `tool.approval_required`, with matching session, turn, thread, tool-call, and required-action values. | `WAITING_APPROVAL` |
| 1:15–1:35 | Show the explicit human decision for pending request `apr_jsOGkwaqa1hM8N`. Explain that the approval is bound to the action fingerprint, repository, file, and provider correlation. | One exact approval |
| 1:35–2:00 | Show the same-turn continuation `tfc_kgWqNPxiE3o0Nu` with attempt count `1`, then the immutable final preflight outcome. | Continuation `SENT` once |
| 2:00–2:35 | Open the real fixture [PR #1](https://github.com/Aayushashsahu/sentinelforge-incident-fixture/pull/1). Show `main ← sentinelforge/sf_kqb-repdfiug-i`, one commit `ef8119f`, and the one-line `release-manifest.json` diff. | `OPEN`, unmerged PR |
| 2:35–3:00 | Show the PR remains open, with no auto-merge and no further action. Close on the execution limit: one branch, one file update, one commit, one PR, then stop. | Terminal bounded proof |

> **Final message:** The approved fixture proof made one precisely bounded external change and stopped at an open, unmerged PR. It did not merge, auto-merge, bypass sandbox requirements for the separate real-repair path, or act autonomously beyond the approved boundary.

## What Is Real

The live TrueForge runtime, NVIDIA NIM model route, first-party `sentinelforge-tools` MCP server, server-orchestrated fixture evidence, provider approval pause, persisted correlation, one provider continuation, and the fixture GitHub PR are real. The fixture proof action is `act_rxZQ7xnfK4vmm5`; it is distinct from every earlier terminal action and has the exact proposal fingerprint `8dc6995a084ada629ed0f7d5e7581e1f22c17e446046963a4c34bcc57c700d6d`.

## What Is Blocked

The separate real-repair sandbox verification remains formally `SANDBOX_VERIFICATION_BLOCKED`: the provider could not install `pydantic>=2.0.0,<3.0.0` through its configured proxy/package-index path. **No sandbox was invoked for the S2 fixture proof.** The proof does not claim a sandbox pass or use the S2 result to remove sandbox requirements from the real-repair path. The historical blocker is preserved in [SANDBOX_BLOCKER.md](./SANDBOX_BLOCKER.md).

## Why GitHub Mutation Is Refused

The real-repair execution plan remains `BLOCKED_SANDBOX_VERIFICATION`. The separate S2 fixture proof was specifically authorized with its own immutable target, server evidence, fingerprint, provider correlation, human approval, scratch credential, final preflight, and one-time executor. It created branch `sentinelforge/sf_kqb-repdfiug-i`, commit `ef8119fa31b39b6f059ef13d2f0ae99fbddab4c0`, and [open PR #1](https://github.com/Aayushashsahu/sentinelforge-incident-fixture/pull/1); it did not merge or create any further write.

## Integration Evidence

| Integration | Demonstrated behavior |
| --- | --- |
| TrueForge | Real session, approval pause, and exactly-once continuation are persisted. |
| First-party MCP | Investigator and Repair Engineer use the allowlisted read-only server for ordinary file text. |
| Approval flow | Correlated session, turn, thread, tool-call, and required-action records survive restarts. |
| Qodo | PR #2 and PR #3 both received real Qodo review cycles, remediation, and follow-up review updates before merging into `main` after separate authorization. See [QODO_REVIEW_LOG.md](./QODO_REVIEW_LOG.md). |

## Operator Notes

Do not retry the sandbox in the demo. Do not represent the deterministic fixture verifier as a real provider pass. Do not replay the proof, send another continuation, create another branch/commit/PR, or interact with the PR. The completed S2 PR is evidence to **show read-only**, not an action to repeat.

## Final Rehearsal Status

The currently deployed dashboard is a contextual deterministic-scenario interface: during S4 inspection it showed zero persisted mission/approval counters and stale historical GitHub-guarded copy. It must **not** be presented as a live visual record of S2. The authentic visual evidence available for the S2 result is the existing provider/audit record and the fixture PR, which must be shown read-only.

| Checklist | Status |
| --- | --- |
| Three-minute story | **Ready as a local-desktop shot list** — use only the persisted S2 audit/provider records and fixture PR evidence listed above |
| Root cause | **Ready** — the two real server-verified versions define the exact one-line mismatch |
| Provider approval / continuation | **Ready only where the recorded provider/audit evidence is available** — do not substitute the deterministic dashboard |
| GitHub evidence | **Ready** — fixture PR #1 exposes the one-commit, one-file, open-unmerged outcome |
| Sandbox claim | **Constrained** — the demo must state that S2 invoked no sandbox and the separate real-repair sandbox remains blocked |
| Secret / safety posture | **Ready** — no token, authorization header, cookie, or provider credential belongs on screen |

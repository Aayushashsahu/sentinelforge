# SentinelForge Final Demo State

## Verified End-to-End Sequence

| Stage | Verified state | Evidence boundary |
| --- | --- | --- |
| Investigated | **REAL** | The Investigator used only `sentinelforge-tools` and received ordinary file bodies from the incident fixture. |
| Proposed | **REAL, unapplied** | The Repair Engineer persisted a minimal `release-manifest.json` version-alignment proposal. |
| Approved | **REAL** | A provider-originated `tool.approval_required` checkpoint was durably correlated and exactly one `user.tool_approval` continuation was accepted. |
| Verification | **SANDBOX_VERIFICATION_BLOCKED** | The real sandbox reached `truefoundry-system/exec` but bootstrap failed while installing `pydantic` through its proxy before the repair command could run. |
| GitHub write | **NOT PERMITTED** | No branch, commit, pull request, or GitHub mutation was performed. The deterministic execution plan refuses any write without a real verification pass and separate write authorization. |

> The demo must not represent the simulated verifier as a real sandbox pass. The persisted sandbox result is a provider-real **FAIL** with empty stdout, exit code `2`, and a documented bootstrap/proxy error.

## Demo Walkthrough

1. Show the persisted investigation evidence and the minimal, unapplied manifest proposal.
2. Show the real approval checkpoint, its durable correlation, and the exactly-once continuation record.
3. Show the failed isolated sandbox run, its preserved stdout/stderr/exit code, and the `SANDBOX_VERIFICATION_BLOCKED` capability state.
4. Show the deterministic future branch/commit/pull-request plan and its fail-closed prerequisites.
5. Conclude with zero external action records and no GitHub mutation.

## Required Conditions Before Any Future Write

| Condition | Current state |
| --- | --- |
| Real sandbox verification pass | **Not met** |
| Approved repair fingerprint | Persisted but insufficient on its own |
| Correlated provider approval | Persisted |
| Separate write authorization | **Not granted** |
| Write-scoped GitHub credential | **Not configured** |

Until every condition is met, SentinelForge may prepare deterministic intent only. It must not create a branch, commit, or pull request.

## Exact Prepared Intent for the Demonstration Mission

The following locally derived plan is intentionally **non-executable** because the real verification status is `FAIL` / `SANDBOX_VERIFICATION_BLOCKED`.

| Field | Prepared value |
| --- | --- |
| Mission | `SF_xF37FKFqr1NvtA` |
| Repository | `Aayushashsahu/sentinelforge-incident-fixture` |
| Repair fingerprint | `082b2cf348204b9cd42c04d83e3dea27d43c869d6a9b6b43a3bc842713c5a9c2` |
| Idempotency key | `trueforge-pr:SF_xF37FKFqr1NvtA:082b2cf348204b9cd42c04d83e3dea27d43c869d6a9b6b43a3bc842713c5a9c2` |
| Branch | `sentinelforge/sf_xf37fkfqr1nvta` from `main` |
| Proposed changed file | `release-manifest.json` only |
| Planned order | Create branch → commit the fingerprint-matched patch → create pull request |
| Current plan status | `BLOCKED_SANDBOX_VERIFICATION` |

The plan remains inert until the exact fingerprint is still current, a **real** sandbox pass is persisted, a correlated approval exists, a separately authorized write is granted, and a write-scoped credential is available.

# TrueForge and MCP Readiness

This document records the current audited status, not a planned-provider state. SentinelForge preserves a separation between provider evidence, human approval, sandbox verification, and external execution.

| Capability | Current audited state | Evidence boundary |
|---|---|---|
| Mission state and approval continuation | **Verified for the recorded flows** | Persisted mission, approval, continuation, and audit records exist; duplicate continuation delivery is guarded server-side. |
| Audit trail | **Implemented and tested** | Events are append-only in the application model; the S7 report identifies remaining public-route authorization concerns separately. |
| Deterministic verifier | **Fixture-only support** | No-shell, no-network, no-filesystem-mutation deterministic adapter; it is not represented as a provider sandbox pass. |
| TrueForge session and approval | **Verified from historical live execution** | Real Investigator/Repair flows, provider approval pauses, and correlated continuations were recorded. No new provider action is authorized by this status. |
| First-party MCP reads | **Verified from historical live execution** | `sentinelforge-tools` supplied ordinary read-only file text for recorded investigator/repair flows. |
| Fixture GitHub proof | **Completed, bounded external proof** | One immutable fixture action produced one branch, one manifest-only commit, and one open, unmerged PR; no merge or auto-merge occurred. |
| Real-repair sandbox | **`SANDBOX_VERIFICATION_BLOCKED`** | `truefoundry-system/exec` admission was observed, but bootstrap failed at the provider proxy/package-index boundary before the repair command ran. |
| Real-repair GitHub execution | **`WRITE_BLOCKED`** | A real-repair write still requires a genuine sandbox pass and separate authorization; the S2 fixture proof does not relax this requirement. |

> Do not convert historical evidence into a claim of continuously available provider connectivity, sandbox functionality, or general repository-write authority. See [HACKATHON_DEMO.md](./HACKATHON_DEMO.md) and [SANDBOX_BLOCKER.md](./SANDBOX_BLOCKER.md).

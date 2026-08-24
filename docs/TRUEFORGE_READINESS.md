# TrueForge and MCP readiness

SentinelForge intentionally separates domain logic from its future harness provider. A future adapter should create and resume TrueForge sessions, call scoped GitHub MCP read tools, delegate typed Investigator/Repair Engineer/Verifier work, send repairs to a provider sandbox, and resume only after a persisted approval decision.

| Capability | Current state | Evidence |
|---|---|---|
| Mission state and approval continuation | Ready | Persisted mission and approval tables, state validation, tests. |
| Audit trail | Ready | Events are append-only; no update or delete procedure exists. |
| Deterministic verifier | Ready for fixture | No-shell, no-network, no-filesystem-mutation adapter with timeout and output capture. |
| TrueForge session | Not connected | Architecture is documented; no live provider claim is made. |
| GitHub MCP read/write | Not connected | A simulated action demonstrates the approval boundary only. |
| Provider sandbox | Not connected | Connect a TrueForge sandbox before generated code or arbitrary repositories are accepted. |

Do not change a UI label from **Not connected** or **Simulated** until its integration is configured and verified end to end.

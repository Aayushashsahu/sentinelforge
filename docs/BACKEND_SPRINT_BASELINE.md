# SentinelForge Backend Sprint Baseline

**Recorded:** 2026-08-25  
**Working branch:** `main`  
**Baseline revision:** `7b2efdd`  
**Worktree at record time:** This baseline document, the backend report update, and the corresponding checklist update are the only uncommitted main-branch changes.  
**Scope:** Backend-only release-incident vertical slice. No dashboard redesign is in scope.

## Current Main-Branch Baseline

| Area | Verified state |
| --- | --- |
| First-party MCP evidence | **REAL**. `sentinelforge-tools` permits only `get_repository`, `get_file`, `get_issue`, and `get_workflow_run` for the fixture allowlist, and returns decoded file bodies in ordinary MCP text blocks. |
| Investigator | **REAL**. Mission `SF_xF37FKFqr1NvtA` has persisted package, manifest, test, and workflow evidence for the `1.4.0` versus `1.3.0` version mismatch. |
| Repair Engineer | **REAL / proposal-only**. A separately authorized repair turn proposed the minimal un-applied `release-manifest.json` `1.3.0` to `1.4.0` alignment and persisted it without a second turn or any repository mutation. |
| Verifier | **SIMULATED**. The deterministic fixture verifier is explicit about `didExecuteSandbox: false`; it is not a sandbox pass. |
| Sandbox | **BLOCKED**. The provider bootstrap cannot install `pydantic` through its configured proxy. This blocker is not to be retried absent an infrastructure-side remedy. |
| Approval and repair write | **GATED**. No genuine required-action event, approval continuation, sandbox pass, write-scoped repair credential, or repair-action authorization exists. |
| Deterministic verification | **PASS**. `pnpm check`, `pnpm test` (53 passing, 9 opt-in live tests skipped), `pnpm build`, and `git diff --check` passed at the current baseline. |

## Architecture, Persistence, and Workflow

| Layer | Main-branch baseline |
| --- | --- |
| Server boundary | TypeScript ESM Express server with tRPC procedures. Runtime URLs and credentials stay server-side; client mission bundles do not expose the TrueForge base URL. |
| Persistence | Drizzle/MySQL mission, evidence, verifier, approval, external-action, TrueForge-session/turn, and append-only audit records preserve correlation and fail-closed state transitions. |
| Agent workflow | `liveWorkflow.ts` creates bounded TrueForge sessions/turns, reads SSE plus safe history reconciliation, persists sanitized semantic events, and never makes a repair mutation. |
| Evidence source | The Streamable HTTP `sentinelforge-tools` MCP server is session-aware, allowlisted to the fixture repository, and returns ordinary text blocks only. |
| Deterministic path | The fixture workflow and verifier remain available as clearly labeled simulated behavior, independent from the live proposal-only path. |

The live workflow is deliberately ordered as **ordinary-text evidence → read-only proposal → simulated verifier boundary → future approval gate → separately authorized action**. It is currently stopped after the persisted proposal because no real sandbox pass or genuine approval-required provider event exists.

## Repository and Review State

The baseline branch remains separate from the open Qodo governance pull request. PR [#1](https://github.com/Aayushashsahu/sentinelforge/pull/1) is a narrow repository-review-policy and CI-consistency change, not a repair action and not a substitute for an evidence-bearing incident implementation diff. It remains open pending Qodo’s asynchronous reassessment and a later, separate merge decision.

> **Safety boundary:** No PR review, Qodo policy, or CI change authorizes applying the persisted repair proposal. The sandbox, approval, and repair-write gates remain unchanged.

## Next Independent Backend Work

The safe next implementation work is to strengthen deterministic failure handling and read-only observation contracts. Live sandbox, approval continuation, and repair GitHub-write execution remain dormant until their separate verified prerequisites and explicit authorizations exist.

# SentinelForge Backend Sprint Baseline

**Recorded:** 2026-08-25  
**Working branch:** `main`  
**Stable main checkpoint:** `c7df83b6`
**Worktree at record time:** Clean after the verified deterministic hardening checkpoint.
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
| Deterministic verification | **PASS**. `pnpm check`, `pnpm test` (61 passing deterministic tests across 14 test files, with 9 opt-in live tests skipped), `pnpm build`, and `git diff --check` passed at checkpoint `c7df83b6`. |

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

The baseline branch remains separate from the open Qodo governance pull request. PR [#1](https://github.com/Aayushashsahu/sentinelforge/pull/1) is a narrow repository-review-policy and CI-consistency change, not a repair action and not a substitute for an evidence-bearing incident implementation diff. Its remote head is `dac3afc49839f61601a5fb29b96c7a93e4a98c41`; the visible `quality` check is successful, while the four visible Qodo `COMMENTED` reviews only reach `9f1f652`. There is no formal review decision and no visible Qodo reassessment of the current head. The PR therefore remains open pending asynchronous reassessment and a later, separately authorized merge decision.

> **Safety boundary:** No PR review, Qodo policy, or CI change authorizes applying the persisted repair proposal. The sandbox, approval, and repair-write gates remain unchanged.

## Next Independent Backend Work

The later hardening milestones keep all dormant execution boundaries fail-closed without performing a live action. Approval persistence now rejects invalid fingerprints and missing correlated turns, while notification failure still leaves the action paused and audited. The live approval-event adapter rejects malformed events and invalid fingerprints before repository lookup; stream identifiers and tool names are bounded to compatible persistence limits; approval-continuation inputs reject blank or oversized correlation and denial fields; and the dormant GitHub gate validates both matching repair fingerprints as SHA-256 before a future write could be permitted. The read-only execution surface reports `PERSISTED_UNAPPLIED_READ_ONLY_PROPOSAL`, accurately describing the existing Repair Engineer artifact.

The safe next implementation work is therefore limited to independent deterministic failure handling and read-only observation contracts. Live sandbox, approval continuation, repair GitHub-write execution, Qodo remediation, and any merge remain dormant until their separate verified prerequisites and explicit authorizations exist.

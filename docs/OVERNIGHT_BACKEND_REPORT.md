# SentinelForge Overnight Backend Report

**Date:** 2026-08-25  
**Scope:** Backend-only TrueForge integration. The command-center UI was not redesigned or extended.

## Executive Summary

SentinelForge now has a **real server-side TrueForge integration boundary** beside its preserved deterministic offline fixture. It created real sessions through the reachable standalone/no-auth runtime, resolved the configured short model name against the runtime catalogue, ran a real read-only GitHub MCP investigation, and persisted observed evidence separately from the Investigator’s inference. No GitHub write, sandbox-verified repair, approval continuation, branch, commit, pull request, merge, deployment, repository-administration action, workflow modification, or secrets operation was performed.

The live Investigator established that the configured target repository is empty: GitHub MCP reads reported no default branch, commits, tags, releases, or readable `README.md`. A bounded sandbox session/turn was also created, but it emitted no sandbox lifecycle event for the harmless `printf sentinel-forge-sandbox-ok` command. SentinelForge recorded the sandbox result as **UNKNOWN**, not as a successful verification. Those facts block any genuine repair, approval, or pull-request path.

## Capability Matrix

| Capability | Status | Verified outcome |
| --- | --- | --- |
| Standalone no-auth connection | **REAL** | Server-side `GET /healthz` returned HTTP 200 without an `Authorization` header. |
| Server-side configuration boundary | **REAL** | Base URL, short model name, and GitHub MCP name are server-only environment settings; a token remains optional and omitted when blank. |
| Model resolution | **REAL** | The runtime catalogue resolved the supplied short name to a fully qualified NVIDIA NIM model name before session creation. |
| TrueForge session creation | **REAL** | Multiple live sessions were created and correlated to one mission after correcting the one-session-per-mission persistence constraint. |
| TrueForge turn/event correlation | **REAL / PARTIAL** | Session, turn, thread, and append-only event correlation are persisted. Live SSE termination required read-only `/events` reconciliation after the runtime held the response open past `turn.done`. |
| GitHub MCP initialization | **REAL** | A live session initialized the configured GitHub MCP server. |
| GitHub MCP evidence | **REAL** | The Investigator issued real read-only `get_file_contents`, branch, tag, release, and commit calls. Observed results are stored separately from inference. |
| Investigator structured result | **REAL** | The completed reconciled turn passed local Zod validation and advanced the mission to `PLANNING_FIX`. |
| Repair Engineer | **BLOCKED** | The target repository has no source, workflow, branch, or CI artifact to repair. |
| TrueForge sandbox verification | **BLOCKED** | The first probe emitted no sandbox lifecycle event. The user-requested retry reached the real sandbox `exec` tool, but bootstrap failed because the sandbox could not install `pydantic` through its configured proxy; no terminal `turn.done` arrived before the bounded client timeout. Both outcomes are recorded as `UNKNOWN`, never `PASS`. |
| Human approval pause/resume | **UNAVAILABLE** | No repair proposal or sandbox pass exists, so no genuine required-action event was created or continued. |
| GitHub branch, commit, or pull request | **NOT PERFORMED** | These remain intentionally blocked by missing repair, sandbox, and approval prerequisites. |
| Deterministic offline fixture | **SIMULATED / PRESERVED** | The existing fixture verifier and simulated approval action remain available and clearly distinct from live mode. |

## Runtime and Package Compatibility

| Item | Actual result |
| --- | --- |
| Runtime authentication | Standalone/no-auth. No token was requested, configured, or sent in a request header. |
| Declared SDK dependency | `@truefoundry/trueforge-sdk` is declared at `^0.1.3`. |
| Requested 0.1.4 SDK package | The queried `@truefoundry/trueforge-sdk@0.1.4` package was unavailable. SentinelForge therefore uses a minimal typed raw HTTP adapter at the server boundary. |
| Live session envelope | The tunnel runtime explicitly accepted the newer `agent.spec` shape and rejected `agent_spec`. |
| Public v0.1.4 source tag | The public source schema exposes `agent_spec`, producing a documented version/contract mismatch risk with the active tunnel runtime. |
| Model name requirement | The runtime rejected the supplied short name and catalogue lookup resolved it to `nvidia-nim/nemotron-3-5-lightning-30b-a3b`. The short environment value remains unchanged; resolution is server-side. |

## Safety Controls Implemented

The Investigator policy attaches only the configured GitHub MCP server with `@read-only` tools, denies write/destructive selectors, disables sandboxing, disables dynamic subagents, and requires a concrete GitHub tool call before treating any model text as evidence-backed. Its prompt forbids shell, curl, git CLI, arbitrary web search, branch creation, commits, pull requests, and GitHub writes.

Mission bundles do not return the stored runtime base URL. Remote correlation storage remains private, and live-provider error persistence redacts runtime URLs and SQL parameter values. The prior sandbox-probe persistence error was corrected in stored audit/run records so it no longer contains a runtime URL.

## Verification Performed

| Check | Result |
| --- | --- |
| Type check | Passed: `pnpm check` |
| Full test suite | Passed: 6 files, 24 tests |
| Production build | Passed: `pnpm build` |
| Live health test | Passed: 2 live configuration/health tests |
| Secret-boundary response check | Passed: the runtime base URL is omitted from the mission-status response |
| Database migration | Applied only the reviewed `DROP INDEX trueforge_sessions_missionId_unique` change; no data-destructive migration was applied |

The production build issued only the pre-existing bundle-size warning for a client chunk above 500 kB; it did not fail the build.

## Blockers and Their Effect

The exact live blockers are maintained in [OVERNIGHT_BLOCKERS.md](./OVERNIGHT_BLOCKERS.md). The important current boundaries are the runtime/API-envelope compatibility mismatch, live SSE response completion requiring reconciliation, a sandbox provider whose Python bootstrap cannot reach its dependency source through the configured proxy, and an empty target repository. Each blocks progressively later workflow stages. SentinelForge fails closed rather than simulating a repair, approval, or GitHub write.

## Commits and Checkpoint State

No manual Git commit was created during this sprint. The next step is to save a verified managed checkpoint containing the client, persistence migration, tests, blocker report, and this report. The existing working tree also includes inherited pre-sprint modifications; this report distinguishes the current live-integration work from that earlier baseline.

## Exact Morning Next Action

> Make the sandbox image self-contained with compatible `pydantic` installed, or restore its package-index proxy/network route. Then rerun exactly `printf sentinel-forge-sandbox-ok` in a dedicated sandbox-enabled session and require both a successful tool response and terminal `turn.done`. In parallel, point SentinelForge at a non-empty repository and a reproducible CI incident. Only after both produce real evidence should the team create a bounded Repair Engineer proposal, require a real approval action, and consider one idempotent GitHub pull-request action.

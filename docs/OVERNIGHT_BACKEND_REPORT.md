# SentinelForge Overnight Backend Report

**Date:** 2026-08-25  
**Scope:** Backend-only TrueForge integration. The command-center UI was not redesigned or extended.

## Executive Summary

SentinelForge now has a **real server-side TrueForge integration boundary** beside its preserved deterministic offline fixture. It created real sessions through the reachable standalone/no-auth runtime, resolved the configured short model name against the runtime catalogue, and ran real read-only GitHub MCP investigations. It also created the public, deliberately broken `Aayushashsahu/sentinelforge-incident-fixture` repository. No GitHub repair write, sandbox-verified repair, approval continuation, branch, commit, pull request, merge, deployment, repository-administration action, workflow modification, or secrets operation was performed.

The initial live target was empty. The replacement incident fixture is public, non-empty, and deterministically fails its initial release-manifest check. However, the active GitHub MCP returned checksum-only responses for file downloads in one real Investigator turn and the model transcribed the repository name incorrectly in a second turn. Explicit tool selection and embedded-resource parsing coverage did not create new source evidence: two bounded continuation calls for `Aayushashsahu/sentinelforge` `README.md` yielded no observable result body through the available control plane. The system correctly refuses to represent any of these as a complete evidence-backed root cause. A bounded sandbox session reached real `exec`, but its bootstrap failed on a `pydantic` package-index/proxy path. SentinelForge records the sandbox result as **BLOCKED**, never as a successful verification.

The release-incident vertical slice now pivots away from the external GitHub MCP file-body limitation. The first-party `sentinelforge-tools` Streamable HTTP MCP server uses a backend-only GitHub read token, an explicit fixture allowlist, and ordinary text-only MCP responses. Its real end-to-end MCP contract test retrieved decoded fixture `package.json`, `release-manifest.json`, and `test.js` content, validating the deliberate `1.4.0` versus `1.3.0` mismatch. The runtime owner registered it under the configured `sentinelforge-tools` name, and SentinelForge verified the exact four-tool catalog before running one real Investigator session/turn. That turn persisted ordinary file-body evidence from package, manifest, test, and workflow files, with a verified version-drift root cause.

## Capability Matrix

| Capability | Status | Verified outcome |
| --- | --- | --- |
| Standalone no-auth connection | **REAL** | Server-side `GET /healthz` returned HTTP 200 without an `Authorization` header. |
| Server-side configuration boundary | **REAL** | Base URL, short model name, and GitHub MCP name are server-only environment settings; a token remains optional and omitted when blank. |
| Model resolution | **REAL** | The runtime catalogue resolved the supplied short name to a fully qualified NVIDIA NIM model name before session creation. |
| TrueForge session creation | **REAL** | Multiple live sessions were created and correlated to one mission after correcting the one-session-per-mission persistence constraint. |
| TrueForge turn/event correlation | **REAL / PARTIAL** | Session, turn, thread, and append-only event correlation are persisted. Semantic stream records now use one ordered immutable batch insert rather than a sequential write per retained event, while repeated model deltas remain filtered. The live reader has an abort-aware 75-second bound and falls back to read-only `/events` reconciliation when a completed terminal event is available; end-to-end live SSE closure remains unverified. |
| GitHub MCP initialization | **REAL** | A live session initialized the configured GitHub MCP server. |
| Incident fixture repository | **REAL** | Public, non-empty `Aayushashsahu/sentinelforge-incident-fixture` intentionally fails because `package.json` is `1.4.0` while `release-manifest.json` is `1.3.0`. |
| GitHub MCP READ | **REAL / BLOCKED FOR CONTENT** | The Investigator issued real read-only `get_file_contents`, branch, release, user-search, and repository-search calls. A newly authorized resource verification observed a real call but zero resource blocks and no body-backed Investigator evidence. Public TrueForge v0.1.4 source identifies the loss in `executeToolCalls.ts`, which filters content to `type === "text"` before model-context construction. |
| First-party `sentinelforge-tools` MCP | **REAL** | The registered remote MCP catalog exposes exactly allowlisted `get_repository`, `get_file`, `get_issue`, and `get_workflow_run` methods without required authorization. One real Investigator turn used `get_repository`, `get_file`, and `get_workflow_run`. |
| Evidence and root cause | **REAL** | Mission `SF_xF37FKFqr1NvtA` persisted ordinary file-body observations of package `1.4.0`, manifest `1.3.0`, test mismatch/exit logic, and workflow invocation. The root cause is the directly evidenced version mismatch. |
| Repair Engineer | **PARTIAL / BLOCKED** | A real separate read-only Repair Engineer session initialized GitHub MCP and called `get_file_contents`, but returned a null patch, empty changed-file list, string-valued evidence limit, and a `none` risk after the same content limitation. The strict parser rejected it; no patch was persisted or applied. |
| Verifier | **SIMULATED** | A deterministic, pure no-shell incident-fixture verifier is now exposed through a read-only backend API. It passes the proposed `1.4.0` manifest change and explicitly returns `mode: DETERMINISTIC_FIXTURE` and `didExecuteSandbox: false`. |
| TrueForge sandbox verification | **BLOCKED** | The first probe emitted no sandbox lifecycle event. The final retry reached real sandbox `exec`, but bootstrap failed because the sandbox could not install `pydantic` through its configured proxy. The final source timebox found no permitted official local-provider remedy. |
| Human approval pause/resume | **PARTIAL / GATED** | The exact `user.tool_approval` continuation schema, fail-closed approval-required persistence, owner notification, and idempotency gates are implemented and tested. No genuine required-action event or continuation was sent because the repair proposal and live sandbox prerequisites failed. |
| GitHub branch, commit, or pull request | **BLOCKED** | No verified live repair proposal, sandbox pass, real approval event, or continuation exists. No external repair action was performed. |
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

The vertical-slice Investigator and Repair Engineer policies now attach only the configured `sentinelforge-tools` MCP server with the four explicit read tools, deny write/destructive selectors, disable sandboxing, disable dynamic subagents, and require a concrete first-party MCP tool call before treating any model text as evidence-backed. Their prompts forbid shell, curl, git CLI, arbitrary web search, branch creation, commits, pull requests, GitHub writes, `EmbeddedResource`, and `ResourceLink`.

Mission bundles do not return the stored runtime base URL. Remote correlation storage remains private, and live-provider error persistence redacts runtime URLs and SQL parameter values. The prior sandbox-probe persistence error was corrected in stored audit/run records so it no longer contains a runtime URL.

## Verification Performed

| Check | Result |
| --- | --- |
| Type check | Passed: `pnpm check` |
| First-party MCP unit contract | Passed: allowlisted decoded ordinary-text output and token non-disclosure / allowlist rejection coverage. |
| First-party MCP live contract | Passed: authenticated MCP client received one ordinary text block for fixture `package.json`, `release-manifest.json`, and `test.js`. |
| First-party MCP status observation | Passed: `tools.status` returned the read-only MCP name, endpoint path, allowlist, and tool surface without a credential value. |
| Full deterministic suite | Passed: 13 files / 51 tests, with 6 explicit external-live test files skipped. |
| First-party live Investigator | Passed: one real session `01m0waamsttyeb0y0r3xxnvrff` and turn `01m0waaw5c98fxev1hybsk87qa.local` persisted file-body evidence and transitioned its mission to `PLANNING_FIX`. |
| Explicit live MCP resource verification | The earlier opt-in test observed a real configured GitHub MCP tool call but zero raw resource blocks and no body-backed evidence. Two separately user-authorized patched-runtime attempts then failed before session creation because the stale Cloudflare tunnel returned HTTP 530 / Error 1033 during `GET /api/v1/models`. After the owner supplied a corrected endpoint, one new constrained session successfully reached the model catalogue and GitHub MCP, but its stream and passive completed-history scan still contained zero resource blocks, zero README evidence, and no parseable body-backed result. No sandbox, approval, or GitHub write capability was attached. |
| Production build | Passed: `pnpm build` |
| Live health test | Passed: 2 live configuration/health tests |
| Secret-boundary response check | Passed: the runtime base URL is omitted from the mission-status response |
| Database migration | Applied only the reviewed `DROP INDEX trueforge_sessions_missionId_unique` change; no data-destructive migration was applied |

The production build issued only the pre-existing bundle-size warning for a client chunk above 500 kB; it did not fail the build.

## Blockers and Their Effect

The exact live blockers are maintained in [OVERNIGHT_BLOCKERS.md](./OVERNIGHT_BLOCKERS.md), [GITHUB_MCP_RESOURCE_BLOCKER.md](./GITHUB_MCP_RESOURCE_BLOCKER.md), [FIRST_PARTY_MCP_VERTICAL_SLICE.md](./FIRST_PARTY_MCP_VERTICAL_SLICE.md), and [SANDBOX_BLOCKER.md](./SANDBOX_BLOCKER.md). The first-party MCP registration and body-text evidence prerequisites are now satisfied. The important remaining boundaries are live SSE response completion requiring reconciliation, a sandbox provider whose Python bootstrap cannot reach its dependency source through the configured proxy, Qodo Dev connector availability, and explicitly deferred GitHub write/approval prerequisites. SentinelForge fails closed rather than simulating a repair, approval, or GitHub write.

The requested direct hotfix cannot be applied from this task because the active TrueForge server runs on the user's local WSL host. SentinelForge can use its tunnelled HTTP API but has neither that host's source/build artifact nor process-restart control; the only connected local capability is browser access. The isolated offline package reference in Manus was deliberately not patched. See [TRUEFORGE_MCP_RESOURCE_BLOCKER.md](./TRUEFORGE_MCP_RESOURCE_BLOCKER.md) for the exact source target and host-attachment procedure.

An isolated colocation test subsequently confirmed that this managed environment can build and bind a private loopback Node service, but the exact public TrueForge `v0.1.4` tag exposes `/v1/*` and no `/healthz`, whereas SentinelForge's verified runtime contract requires `/healthz` and `/api/v1/*`. The tag also lacks the managed environment's NIM and GitHub MCP credentials. It is therefore not a safe canonical replacement for the current runtime; see [TRUEFORGE_COLOCATION_BLOCKER.md](./TRUEFORGE_COLOCATION_BLOCKER.md).

## Commits and Checkpoint State

No manual Git commit was created during this sprint. The next step is to save a verified managed checkpoint containing the client, persistence migration, tests, blocker report, and this report. The existing working tree also includes inherited pre-sprint modifications; this report distinguishes the current live-integration work from that earlier baseline.

## Exact Morning Next Action

> With the real ordinary-text Investigator evidence now persisted, separately authorize one bounded **read-only Repair Engineer** proposal session for the same planning-stage mission. It must use only `sentinelforge-tools`, propose no GitHub mutation, and remain clearly independent of the still-blocked sandbox, approval, Qodo, and GitHub-write stages.

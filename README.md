# SentinelForge

> **Investigate. Propose. Approve. Verify. Refuse unsafe writes.**

SentinelForge is an approval-gated engineering incident responder built around a real TrueForge runtime and a fail-closed external-action boundary. It gathers evidence, persists an unapplied repair proposal, pauses at a genuine provider approval event, and records an exact `user.tool_approval` continuation. It does **not** apply a repair when isolated verification is unavailable.

## Status in 60 seconds

| Capability | Current status | What is evidenced |
| --- | --- | --- |
| TrueForge sessions, turns, and SSE | **REAL** | Persisted provider session/turn correlation and streamed event audit. |
| First-party MCP evidence | **REAL** | `sentinelforge-tools` supplied ordinary read-only repository file text to the Investigator and Repair Engineer. |
| Repair proposal | **REAL** | A minimal `release-manifest.json` `1.3.0` → `1.4.0` proposal was persisted without application. |
| Human approval | **REAL** | A genuine `tool.approval_required` event was persisted with session, turn, thread, tool-call, and required-action correlation. |
| Approval continuation | **REAL** | One exact `user.tool_approval` continuation was sent and completed. |
| Sandbox verification | **BLOCKED** | Real sandbox `exec` admission reached bootstrap, but the provider proxy could not install `pydantic`; no verifier command ran. |
| GitHub repair write | **REFUSED** | Branch, commit, pull request, and GitHub mutation require a real sandbox pass plus further guarded conditions. |

## How the safety boundary works

```text
Read-only first-party MCP evidence
  → Investigator root cause
  → Repair Engineer unapplied proposal + fingerprint
  → TrueForge approval_required
  → durable operator decision + exact continuation
  → isolated verification
      ├─ PASS: still requires separate write authority
      └─ BLOCKED/FAIL: GitHub write remains refused
```

Approval is not execution. A completed safe workflow can mean that SentinelForge correctly withheld a repair because verification could not establish safety.

## Deterministic incident scenarios

The dashboard also contains no-shell, deterministic contract fixtures. They do not contact TrueForge, a sandbox, MCP, or GitHub; they make the orchestration, evidence, repair-fingerprint, verification, and approval contracts reviewable.

| Scenario | Evidence | Minimal proposal | Deterministic expectation |
| --- | --- | --- | --- |
| Release-manifest version drift | `package.json` `1.0.1` versus `release-manifest.json` `1.0.0` | Align the manifest version | Release check passes after the fixture-only patch. |
| CI workflow Node.js mismatch | `engines.node >=20` versus workflow `node-version: 18` | Update `.github/workflows/ci.yml` to Node 20 | Compatibility check passes after the fixture-only patch. |

## Run locally

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm dev
```

Use the mission dashboard to inspect persisted missions and, if desired, launch a deterministic fixture scenario. The live repair workflow is intentionally not an autonomous GitHub executor.

## Qodo Code Review Evidence

| Field | Evidence |
| --- | --- |
| PR | [#2 — CI workflow compatibility incident scenario](https://github.com/Aayushashsahu/sentinelforge/pull/2) |
| Scope | Adds the second deterministic CI workflow Node.js compatibility scenario and fixes the PR quality workflow package-manager configuration. |
| Qodo review date | 26 August 2026 UTC |
| Material findings | Qodo reported two correctness issues: simulated-action target used a hardcoded fixture repository; workflow audit wording retained release-manifest language. |
| Fixes made | The simulated target now comes from the persisted mission repository; verification and approval text are scenario metadata. Both fixes have regression coverage. |
| Follow-up status | Qodo updated its review to commit `51779da`; the original two findings remain visible as prior-review context. |
| Deferred findings | None. |
| Merge status | **Open and unmerged.** No merge has been requested or performed. |

## AI-use disclosure

AI coding tools were used during SentinelForge implementation. **Manus was used as an implementation and coding agent** for repository inspection, code changes, tests, documentation, and bounded workflow automation. The participant provided the product direction, architecture decisions, safety constraints, review requirements, and final acceptance criteria. The submitted implementation was reviewed and verified through deterministic tests, build checks, and the recorded Qodo pull-request review. The participant remains responsible for understanding the submitted code and all claims made in this repository.

## Safety and evidence

SentinelForge never treats a deterministic fixture pass as a real provider sandbox pass. It does not fall back to host execution, invent approval/provider events, or claim a GitHub repair that did not occur. See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md), [docs/HACKATHON_DEMO.md](./docs/HACKATHON_DEMO.md), [docs/SANDBOX_BLOCKER.md](./docs/SANDBOX_BLOCKER.md), and [docs/TRUEFOUNDRY_SANDBOX_ESCALATION.md](./docs/TRUEFOUNDRY_SANDBOX_ESCALATION.md).

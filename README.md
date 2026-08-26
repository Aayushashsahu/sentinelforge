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
| Dependency plugin major mismatch | `sentinel-plugin ^3.2.0` versus compatibility-manifest major `2` | Align `.sentinelforge/compatibility.json` to major `3` | Compatibility is evaluated from deterministic fixture inputs only after the fixture-only repair is simulated. |

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
| PR #2 | [CI workflow compatibility scenario](https://github.com/Aayushashsahu/sentinelforge/pull/2), reviewed 26 August 2026 UTC. Qodo reported one High/MUST_FIX target-correlation bug and one Medium/SHOULD_FIX audit-wording bug. Both were fixed in `51779da`; Qodo issued a real follow-up update. **Merged into `main`** as `dbcd9cb`. |
| PR #3 | [Dependency compatibility scenario](https://github.com/Aayushashsahu/sentinelforge/pull/3), reviewed 26 August 2026 UTC. Qodo reported one High/MUST_FIX verifier-correctness bug. It was fixed in `e79d730`; Qodo issued a real follow-up update and a retargeted-diff follow-up with no new blocking issue. **Open and unmerged**; no deferred finding. |

Both review cycles and their original findings remain visible as Qodo review history. PR #2 is merged; PR #3 remains open, unmerged, and is not configured for auto-merge.

## AI-use disclosure

AI coding tools were used during SentinelForge implementation. **Manus was used as an implementation and coding agent** for repository inspection, code changes, tests, documentation, and bounded workflow automation. The participant provided the product direction, architecture decisions, safety constraints, review requirements, and final acceptance criteria. The submitted implementation was reviewed and verified through deterministic tests, build checks, and the recorded Qodo pull-request review. The participant remains responsible for understanding the submitted code and all claims made in this repository.

## Safety and evidence

SentinelForge never treats a deterministic fixture pass as a real provider sandbox pass. It does not fall back to host execution, invent approval/provider events, or claim a GitHub repair that did not occur. See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md), [docs/HACKATHON_DEMO.md](./docs/HACKATHON_DEMO.md), [docs/SANDBOX_BLOCKER.md](./docs/SANDBOX_BLOCKER.md), and [docs/TRUEFOUNDRY_SANDBOX_ESCALATION.md](./docs/TRUEFOUNDRY_SANDBOX_ESCALATION.md).

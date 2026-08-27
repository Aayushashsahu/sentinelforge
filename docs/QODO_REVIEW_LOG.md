# Qodo Review Log

**Target repository:** [`Aayushashsahu/sentinelforge`](https://github.com/Aayushashsahu/sentinelforge) (public, default branch `main`). The verified repository spelling is **`sentinelforge`**, not `sentinelforce`.

## Setup Status

| Item | Status | Evidence / next action |
| --- | --- | --- |
| Qodo task connector | **NOT REQUIRED** | Qodo review is supplied by the existing GitHub App rather than a task connector. |
| Qodo GitHub App installation | **REAL** | The authenticated GitHub settings page lists **Qodo Code Review** as an installed GitHub App. |
| SentinelForge repository access | **OWNER-CONFIRMED** | The owner confirmed the existing Qodo installation has already been configured for `Aayushashsahu/sentinelforge`. A supplementary read-only GitHub REST probe could not authenticate because the supplied CLI credential returned HTTP 401; no access setting was changed. |
| Pull-request review capability | **REAL** | Qodo completed real review cycles for PR #2 and PR #3, including documented findings and follow-ups below. [1] |

> **QODO: REAL** — Qodo Code Review is installed and repository access is owner-confirmed. Real review cycles for PR #2 and PR #3, including remediation follow-ups, are recorded below.

## Historical Small Pull-Request Review Plan

This original planning table is superseded by the actual PR #2 and PR #3 review records below. The completed work used discrete reviewable pull requests; Qodo findings were remediated and the review trail was retained.

| Historical plan | Current disposition |
| --- | --- |
| Discrete small reviewable pull requests | Implemented through the merged PR #2 and PR #3 review cycles documented below. |

## Backend Milestone — Sandbox-Blocked Execution Boundary

The sandbox-blocked execution boundary remains a documented, evidence-based limitation: GitHub execution is non-executable without a genuine sandbox pass, the approved fingerprint, correlated provider approval, separate write authorization, and a write-scoped credential.

Qodo has run real reviews for the merged PR #2 and PR #3 scenario increments. This log does not claim a separate Qodo review for the sandbox-blocked execution boundary itself.

The final demo implementation retains the evidence-linked derived timeline (`INVESTIGATING` through `COMPLETED_SAFE`), explicit blocked-verification and write-refusal presentation, a three-minute demo runbook, and architecture documentation. These materials preserve the real-versus-blocked boundary rather than claiming a repaired repository.

## Review Entry Format

For each future pull request, append the PR number and URL, Qodo’s review state, material findings, the implemented fixes, and any justified disagreement. Do not silently dismiss a Qodo finding. No GitHub token or Qodo credential may be copied into this log.

## PR #2 — CI Workflow Compatibility Incident Scenario

| Field | Record |
| --- | --- |
| PR | [#2](https://github.com/Aayushashsahu/sentinelforge/pull/2) — `review/ci-workflow-mismatch` → `main` |
| Scope | Adds a deterministic CI workflow Node.js compatibility scenario with evidence, root cause, minimal workflow patch, canonical repair fingerprint, no-shell verifier expectation, dashboard selector, and regression coverage. |
| Initial Qodo review | **REAL** — 26 August 2026 UTC; Qodo reported two correctness bugs. |
| Finding 1 | **High / MUST_FIX / valid.** A simulated approval action targeted the hardcoded release-manifest fixture repository rather than the persisted mission repository. |
| Fix 1 | `createSimulatedExternalAction` now receives the approved mission repository through the approval port; a regression test verifies the workflow fixture target. Remediation: `51779da`. |
| Finding 2 | **Medium / SHOULD_FIX / valid.** Workflow-scenario audit records retained release-check and manifest-patch wording. |
| Fix 2 | Verification-passed and approval-justification text are scenario metadata; a regression test verifies Node compatibility wording. Remediation: `51779da`. |
| Follow-up | **REAL** — 26 August 2026 UTC. Qodo updated its review to remediation commit `51779da`; the original findings are retained under previous-review context and no additional active finding was issued. |
| CI | GitHub quality workflow initially failed on duplicate pnpm version declarations, then passed after the exact package-manager declaration became the single source of truth. |
| Deferred findings | None. |
| Merge status | **Merged into `main`** as `dbcd9cb3604f096794c43ab36bf2d0246e6da56a` after separate explicit authorization. |

## PR #3 — Dependency Compatibility Incident Scenario

| Field | Record |
| --- | --- |
| PR | [#3](https://github.com/Aayushashsahu/sentinelforge/pull/3) — `review/dependency-compatibility` → `main` |
| Scope | Adds a deterministic plugin-major compatibility scenario and a dashboard selector entry. PR #2 and PR #3 are merged into `main` after separate authorizations. |
| Initial Qodo review | **REAL** — 26 August 2026 UTC; Qodo reported one correctness bug. |
| Finding | **High / MUST_FIX / valid.** The no-shell dependency verifier returned a prewritten pass and did not derive its outcome from fixture inputs or the proposed repair. |
| Fix | The verifier now parses deterministic `package.json` and compatibility-manifest fixture inputs, simulates only the proposed compatibility-manifest update, compares plugin majors, and reports a deterministic failure when the repair is withheld. Remediation: `e79d730`. |
| Follow-up | **REAL** — 26 August 2026 UTC. Qodo updated its review to remediation commit `e79d730`; a later real retargeted-diff static follow-up found no new blocking issue. The original finding is retained as prior-review context. |
| CI | GitHub quality workflow passed for the remediation commit. |
| Deferred findings | None. |
| Merge status | **Merged into `main`** as `a1bfe3804a75275d6986a1947b00a1e5777c86f8` after separate explicit authorization. |

## PR #4 — Approval-Gated Fixture GitHub Proof Executor

| Field | Record |
| --- | --- |
| PR | [#4](https://github.com/Aayushashsahu/sentinelforge/pull/4) — `feature/approval-gated-fixture-proof` → `main` |
| Scope | Adds a server-only, exact-fixture GitHub proof adapter, immutable target and content guards, durable staged action state, proof-specific non-mutating approval gate, continuation correlation binding, partial-outcome stop states, and deterministic tests. No live proof action is invoked by the implementation. |
| Initial Qodo review | **REAL** — 26 August 2026 UTC. Qodo Code Review created review `PRR_kwDOUDCFQ88AAAABLAHQqQ` and reported seven valid bugs at [issue comment 5428739743](https://github.com/Aayushashsahu/sentinelforge/pull/4#issuecomment-5428739743). |
| Findings | **Seven valid findings.** They covered staged-action approval binding, proof-gate tool identity, concurrent execution claiming, partial-PR identity persistence, adapter-level content enforcement, canonical patch validation, and idempotent staging audit correlation. |
| Remediation | Finding 7 was fixed in `499b1f1`. Findings 1–6 were fixed in `9084bbe`: exact staged-action lookup and fingerprint binding; exact gate-tool validation; atomic `STAGED` → `EXECUTING` claim; `PARTIAL_PR_CREATED` with retained PR identity; adapter re-read plus exact transformation check; and canonical one-file patch validation. Deterministic coverage and full local validation passed. |
| Follow-up | **REAL** — Qodo confirmed finding 7’s code remediation at [issue comment 5428778621](https://github.com/Aayushashsahu/sentinelforge/pull/4#issuecomment-5428778621), then confirmed findings 1–6 were remediated at [issue comment 5428873893](https://github.com/Aayushashsahu/sentinelforge/pull/4#issuecomment-5428873893). Its later status-only recheck formally states that **finding 7 remains dismissed** and that no code change or further action is required at [issue comment 5428975584](https://github.com/Aayushashsahu/sentinelforge/pull/4#issuecomment-5428975584). |
| Merge status | **Merged into `main`** as `8fa85a90e48ae5dc5b3d183fb07ca372e5d30e05` after separate explicit authorization. |

## PR #5 — GitHub Write-Capability Evidence Hardening

| Field | Record |
| --- | --- |
| PR | [#5](https://github.com/Aayushashsahu/sentinelforge/pull/5) — `security/write-capability-evidence` → `main` |
| Scope | Adds a default-deny, repository-bound capability-evidence policy for the existing fixture-only branch, exact manifest-update, and PR-create boundaries. The policy does not infer write authority from metadata, contents, pull-request reads, ownership, or rulesets visibility. |
| Initial Qodo review | **REAL** — review `PRR_kwDOUDCFQ88AAAABLBIycQ`, submitted 26 August 2026 UTC for commit `3360c1f`. The Qodo review comment described the operation-specific fail-closed boundary as appropriate and did not issue a severity-labelled finding. [2] |
| Findings | **None issued.** Qodo provided an assessment and change summary, not a High, Medium, or Low defect report. No remediation was required. |
| Follow-up | **REAL** — the owner invoked `/agentic_review`; Qodo created follow-up review `PRR_kwDOUDCFQ88AAAABLBKItA` and confirmed its review was updated through the same commit. [3] |
| Deferred findings | None. |
| Merge status | **Merged into `main`** as `71a2e41d4042541f06166fb6b298b2dd9a7fed8c` after separate explicit authorization. No provider action, sandbox action, or fixture-repository mutation occurred. |

## PR #6 — Opt-In Live Fixture Proof Harness

| Field | Record |
| --- | --- |
| PR | [#6](https://github.com/Aayushashsahu/sentinelforge/pull/6) — `test/live-fixture-proof-harness` → `main` |
| Scope | Adds a disabled-by-default integration harness that composes the existing live Investigator, Repair Engineer, fixture-gate approval capture, durable approval persistence, continuation bridge, immutable executor, audit persistence, allowlists, and write-capability policy. The harness itself was **not** enabled or run. |
| Initial Qodo review | **REAL** — review `PRR_kwDOUDCFQ88AAAABLBVYVA`, submitted 26 August 2026 UTC for `7a06a9e`. Qodo reported two valid correctness findings. [4] |
| Finding 1 | **High / MUST_FIX / valid.** The proof sequence accepted file-call ordering without proving the exact allowlisted owner, repository, `main` ref, successful response correlation, or observed package/manifest versions. |
| Finding 2 | **Medium / SHOULD_FIX / valid.** The approval pause and provider turn could be selected independently of the fixture-gate model event, risking a false checkpoint or wrong continuation correlation. |
| Remediation | Commit `118787d` validates exact request arguments; binds response bodies to their corresponding same-turn calls and expected versions; requires the gate after both reads; and requires the approval pause’s tool-call and `source_event_id` to match the gate event. Eight focused deterministic sequence tests cover success plus fail-closed owner, repository, ref, body, source-event, ordering, and missing-pause cases. |
| Follow-up | **REAL** — the owner invoked `/agentic_review`; Qodo created follow-up review `PRR_kwDOUDCFQ88AAAABLBYlig` and confirmed review coverage through `118787d`. [5] The update did not publish a separate formal dismissal message, so this log records the evidenced code fix and Qodo’s updated review without overstating formal clearance. |
| Deferred findings | None. |
| Merge status | **Open, unmerged.** No merge, auto-merge, provider action, approval, continuation, sandbox action, fixture branch, fixture commit, or fixture PR occurred. |

## PR #7 — Stateful MCP Safety Tools

| Field | Record |
| --- | --- |
| PR | [#7](https://github.com/Aayushashsahu/sentinelforge/pull/7) — `feat/stateful-mcp-safety-tools` → `main` |
| Scope | Replaces constant `approval_probe` and `repair_proposal_gate` MCP stubs with bounded, structured inspectors over persisted SentinelForge state. The inspectors read only existing mission/action data and policy evidence; they cannot approve, continue, persist, call a provider, invoke a sandbox, or execute a GitHub action. |
| Initial Qodo review | **REAL** — Qodo submitted formal review `PRR_kwDOUDCFQ88AAAABLBnGAw` on 26 August 2026 UTC for commit `6e12544`, with its published finding details at [issue comment 5430811515](https://github.com/Aayushashsahu/sentinelforge/pull/7#issuecomment-5430811515). |
| Finding 1 | **High / MUST_FIX / valid.** Mission-only `approval_probe` calls could never show a usable persisted approval because ownership was treated as fixture-action-only even though the prompt supplies only a mission identifier. |
| Finding 2 | **High / MUST_FIX / valid.** An action-backed request could select a newer unrelated waiting turn instead of proving the exact action-persisted turn/thread/tool-call/required-action checkpoint. |
| Finding 3 | **Medium / SHOULD_FIX / valid.** Any historical sandbox `PASS` could mask a newer non-passing verification run, giving inaccurate sandbox readiness evidence. |
| Remediation | Commit `0850802` selects one unambiguous mission-only `TRUEFORGE_PENDING:approval_probe` record, binds action-backed calls to every persisted action checkpoint field (`turnId`, `threadId`, `toolCallId`, and `requiredActionId`), and derives sandbox state from the newest persisted run. Focused regressions cover each concern; full deterministic validation passed. |
| Follow-up | **REAL** — Qodo submitted `COMMENTED` review `PRR_kwDOUDCFQ88AAAABLBq_NA` for remediation commit `0850802b6f5b619cc479f35a5405c51f0b4eaf5c`. Qodo also posted that its code review was [updated through that commit](https://github.com/Aayushashsahu/sentinelforge/pull/7#issuecomment-5430811515). The review body is empty; this record does **not** claim a formal dismissal or clearance. The earlier busy response remains historical context only. |
| CI | GitHub `quality` workflow succeeded for remediation head `0850802b6f5b619cc479f35a5405c51f0b4eaf5c`. Local remediation validation passed: frozen install, type check, 153 deterministic tests with 16 opt-in live tests skipped, production build, and whitespace check. |
| Deferred findings | None. All published High and practical Medium findings were remediated. The real follow-up review contains no body, so no formal Qodo dismissal or clearance is claimed. |
| Merge status | **Merged externally into `main`** as `25c35d7ee2f0741a95f0975dd3bce0715a83fdcb` by `app/manus-connector` at 2026-08-26 20:45:14 UTC. No duplicate merge was performed. |

## PR #8 — Configured GitHub Write-Capability Model

| Field | Record |
| --- | --- |
| PR | [#8](https://github.com/Aayushashsahu/sentinelforge/pull/8) — `security/configured-write-capability-model` → `main` |
| Scope | Distinguishes exact fixture-only configured capability declarations from remote GitHub endpoint enforcement and the unobservable complete fine-grained-token manifest. Immutable request, approval, fingerprint, idempotency, base/content-SHA, and sanitized-failure safeguards remain intact. |
| Initial Qodo review | **REAL** — Qodo completed its initial assessment at [issue comment 5433524694](https://github.com/Aayushashsahu/sentinelforge/pull/8#issuecomment-5433524694), reporting **0 bugs, 0 rule violations, and 0 requirement gaps** for implementation commit `71b87f0`. |
| Findings | **None issued.** No remediation or justified disagreement was required. |
| Follow-up | **REAL** — after the owner invoked [`/agentic_review`](https://github.com/Aayushashsahu/sentinelforge/pull/8#issuecomment-5433528407), Qodo confirmed at [issue comment 5433538872](https://github.com/Aayushashsahu/sentinelforge/pull/8#issuecomment-5433538872) that the code review was updated through `71b87f0`; its review context reports no changes from the previous review. |
| CI | GitHub `quality` workflow succeeded for `71b87f0d8de7073c9518f36c43e5fea551723337`. Local validation passed: frozen install, type check, 161 deterministic tests with 16 opt-in live tests skipped, production build, and whitespace check. |
| Deferred findings | None. |
| Merge status | **Open, unmerged.** No provider turn, approval, continuation, sandbox run, fixture branch, fixture commit, fixture PR, or other live proof action occurred. |

## PR #9 — Strict Configured-Capability Array Parser

| Field | Record |
| --- | --- |
| PR | [#9](https://github.com/Aayushashsahu/sentinelforge/pull/9) — `security/server-authoritative-fixture-gate` → `main` |
| Scope | Corrects only the local `GITHUB_SCRATCH_CONFIGURED_CAPABILITIES` parser to accept the established exact JSON array contract and reject empty, incomplete, malformed, object-shaped, wrong-target, unsupported, or duplicate declarations. It neither changes the GitHub capability policy nor treats configured values as remote permission proof. |
| Initial Qodo review | **REAL** — Qodo completed an initial no-issue assessment at [issue comment 5434089541](https://github.com/Aayushashsahu/sentinelforge/pull/9#issuecomment-5434089541) for `87427e1`, reporting **0 bugs, 0 rule violations, and 0 requirement gaps**. |
| Findings | **None issued.** No remediation or justified disagreement was required. |
| Follow-up | **REAL** — after one [`/agentic_review`](https://github.com/Aayushashsahu/sentinelforge/pull/9#issuecomment-5434095676) request, Qodo confirmed at [issue comment 5434101212](https://github.com/Aayushashsahu/sentinelforge/pull/9#issuecomment-5434101212) that its review was updated through the same commit. |
| CI | GitHub `quality` workflow succeeded for `87427e1436b758953da5d2a4f95db2c4ecf576b7`. Local validation passed: frozen install, type check, 177 deterministic tests with 16 opt-in live tests skipped, production build, and whitespace check. |
| Deferred findings | None. |
| Merge status | **Open, unmerged.** No provider turn, approval, continuation, sandbox run, fixture branch, fixture commit, fixture PR, or other live proof action occurred. |

## PR #10 — Legal Fixture-Proof Planning Lifecycle

| Field | Record |
| --- | --- |
| PR | [#10](https://github.com/Aayushashsahu/sentinelforge/pull/10) — `fix/fixture-proof-legal-lifecycle` → `main` |
| Scope | Adds a narrow setup helper for the one-use fixture-proof runner. It preserves the production state machine’s refusal of direct `CREATED` → `PLANNING_FIX` and uses only the legal `CREATED` → `INVESTIGATING` → `PLANNING_FIX` path, with exact canonical proposal and idempotency checks. |
| Initial Qodo review | **REAL** — Qodo submitted review `PRR_kwDOUDCFQ88AAAABLD9jTw` on 27 August 2026 UTC for `7d59696`. Its assessment found **0 bugs, 0 rule violations, and 0 requirement gaps** at [issue comment 5434500761](https://github.com/Aayushashsahu/sentinelforge/pull/10#issuecomment-5434500761). |
| Findings | **None issued.** No remediation or justified disagreement was required. |
| Follow-up | **REQUESTED / PENDING** — after one [`/agentic_review`](https://github.com/Aayushashsahu/sentinelforge/pull/10#issuecomment-5434501786) request, Qodo replied that it was busy at [issue comment 5434502935](https://github.com/Aayushashsahu/sentinelforge/pull/10#issuecomment-5434502935). No formal follow-up review appeared during the authorized bounded wait. |
| CI | GitHub `quality` workflow succeeded for `7d59696afa1b386822d77021614a243cc17a0dfd`. Local validation passed: frozen install, type check, 181 deterministic tests with 16 opt-in live tests skipped, production build, and whitespace check. |
| Deferred findings | None. No initial finding requires a fix; **formal Qodo follow-up remains pending**. |
| Merge status | **Open, unmerged.** No provider turn, proof action, approval, continuation, sandbox run, fixture branch, fixture commit, fixture PR, or other live proof action occurred. |

## PR #11 — Server-Derived Fixture Artifact Reads

| Field | Record |
| --- | --- |
| PR | [#11](https://github.com/Aayushashsahu/sentinelforge/pull/11) — `security/fixture-artifact-selector` → `main` |
| Scope | Removes model control over the fixture-proof owner, repository, reference, and path. Action-bound `get_file` calls carry only proof identifiers plus an allowed artifact selector; the server derives the canonical target from immutable action intent. |
| Initial Qodo review | **REAL** — Qodo submitted review `PRR_kwDOUDCFQ88AAAABLGIC1A` on 27 August 2026 UTC for `5d47876`, reporting one valid correctness finding at [issue comment 5437494711](https://github.com/Aayushashsahu/sentinelforge/pull/11#issuecomment-5437494711). |
| Finding | **Medium / SHOULD_FIX / valid.** The initial action-bound read guard rejected only four legacy target keys, allowing other extra fields despite the promised exact three-field fixture interface. |
| Remediation | The MCP handler and post-stream validator now accept exactly `proof_mission_id`, `proof_action_id`, and `artifact`; all other fields are rejected before GitHub I/O. Both JSON-schema alternatives now set `additionalProperties: false`, and deterministic regressions cover alias and arbitrary-field injection. |
| Follow-up | **REAL** — after the remediation request at [issue comment 5437535828](https://github.com/Aayushashsahu/sentinelforge/pull/11#issuecomment-5437535828), Qodo confirmed at [issue comment 5437546155](https://github.com/Aayushashsahu/sentinelforge/pull/11#issuecomment-5437546155) that its review was updated through remediation commit `8de88e3`. The original Medium finding remains retained in review history; no additional finding was issued. |
| Deferred findings | None. |
| Merge status | **Open, unmerged.** No provider turn, proof action, approval, continuation, sandbox run, fixture branch, fixture commit, fixture PR, or other live proof action occurred. |

## PR #12 — Fixture-Read Credential Boundary

| Field | Record |
| --- | --- |
| PR | [#12](https://github.com/Aayushashsahu/sentinelforge/pull/12) — `security/s2-fixture-read-credential` → `main` |
| Scope | Preserves the existing generic `GITHUB_READ_TOKEN` read path while making valid persisted action-bound fixture reads resolve only server-side `GITHUB_SCRATCH_PR_TOKEN`. The fixture branch remains model-token-free, schema-token-free, server-derived, and fail-closed without scratch-to-generic fallback. |
| Initial Qodo review | **REAL** — 27 August 2026 UTC. After the first [`/agentic_review` request](https://github.com/Aayushashsahu/sentinelforge/pull/12#issuecomment-5437857210), Qodo published an automated code-review assessment for commit `712169d`, reporting **0 bugs, 0 rule violations, and 0 requirement gaps**. |
| Finding | **Medium / SHOULD_FIX / valid.** On its review of the documentation-record update through `8d8485d`, Qodo found that the follow-up row was internally contradictory: it recorded `REQUESTED / PENDING` while saying the request would occur later. |
| Remediation | This record now identifies only completed events: the initial request, the actual second [`/agentic_review` request](https://github.com/Aayushashsahu/sentinelforge/pull/12#issuecomment-5437878331), and the factual status of the resulting review. The correction changes no application behavior, credential path, or live-proof operation. |
| Follow-up | **REAL** — after the remediation request at [issue comment 5437900636](https://github.com/Aayushashsahu/sentinelforge/pull/12#issuecomment-5437900636), Qodo confirmed at [issue comment 5437867056](https://github.com/Aayushashsahu/sentinelforge/pull/12#issuecomment-5437867056) that its code review was updated through remediation commit `2f67bcb`. No additional issue was published. The original Medium finding remains retained as historical review context; Qodo did not publish a separate formal dismissal message. |
| Local validation | Frozen install, type check, 197 deterministic tests with 16 opt-in live tests skipped, production build, and whitespace check passed for `712169d`. |
| Deferred findings | None. |
| Merge status | **Open, unmerged.** This PR has not started a provider session, staged a fixture action, requested an approval, sent a continuation, called the fixture repository, invoked a sandbox, or performed any fixture-repository mutation. |

## PR #13 — Server-Orchestrated Fixture Evidence Capture

| Field | Record |
| --- | --- |
| PR | [#13](https://github.com/Aayushashsahu/sentinelforge/pull/13) — `security/s2-server-evidence-capture` → `main` |
| Scope | Replaces model-selected fixture-proof file reads with a server-only, action-bound scratch-credential evidence component. The provider receives only the non-mutating fixture gate after the server verifies the canonical `package.json` and `release-manifest.json` versions. Generic investigation reads, continuation semantics, the immutable executor, capability policy, and sandbox boundary remain separate and fail-closed. |
| Initial Qodo review | **REAL** — 27 August 2026 UTC. Qodo submitted a review for `260fd2a` and published one validity-confirmed finding at [issue comment 5439540573](https://github.com/Aayushashsahu/sentinelforge/pull/13#issuecomment-5439540573). |
| Finding | **Priority not label-published / MUST_FIX / valid.** Server-evidence markers originally copied fixed version values from persisted action intent, while the read bodies were validated against fixture constants. A corrupted intent could therefore produce markers inconsistent with the actual verified versions before later execution validation. |
| Remediation | Commit `8ce29ef` rejects any persisted fixture action whose path or fixed version fields differ from the canonical constants. It records canonical constants in server evidence and independently checks the same constants at correlation binding, gate eligibility, and proof-specific approval persistence. Focused deterministic tests cover malformed persisted versions and passed. |
| Follow-up | **REAL** — after the documented [`/agentic_review` request](https://github.com/Aayushashsahu/sentinelforge/pull/13#issuecomment-5439564248), Qodo confirmed that its review was updated through `8ce29ef` at [issue comment 5439540573](https://github.com/Aayushashsahu/sentinelforge/pull/13#issuecomment-5439540573). The update did not publish a separate formal dismissal or a new issue. |
| Deferred findings | None. The one valid finding was remediated. |
| Merge status | **Open, unmerged.** No live proof, provider session, fixture-repository call, approval, continuation, sandbox run, branch, commit, pull request, merge, or other external proof action occurred. |

## PR #16 — Provider-History Correlation Hardening

| Field | Record |
| --- | --- |
| PR | [#16](https://github.com/Aayushashsahu/sentinelforge/pull/16) — `fix/s2-provider-history-normalization` → `main` |
| Scope | Preserves raw fixture-provider history, produces a separate provenance-aware normalized view using only capture-session and documented parent-envelope turn context, validates initialization through `mcp_servers[].name`, and fails closed on incomplete, malformed, conflicting, duplicate, or misordered approval correlation. It does not change the executor, credential policy, approval architecture, mission lifecycle, sandbox boundary, fixture repository, or external-action semantics. |
| Initial Qodo review | **REAL** — Qodo submitted formal `COMMENTED` review `PRR_kwDOUDCFQ88AAAABLJdL3A` on 27 August 2026 UTC for `2d67f0c`, with its three findings at [issue comment 5442000417](https://github.com/Aayushashsahu/sentinelforge/pull/16#issuecomment-5442000417). Qodo’s earlier PR summary/high-level assessment is separately retained at [issue comment 5441976784](https://github.com/Aayushashsahu/sentinelforge/pull/16#issuecomment-5441976784). |
| Finding 1 | **High / MUST_FIX / valid.** A direct SSE completion could contain a valid fixture approval sequence whose child initialization or approval events omit `turn_id`; applying the history-only normalizer directly to that stream would fail before a documented parent session-history envelope was retrieved. |
| Finding 2 | **Medium / SHOULD_FIX / valid.** A correlation or validation rejection occurred before provider-history audit persistence, losing the forensic raw history needed to explain a safe refusal. |
| Finding 3 | **Medium / SHOULD_FIX / valid.** The raw audit row projected selected metadata rather than retaining a safe, complete representation of the provider event used by validation. |
| Remediation | Commit `afc3a8f` adds a bounded session-history reader, makes capture retrieve the documented history envelope before normalization, persists raw history before a potentially rejecting normalization, and persists a separate complete normalized view with provenance. Raw audit copies retain event, data, and envelope fields while redacting secret-shaped field values. Deterministic regressions cover authoritative envelope mapping and safe complete raw-audit retention. |
| Follow-up | **REAL** — after the remediation request at [issue comment 5442054391](https://github.com/Aayushashsahu/sentinelforge/pull/16#issuecomment-5442054391), Qodo initially replied that it was busy at [issue comment 5442056145](https://github.com/Aayushashsahu/sentinelforge/pull/16#issuecomment-5442056145), then submitted `COMMENTED` review `PRR_kwDOUDCFQ88AAAABLJgwJg` at 16:25:21 UTC for remediation commit `afc3a8f`. Its review body was empty and no new Qodo issue comment, formal dismissal, or additional finding was published. |
| Merge status | **Open, unmerged.** No provider turn, approval, continuation, fixture-repository access or mutation, sandbox operation, external proof action, or merge occurred. |

## References

[1] [Qodo GitHub Marketplace listing](https://github.com/marketplace/qodo-merge-pro) — states the installation sequence: install the GitHub App, select repositories, then open a PR for automatic review.

[2] [PR #5 Qodo initial review comment](https://github.com/Aayushashsahu/sentinelforge/pull/5#issuecomment-5430144582) — Qodo’s real initial assessment for the write-capability hardening commit.

[3] [PR #5 Qodo follow-up update](https://github.com/Aayushashsahu/sentinelforge/pull/5#issuecomment-5430174693) — Qodo’s real update after the documented `/agentic_review` request.

[4] [PR #6 Qodo initial review comment](https://github.com/Aayushashsahu/sentinelforge/pull/6#issuecomment-5430417799) — real Qodo High and Medium correctness findings for the original harness implementation.

[5] [PR #6 Qodo follow-up update](https://github.com/Aayushashsahu/sentinelforge/pull/6#issuecomment-5430491188) — real Qodo update through the remediation commit.

[6] [PR #7 Qodo initial automated assessment](https://github.com/Aayushashsahu/sentinelforge/pull/7#issuecomment-5430774860) — Qodo’s real initial review summary for the stateful MCP safety-tool implementation.

[7] [PR #7 Qodo follow-up pending response](https://github.com/Aayushashsahu/sentinelforge/pull/7#issuecomment-5430789314) — Qodo’s real response after the one requested `/agentic_review` follow-up, which did not yet provide a completed review.

[8] [PR #8 Qodo initial no-issue review](https://github.com/Aayushashsahu/sentinelforge/pull/8#issuecomment-5433524694) — real Qodo assessment showing zero issued findings.

[9] [PR #8 Qodo follow-up update](https://github.com/Aayushashsahu/sentinelforge/pull/8#issuecomment-5433538872) — real Qodo update after the documented `/agentic_review` request.

[10] [PR #9 Qodo initial no-issue review](https://github.com/Aayushashsahu/sentinelforge/pull/9#issuecomment-5434089541) — real Qodo assessment showing zero issued findings.

[11] [PR #9 Qodo follow-up update](https://github.com/Aayushashsahu/sentinelforge/pull/9#issuecomment-5434101212) — real Qodo update after the documented `/agentic_review` request.

[12] [PR #10 Qodo initial no-issue review](https://github.com/Aayushashsahu/sentinelforge/pull/10#issuecomment-5434500761) — real Qodo assessment showing zero issued findings.

[13] [PR #10 Qodo follow-up pending response](https://github.com/Aayushashsahu/sentinelforge/pull/10#issuecomment-5434502935) — real Qodo response after the one requested `/agentic_review` follow-up, which did not yet provide a completed review.

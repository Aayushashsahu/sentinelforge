# SentinelForge S7 Final Forensic Audit

**Audit disposition:** **FIX BEFORE FINAL — submission and production-safety freeze blocked**

**Scope.** This report is a read-only hostile review of repository history, current public GitHub state, implementation boundaries, test/build evidence, dependency hygiene, documentation, and the recorded S2/S4/S5 evidence chain. The only project changes made during S7 are documentation corrections and this report. S7 did **not** create a provider session or turn, request/resolve approval, send a continuation, invoke a sandbox, access or mutate the fixture repository through SentinelForge, create a branch/commit/PR, merge, alter secrets, change configuration, or modify product code.

> **Bottom line.** SentinelForge has a credible, bounded S2 external-action receipt and substantial fail-closed implementation work. It is not ready for a final safety or production submission claim because the public API exposes live-provider and approval mutations without an authenticated operator boundary, the protected-write configuration is not cryptographically or operationally bound to the credential that performs the network write, the planning lifecycle retains atomicity/concurrency risks, and the production dependency audit reports unresolved Critical and High advisories.

## 1. Executive Assessment

The project’s strongest evidence is the completed one-time fixture proof: an immutable intent, server-derived evidence, genuine provider approval checkpoint, exact continuation, and a single verified open fixture PR. The external fixture PR remains open, unmerged, and one-file scoped. This is a legitimate bounded proof, rather than a claimed sandbox pass or a generic GitHub automation capability. [1]

The audit also confirms that the real-repair sandbox is still honestly blocked at provider bootstrap. The evidence records `truefoundry-system/exec` admission, followed by a `pydantic` bootstrap failure through the provider’s package-index/proxy path before the repair command ran. The related provider issue is public and open, but no response or supported remediation was observed during the bounded S5 review. [2] [3]

| Dimension | Score | Evidence-based disposition |
| --- | ---: | --- |
| TrueForge / first-party MCP integration | 14 / 20 | Historical live sessions, approval pause, and ordinary MCP file-text delivery are documented; current availability is not assumed. |
| Approval and public control boundary | 5 / 20 | Internal correlation/idempotency is strong, but public mutation routes have no demonstrated authentication or operator authorization. |
| S2 bounded external-action proof | 13 / 15 | External PR #1 is open, unmerged, clean, and manifest-only; scope is deliberately fixture-only. |
| Real-repair sandbox verification | 2 / 10 | A real provider attempt failed before verifier execution; no fallback or fake pass was used. |
| Evidence and documentation integrity | 8 / 10 | S7 corrected material stale claims and Qodo counts; archived records are now marked as historical. |
| Tests and build | 8 / 10 | Type check, deterministic tests, frozen install, build, and whitespace validation pass; live tests are intentionally skipped. |
| Dependency hygiene | 0 / 5 | Production audit reports 1 Critical, 21 High, 49 Moderate, and 10 Low advisories. |
| Qodo trail | 3 / 5 | Real Qodo evidence exists, but several findings lack formal public dismissal and the historical log had material inaccuracies. |
| Judge-facing demo reliability | 2 / 5 | Existing S4 recording is evidence-grounded; current mission route visibly remains in a loading state in the audit environment. |
| Repository hygiene | 4 / 5 | No full token-shaped value was found in reachable Git history; local commit identity must be corrected before any future commit. |
| **Overall** | **59 / 100** | **FIX BEFORE FINAL** |

The numeric score is a triage aid, not a judging forecast. It assigns no credit for evidence that cannot be independently shown or for safety controls undermined by their public entrypoints.

## 2. Verified Safety and Evidence Chain

### 2.1 S2 fixture proof

| Control | Independently checked fact | Assessment |
| --- | --- | --- |
| Target restriction | The implementation hard-codes `Aayushashsahu/sentinelforge-incident-fixture`, `main`, `release-manifest.json`, and `1.3.0 → 1.4.0` in the immutable fixture intent. | Confirmed in source. |
| Server evidence | The action-bound server component requires the scratch credential, validates the persisted mission/action/fingerprint, reads only `package.json` and `release-manifest.json`, and records `SERVER_ORCHESTRATED` evidence. | Confirmed in source. |
| Model boundary | The first-party MCP server rejects model-supplied fixture targets and rejects model-driven fixture evidence reads; its fixture gate requires both server evidence flags. | Confirmed in source. |
| Provider approval | Fixture approval persistence requires the exact provider gate name plus correlated session, turn, thread, gate-call, and approval metadata. | Confirmed in source and documented evidence. |
| Continuation | The staged continuation must match the stored approval tuple and moves the action to a one-time `STAGED` state. | Confirmed in source. |
| External receipt | Fixture PR [#1](https://github.com/Aayushashsahu/sentinelforge-incident-fixture/pull/1) is open, non-draft, clean, unmerged, and auto-merge is not requested. GitHub attributes its sole commit to Aayush Sahu and reports `release-manifest.json` as the only changed file. | Confirmed by read-only GitHub inspection. |

The project correctly distinguishes this bounded proof from the real-repair path. In particular, the proof is **not** evidence that the sandbox passed, that arbitrary repositories are writable, or that a repair mission can bypass verification. [1] [2]

### 2.2 Sandbox and provider boundary

The sandbox report is candid about what is and is not established. It shows that the internal sandbox tool was reached, but that bootstrap failed while resolving `pydantic`; it records a failed run (`run_j54bJdCCAxF7fO`) with exit code `2`, empty stdout, and sanitized stderr. The repair did not run on the host or in a usable sandbox. [2]

S7 confirms that `truefoundry/trueforge` issue [#482](https://github.com/truefoundry/trueforge/issues/482) is open for the provider-side bootstrap/package-index failure. No provider response, prebuilt image/snapshot, repaired proxy path, or documented workaround was observed. A fresh sandbox verification was therefore ineligible and was not attempted. [3]

One historical control concern remains visible in the blocker record: it reports a follow-on provider `exec` request after the bootstrap failure within the same provider turn. Although no repair command ran and no host fallback occurred, this does not satisfy the intended single-command failure discipline. Treat this as a **historical process-control defect** to eliminate before any future sandbox attempt.

## 3. Hostile-Review Findings

### F-01 — Public tRPC mutations permit live provider and approval-state effects

**Severity: Critical. Status: unresolved.** `server/routers.ts` exposes `createLive`, `investigate`, `runRepairPlan`, `sandboxProbe`, `approvalProbe`, and `decideApproval` through `publicProcedure`. `server/_core/trpc.ts` defines `publicProcedure` as a raw `t.procedure`, and `server/_core/context.ts` contains only Express request/response objects—no session-derived user or role. The live-workflow functions create database missions, create real TrueForge sessions/turns, and invoke sandbox-probe / approval-probe paths. The generic decision endpoint can approve or reject persisted approval requests and creates the simulated external-action record after approval.

This finding does not state that the completed S2 fixture executor is directly browser-callable; its direct executor remains server-side. It does mean a hostile anonymous caller can trigger live provider attempts, consume resources, alter mission/approval state, and weaken the claimed “human operator” boundary in the exposed application surface.

**Required remediation before final safety claims:** introduce authenticated procedures, enforce owner/operator authorization for every mutation, remove or separately protect live diagnostics, bind audit actor identity to the authenticated principal, and add negative authorization tests. Do not rely on hidden UI controls as a substitute.

### F-02 — Protected-write configuration is not bound to the credential used for the write

**Severity: High. Status: unresolved.** `GitHubWriteCapabilityPolicy` validates an explicit fixture-bound configuration record, while `GitHubFixtureWriteApi` receives and sends a bearer token separately. The policy expressly does not prove the remote credential’s capability. Qodo’s initial PR #5 review identified this as a High issue: evidence associated with one credential could authorize a network write attempted with another or rotated token. [4]

GitHub remains a final enforcement boundary, so this does not prove an unauthorized write can succeed. It does mean SentinelForge’s local policy cannot establish that the capability evidence describes the credential actually sent. The Qodo follow-up did not publish a formal dismissal; S7 does not treat its presence as clearance.

**Required remediation before final safety claims:** derive a non-reversible credential identifier at load time, bind capability evidence and the write adapter to the same trusted credential object, invalidate evidence on token rotation, and add a regression that a mismatched credential identity cannot reach `fetch`.

### F-03 — Fixture planning state and audit persistence are non-atomic and race-prone

**Severity: High. Status: unresolved.** The current planning helper reads state, then performs independent `setMissionStatus` and `appendAudit` calls. It lacks a compare-and-set guard or transaction. Qodo’s PR #10 review reported a High audit-loss path and a Medium concurrent planning-overwrite path; the current source retains the separately executed writes. [5]

**Required remediation before final safety claims:** use one transactional repository operation (or state-versioned compare-and-set) that writes the planning state and its audit event together, establishes immutable proposal data once, and validates concurrency with deterministic race/failure tests.

### F-04 — Production dependency audit contains Critical and High advisories

**Severity: High. Status: unresolved.** `pnpm audit --prod` reported **1 Critical, 21 High, 49 Moderate, and 10 Low** advisories. The inventory includes a Critical `fast-xml-parser` entity-encoding bypass and High advisories affecting `fast-xml-parser`, `form-data`, `lodash`, `lodash-es`, `nanoid`, and `path-to-regexp`; it also includes a reported Drizzle ORM identifier-escaping issue. The dependency manifest currently uses ranges that allow older vulnerable transitive resolutions.

`pnpm install --frozen-lockfile` succeeds, but emits a warning that `pnpm.patchedDependencies` and `pnpm.overrides` in `package.json` are no longer read by the package manager. The lockfile retains the intended Wouter patch and override metadata, so this is a reproducibility/hygiene warning rather than proof that the current installed patch is absent.

**Required remediation before final safety claims:** update and verify production dependency resolutions, move PNPM configuration to the supported configuration file for the project’s package-manager version, regenerate and review the lockfile, then re-run audit and runtime tests. Do not use a blanket audit suppression.

### F-05 — The current live mission surface is not a reliable S2 demo receipt

**Severity: Medium. Status: unresolved.** S7’s read-only visual check found that the home surface reported zero persisted mission/approval counters and the `/missions/SF_kqb-rEpDFIUg-I` route rendered the intentional loading card without displaying the mission. The audit could not locate corresponding browser/network log files, so it does not attribute a root cause. This is an observed reproducibility limitation, not a claim that records are false.

**Required remediation before final demo claims:** make the screen evidence accessible to an authenticated reviewer in a stable environment or treat the externally verified fixture PR plus the existing recorded S4 evidence as the sole demo receipt. Add a release-ready UI check that fails if the documented evidence route cannot render its expected persisted record.

### F-06 — Documentation had material stale or incomplete claim paths

**Severity: Medium. Status: corrected in documentation; underlying historic events unchanged.** Before S7, several documents described merged PRs #6–#16 as open/unmerged, described the current system as “not connected,” stated that no continuation had been sent, and left the historical “no video/no GitHub action” statements in current-sounding documents. The Qodo log also said PR #5 had no findings, PR #6 had two rather than four findings, PR #7 had three rather than four initial findings, and PR #10 had zero rather than two findings.

S7 corrected only independently verifiable documentation: it reconciled merge states to public GitHub, corrected published Qodo counts, and labelled earlier no-write/no-video documents as historical snapshots. It does not claim formal Qodo clearance where no dismissal exists. The changes do not remediate F-01 through F-05.

## 4. Credential, Secret, and Repository Hygiene

The current source separates generic `GITHUB_READ_TOKEN` use from the action-bound `GITHUB_SCRATCH_PR_TOKEN` path. Fixture evidence code resolves only the scratch token server-side; the MCP tools do not expose a write tool and report `writeActionsEnabled: false`. GitHub error diagnostics redact bearer credentials, token/cookie/secret keyed values, and known GitHub token shapes before persistence. [6]

S7 scanned tracked files and reachable Git revisions for full GitHub token-shaped values, AWS access-key patterns, and private-key headers. No full token-shaped value was found. The sole current-source match for an unqualified GitHub token prefix is the intentional redaction regular expression in the diagnostics sanitizer. History’s two unqualified `github_pat_` matches are associated with the diagnostic hardening commits; filename-only follow-up did not reveal a credential-bearing file.

| Hygiene item | S7 conclusion |
| --- | --- |
| Raw credential in current tracked source | Not found by token-shape scan. |
| Raw credential in reachable Git history | Not found by token-shape scan. |
| Sensitive error persistence | Sanitizer exists and handles token/authorization/cookie/secret labels; test coverage is present. |
| Git identity | The current local repository identity is `Manus <manus@example.com>`. No S7 commit was made. Set the participant identity before any future commit. |
| Large/binary artifacts in tracked source | No tracked video/binary submission artifact was identified; local build/output and log directories are ignored. |

## 5. Qodo and Public GitHub Review Trail

The audit confirms real Qodo GitHub App evidence across the small pull-request series. PRs #2–#16 and #18 are currently merged. PR #17 is the sole open SentinelForge PR, a clean, non-draft documentation reconciliation PR targeting `main`; it is not evidence of a full repository review. Public `main` was observed at `6dc158ea5f2e65fd737c370962d08a957422b9bc`, with the latest SentinelForge CI run successful. [7]

The corrected Qodo ledger now follows three rules: a published finding remains a historical fact even after a code change, a review update is not a formal dismissal unless Qodo says so, and a PR’s merged state must be independently checked rather than carried forward from an old note. The open PR #17 adds a no-issues documentation comment, but this must not be presented as Qodo clearing the entire project.

## 6. Quality Evidence and Its Limits

| Check | Result | Limit |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | Passed | Emits PNPM configuration warning. |
| `pnpm check` | Passed | Static TypeScript only. |
| `pnpm test` | 34 files / 230 tests passed; 16 opt-in live tests skipped | Does not validate currently available provider/sandbox connectivity. |
| `pnpm build` | Passed | Emits a client chunk-size warning (>500 kB). |
| `git diff --check` | Passed | Does not validate behavioral authorization. |
| `pnpm audit --prod` | Failed policy threshold | 81 production advisories, including Critical and High. |
| Visual route review | Home and mission shell render | The documented mission route remained loading in the audit environment. |

The passing deterministic suite supports the implementation’s local invariants, especially immutable fixture intent, server evidence, strict provider sequence parsing, continuation idempotency, and diagnostics sanitization. It does not contradict the distinct public-authorization, credential-identity, transactional-lifecycle, dependency, or live-UI findings above.

## 7. Submission-Freezing Checklist

| Checklist item | Status | Required evidence before freeze |
| --- | --- | --- |
| Preserve immutable fixture proof and leave PR #1 open/unmerged | **Complete** | Continue read-only treatment of the completed proof. |
| Preserve real-repair sandbox block | **Complete** | No retry until a provider-side remediation is documented. |
| Correct stale public-facing documentation | **Complete** | S7 documentation diff only; historical records clearly labelled. |
| Protect all live/provider/approval mutations with authenticated owner authorization | **Required** | Negative tests proving anonymous users cannot create provider sessions, probes, missions, or decisions. |
| Bind capability evidence to the exact credential object used for protected writes | **Required** | Rotation/mismatch test proves no network call occurs. |
| Make planning state plus audit immutable and atomic | **Required** | Transaction/CAS proof and deterministic concurrency/failure tests. |
| Remediate Critical/High production dependency advisories | **Required** | Reviewed lockfile, supported PNPM configuration, green production audit, and regression checks. |
| Provide a reproducible evidence route or explicitly submission-ready recorded artifact | **Required** | Stable authenticated rendering of the S2 mission evidence, or an agreed external proof-only presentation package. |
| Re-run Qodo after material security fixes | **Required** | Actual bot output; no invented clearance. |
| Re-run complete validation after fixes | **Required** | Frozen install, `check`, deterministic tests, build, audit, and whitespace check. |

## 8. Recommendation

**Do not freeze SentinelForge as production-safe or final-submission-ready.** Preserve the completed S2 proof and its current open PR state, preserve the sandbox block, and keep all live operations disabled. The correct next work is a narrowly scoped security/remediation sprint for F-01 through F-05, followed by a new hostile review. Documentation corrections alone improve submission integrity but cannot satisfy the missing authorization, credential binding, transactionality, dependency, and reproducible-evidence conditions.

## References

[1]: ./HACKATHON_DEMO.md "SentinelForge S2 fixture-proof evidence and demo boundary"
[2]: ./SANDBOX_BLOCKER.md "TrueForge Sandbox Infrastructure Blocker"
[3]: ./TRUEFOUNDRY_SANDBOX_ESCALATION.md "TrueFoundry sandbox escalation and observed provider status"
[4]: https://github.com/Aayushashsahu/sentinelforge/pull/5#issuecomment-5430144582 "Qodo PR #5 initial review"
[5]: https://github.com/Aayushashsahu/sentinelforge/pull/10#issuecomment-5434500761 "Qodo PR #10 initial review"
[6]: ./LIVE_FIXTURE_PROOF_HARNESS.md "Fixture credential and evidence boundaries"
[7]: https://github.com/Aayushashsahu/sentinelforge "SentinelForge public repository"

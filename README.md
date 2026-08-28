# 🛡️ SentinelForge

> **Investigate. Propose. Approve. Verify. Refuse unsafe writes.**

SentinelForge is an approval-gated engineering incident responder built around a real **TrueForge** runtime and a fail-closed external-action boundary.

It separates **evidence → investigation → proposal → approval → verification → authorization → external action**. Every boundary is explicit, persisted, correlated, and independently guardable.

---

## The Core Loop

```text
┌──────────────────────────┐
│   Repository Evidence    │
│     read-only first      │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│      Investigator        │
│  evidence → root cause   │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│    Repair Engineer       │
│  proposal + fingerprint  │
│        NO mutation       │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│      TrueForge           │
│  approval_required       │
└────────────┬─────────────┘
             │
            ┌▼────────┐
            │ Human   │
            │ Decision│
            └┬────────┘
             │
             ▼
┌──────────────────────────┐
│ Exact continuation       │
│ user.tool_approval       │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  Isolated Verification   │
└────────────┬─────────────┘
         ┌───┴────┐
         │        │
       PASS     FAIL/BLOCKED
         │        │
         ▼        ▼
┌─────────────┐  ┌────────────┐
│ Guarded     │  │ REFUSE     │
│ external    │  │ WRITE      │
│ action      │  │ fail closed│
└─────────────┘  └────────────┘
```

> **Approval is not execution.** A successful SentinelForge workflow can legitimately end with **no mutation at all** when the system cannot prove the proposed action is safe.

---

## ⚡ Why SentinelForge

Modern AI coding agents are good at producing changes. The dangerous part is everything around the change:

- Did the agent investigate the correct repository?
- Is the repair grounded in actual evidence?
- Is the proposal immutable?
- Who approved it — and was that approval for *this exact action*?
- Was verification performed in isolation?
- Does the credential have the capability it claims?
- Can a stale or duplicated event bypass the boundary?
- What happens when the provider is unavailable?

SentinelForge treats those questions as **engineering primitives**, not UI decoration.

---

## 🧠 What Makes It Different

SentinelForge is **not** an LLM wrapper and not a scripted GitHub bot. It is a multi-boundary orchestration system:

| Boundary | What it enforces |
| --- | --- |
| **Evidence** | Read-only, allowlisted, persisted |
| **Investigation** | Produces a bounded root cause |
| **Repair planning** | Unapplied proposal + immutable fingerprint |
| **Approval** | Genuine provider approval event |
| **Continuation** | Correlated, exactly-once continuation |
| **Verification** | Separate isolated safety gate |
| **Credentials** | Explicitly separated by purpose |
| **Capabilities** | Bound to repository + operation + credential identity |
| **GitHub writes** | Narrow, revalidated, fail-closed |
| **State** | Persisted and correlation-aware |
| **Failure** | Refuse rather than guess |

> **When safety evidence disappears, authority disappears with it.**

---

## 🔥 TrueForge Integration

TrueForge is not merely called as an LLM endpoint — it is part of the **control architecture**.

| TrueForge capability | How SentinelForge uses it |
| --- | --- |
| Sessions / turns | Persistent provider execution and audit correlation |
| MCP (`sentinelforge-tools`) | First-party read-only engineering evidence |
| `tool.approval_required` | Genuine provider approval checkpoint |
| `user.tool_approval` | Exact human-approved continuation |
| Event history (SSE) | Auditable provider evidence |
| Session/turn/thread/tool-call correlation | Immutable audit trail linking every decision |
| Safety boundary | Refusal when verification cannot establish safety |

```text
TrueForge session
      │
      ▼
MCP initialization
      │
      ▼
fixture_github_pr_gate
      │
      ▼
tool.approval_required
      │
      ▼
human decision
      │
      ▼
user.tool_approval
      │
      ▼
exact continuation
```

The application records the relationship between provider events and SentinelForge actions — treating TrueForge as an actual dependency, not decoration.

---

## ✅ Real S2 External Proof

SentinelForge has completed **one genuine, bounded external fixture proof**.

### What happened

```text
server evidence
      ↓
real TrueForge approval pause
      ↓
human approval
      ↓
one continuation
      ↓
one dedicated branch
      ↓
one manifest update
      ↓
one commit
      ↓
one open pull request
      ↓
STOP
```

### Verified result

| | |
|---|---|
| **Fixture repository** | `Aayushashsahu/sentinelforge-incident-fixture` |
| **Branch** | `sentinelforge/sf_kqb-repdfiug-i` |
| **Commit** | [`ef8119fa`](https://github.com/Aayushashsahu/sentinelforge-incident-fixture/commit/ef8119fa31b39b6f059ef13d2f0ae99fbddab4c0) |
| **Pull request** | [#1](https://github.com/Aayushashsahu/sentinelforge-incident-fixture/pull/1) — **open, unmerged** |

### Safety limits

```text
Branches written       1
Files updated          1
Commits created        1
Pull requests created  1

Merges                 0
Auto-merges            0
Sandbox runs           0
Other fixture writes   0
```

The only mutation was the approved version change:

```diff
release-manifest.json
- "version": "1.3.0"
+ "version": "1.4.0"
```

> The completed S2 proof is evidence of the bounded fixture pathway. It is **not** evidence that the separate real-repair sandbox verification succeeded.

---

## 🔐 Safety Architecture

### Server-derived target

For the live fixture-proof path, the model does **not** control repository owner, name, ref, file path, or expected versions. Those values are derived from immutable persisted action intent. The proof target is bound to:

```text
Aayushashsahu/sentinelforge-incident-fixture
main
release-manifest.json
1.3.0 → 1.4.0
```

### Human approval

Approval is tied to the exact action, fingerprint, provider session, turn, thread, gate call, and required-action identity. Approval authorizes **a specific action**, not an arbitrary future mutation.

### Credential isolation

Different operations use different credential paths:

```text
Generic investigation    → GITHUB_READ_TOKEN
Fixture-proof writes     → GITHUB_SCRATCH_PR_TOKEN
```

The model cannot supply credentials through MCP. Secrets are not persisted in action records, audit payloads, MCP responses, provider-visible output, error messages, or test assertions.

### Credential → capability binding

Write authority is not inferred from repository ownership or read access. The runtime credential identity is validated against:

```text
credential identity → repository → operation → capability → write endpoint
```

A mismatch at any level fails closed.

### Atomic planning

Planning state and audit persistence use a transactional path where supported by the repository, preventing states like `MISSION = PLANNING_FIX` with `ACTION = missing` or `AUDIT = inconsistent`.

### Fail-closed execution

Verification failure or block means **no external write**. No host fallback. No fake pass.

---

## 🧪 Deterministic Fixtures

No-shell, deterministic contract scenarios for release-manifest version drift, CI workflow Node.js compatibility, and dependency/plugin compatibility. These exercise orchestration and safety contracts reproducibly **without contacting TrueForge, a sandbox, MCP, or GitHub** — they are contract fixtures, not live provider execution.

---

## 🚧 Sandbox Status

```text
SANDBOX_VERIFICATION_BLOCKED → WRITE_BLOCKED
```

The separate real-repair sandbox verification remains **provider-blocked**. The TrueForge sandbox reached `truefoundry-system/exec`, then failed to install `pydantic>=2.0.0,<3.0.0` through the proxy/package-index boundary.

**Official escalation:** [truefoundry/trueforge#482](https://github.com/truefoundry/trueforge/issues/482)

No host fallback, no fake pass, no bypass, no fabricated repair claim. When isolated verification cannot be established, SentinelForge refuses the write — that is the system working correctly.

---

## 🧩 MCP Safety Surface

State-aware MCP inspectors (`approval_probe`, `repair_proposal_gate`) that read persisted state and return structured evidence. They are **read-only** — they cannot approve, continue, or execute writes.

---

## 🔎 Qodo: Adversarial Code Review

Qodo was used as an **actual engineering review mechanism** — not as decoration. Across 14 reviewed PRs, Qodo identified **32 findings** (including 10 High/MUST_FIX), all of which were addressed through remediation commits and merged into `main`.

### Representative Review — PR #19

[#19](https://github.com/Aayushashsahu/sentinelforge/pull/19) — the final S7 security-hardening cycle.

```text
Qodo identified 3 High findings
      │
      ├── Finding 1: decideApproval must stay public (browser cannot send auth headers)
      ├── Finding 2: tRPC boundary tests never exercised the actual middleware
      └── Finding 3: capability config was hardcoded, not flowing from harness
      │
      ▼
All 3 remediated → additional boundary tests added → validation passed → merged
```

This is the pattern that repeated across the entire project: **Qodo finding → remediation → regression coverage → validation → merge**.

### Full review history

| PR | Scope | Qodo result |
| --- | --- | --- |
| [#2](https://github.com/Aayushashsahu/sentinelforge/pull/2) | CI workflow compatibility | 2 findings → fixed → **merged** |
| [#3](https://github.com/Aayushashsahu/sentinelforge/pull/3) | Dependency compatibility | 1 finding → fixed → **merged** |
| [#4](https://github.com/Aayushashsahu/sentinelforge/pull/4) | Approval-gated fixture executor | 7 findings → fixed → **merged** |
| [#5](https://github.com/Aayushashsahu/sentinelforge/pull/5) | GitHub write-capability evidence | 2 findings → **merged** |
| [#6](https://github.com/Aayushashsahu/sentinelforge/pull/6) | Opt-in fixture proof harness | 4 findings → fixed → **merged** |
| [#7](https://github.com/Aayushashsahu/sentinelforge/pull/7) | Stateful MCP safety tools | 4 findings → fixed → **merged** |
| [#8](https://github.com/Aayushashsahu/sentinelforge/pull/8) | Configured write-capability model | 0 findings → **merged** |
| [#9](https://github.com/Aayushashsahu/sentinelforge/pull/9) | Capability array parser | 0 findings → **merged** |
| [#10](https://github.com/Aayushashsahu/sentinelforge/pull/10) | Fixture-proof legal lifecycle | 2 findings → **merged** |
| [#11](https://github.com/Aayushashsahu/sentinelforge/pull/11) | Server-derived fixture reads | 1 finding → fixed → **merged** |
| [#12](https://github.com/Aayushashsahu/sentinelforge/pull/12) | Fixture-read credential boundary | 0 findings → **merged** |
| [#13](https://github.com/Aayushashsahu/sentinelforge/pull/13) | Server-orchestrated evidence capture | 1 finding → fixed → **merged** |
| [#16](https://github.com/Aayushashsahu/sentinelforge/pull/16) | Provider-history correlation | 3 findings → fixed → **merged** |
| [#19](https://github.com/Aayushashsahu/sentinelforge/pull/19) | **S7 auth boundary test coverage** | **3 High → remediated → merged** |

👉 [`docs/QODO_REVIEW_LOG.md`](./docs/QODO_REVIEW_LOG.md) — complete factual ledger with commit links

> This repository does not equate an empty review response, a busy response, or a review update with a formal dismissal unless Qodo explicitly provides that evidence.

---

## 🧰 Test & Build Status

Current deterministic validation on `main`:

```text
pnpm install --frozen-lockfile   ✅
pnpm check                       ✅  0 errors
pnpm test                        ✅  35 files / 250 passed / 16 skipped
pnpm build                       ✅  client + server
git diff --check                 ✅  clean
pnpm audit --prod                48 remaining transitive advisories (0 directly upgradable)
```

Skipped tests are explicitly opt-in live integration tests — **not** represented as passed live executions.

The repository provides dedicated regression coverage for:

- operator authentication and protectedProcedure enforcement
- credential identity and hashing
- GitHub capability binding and repository targeting
- approval correlation and action fingerprints
- idempotency and mission lifecycle
- atomic planning state
- MCP boundary isolation
- fixture-proof safety guards

---

## 🏗️ Architecture

```text
                    ┌───────────────────────┐
                    │     SentinelForge     │
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
              ▼                 ▼                 ▼
        Investigator      Repair Engineer     Control Plane
              │                 │                 │
              │                 │          ┌──────┴──────┐
              │                 │          │             │
              ▼                 ▼          ▼             ▼
          Evidence         Proposal     Approval      Persistence
              │             + Hash        State         + Audit
              │                 │          │
              └─────────────────┼──────────┘
                                │
                                ▼
                           TrueForge
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
               Provider gate            MCP layer
                    │
                    ▼
              Human approval
                    │
                    ▼
               Continuation
                    │
                    ▼
           Isolated verification
                    │
             ┌──────┴──────┐
             │             │
             ▼             ▼
            PASS       BLOCKED/FAIL
             │             │
             ▼             ▼
     guarded external    REFUSE
          action           WRITE
```

Detailed architecture and evidence provenance:

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — full architecture
- [`docs/PARTICIPANT_ARCHITECTURE_BRIEF.md`](./docs/PARTICIPANT_ARCHITECTURE_BRIEF.md) — condensed overview

---

## 🎥 Demo

**Watch the 3-minute demo:** [https://youtu.be/jy35fyIde68](https://youtu.be/jy35fyIde68)

```text
Incident → Evidence → Proposal → Approval → Continuation → Bounded external result → STOP
```

Uses authentic persisted evidence and the real fixture PR. See: [`docs/HACKATHON_DEMO.md`](./docs/HACKATHON_DEMO.md)

---

## 🧭 Evidence & Documentation

| Resource | Purpose |
| --- | --- |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Full architecture |
| [`docs/PARTICIPANT_ARCHITECTURE_BRIEF.md`](./docs/PARTICIPANT_ARCHITECTURE_BRIEF.md) | Condensed architecture overview |
| [`docs/HACKATHON_DEMO.md`](./docs/HACKATHON_DEMO.md) | Three-minute demo and evidence provenance |
| [`docs/QODO_REVIEW_LOG.md`](./docs/QODO_REVIEW_LOG.md) | Factual Qodo review history |
| [`docs/TRUEFOUNDRY_SANDBOX_ESCALATION.md`](./docs/TRUEFOUNDRY_SANDBOX_ESCALATION.md) | Sandbox blocker and escalation |
| [`docs/SANDBOX_BLOCKER.md`](./docs/SANDBOX_BLOCKER.md) | Sandbox limitation record |
| [`docs/S7_FORENSIC_AUDIT.md`](./docs/S7_FORENSIC_AUDIT.md) | S7 forensic audit |

---

## 🧰 Run Locally

### Requirements

- Node.js (compatible with repository configuration)
- `pnpm`

### Setup

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm dev
```

The local dashboard can inspect persisted missions and deterministic fixture scenarios. The deterministic fixtures do not contact TrueForge, MCP, a sandbox, or GitHub. The live repair path is intentionally **not** an unrestricted autonomous GitHub executor.

---

## 🤖 AI Use Disclosure

AI coding tools were used during SentinelForge implementation.

**Manus was used as an implementation and coding agent** for repository inspection, code changes, tests, documentation, and bounded workflow automation.

The participant provided:

- product direction
- architecture decisions
- safety constraints
- review requirements
- acceptance criteria
- final submission decisions

The implementation was reviewed through deterministic tests, builds, and recorded Qodo review cycles. The participant remains responsible for understanding the submitted code and all claims made in this repository.

---

## 📊 Project Status

| Area | Status |
| --- | --- |
| TrueForge runtime integration | ✅ Real |
| First-party MCP integration | ✅ Real |
| Persistent provider correlation | ✅ Real |
| Human approval boundary | ✅ Real |
| Exactly-once continuation | ✅ Real |
| Credential isolation | ✅ Hardened |
| Capability binding | ✅ Hardened |
| Atomic planning state | ✅ Hardened |
| Qodo security review | ✅ Real |
| Deterministic test suite | ✅ 250 passing |
| S2 fixture proof | ✅ Completed |
| Real-repair sandbox verification | ⚠️ Provider-blocked |
| Real-repair GitHub write | 🔒 Refused while sandbox gate unavailable |

---

## 🛡️ Security Philosophy

SentinelForge is built around **refusal as a first-class outcome**:

```text
"I know what I think the repair is.
I know what action I would take.
I know who approved it.
But I cannot prove it is safe.
Therefore I will not write."
```

That is not a failed agent. That is the system working correctly.

---

## ⭐ One Sentence

> **SentinelForge gives an AI agent enough authority to investigate and prepare an engineering repair — but not enough authority to cross a safety boundary it cannot prove is safe.**

---

## License

See the repository license and contribution/security policies for project-specific terms.

## Security

Please report security issues through the repository's documented security process rather than publishing sensitive credentials or exploit details in an issue.

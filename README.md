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

TrueForge is used as a **real runtime boundary**, not a branding layer.

SentinelForge demonstrates genuine:

- provider **sessions** and **turns**
- streamed **event history** (SSE)
- first-party **MCP** integration (`sentinelforge-tools`)
- genuine `tool.approval_required` checkpoints
- persisted **approval correlation** (session, turn, thread, tool-call, required-action)
- exactly-once `user.tool_approval` **continuation**
- provider/session/thread/tool-call **correlation**

The application records the relationship between provider events and SentinelForge actions — treating the provider as an actual dependency, not as decoration.

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

The repository contains no-shell, deterministic contract scenarios for:

- release-manifest version drift
- CI workflow Node.js compatibility
- dependency/plugin compatibility

These scenarios exercise the orchestration and safety contracts reproducibly **without contacting TrueForge, a sandbox, MCP, or GitHub**. They are contract fixtures — not live provider execution.

---

## 🚧 Sandbox Status

```text
SANDBOX_VERIFICATION_BLOCKED
```

The separate real-repair sandbox verification remains **provider-blocked**. The TrueForge sandbox reached `truefoundry-system/exec`, then failed to install:

```text
pydantic>=2.0.0,<3.0.0
```

The observed failure was at the proxy/package-index connectivity boundary.

**Official escalation:** [truefoundry/trueforge#482](https://github.com/truefoundry/trueforge/issues/482)

### What SentinelForge does NOT do

- run the verifier on the host and call that a sandbox pass
- use deterministic fixtures as a substitute for a real provider sandbox
- fabricate a provider event or approval
- bypass the safety gate
- claim a real-repair GitHub mutation occurred

The resulting state is:

```text
SANDBOX_VERIFICATION_BLOCKED → WRITE_BLOCKED
```

This is an explicit **safety boundary**: when isolated verification cannot be established, SentinelForge refuses the write. That is the system working correctly.

---

## 🧩 MCP Safety Surface

SentinelForge includes state-aware MCP inspectors:

- **`approval_probe`** — reads persisted approval/session/action state; exposes bounded correlation evidence
- **`repair_proposal_gate`** — reads repair proposal and policy state; returns structured allow/block evidence

These tools are **read-only**. They do not approve, continue, persist, invoke a provider, execute a sandbox, or execute GitHub writes.

---

## 🔎 Qodo: Adversarial Code Review

Qodo was used as an **actual engineering review mechanism** throughout the project — not as decoration. The review history contains substantive findings, remediation commits, regression coverage, and follow-up review activity.

### Review history

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
| [#19](https://github.com/Aayushashsahu/sentinelforge/pull/19) | **S7 auth boundary test coverage** | **3 High findings → remediated → merged** |

### PR #19 — Final security hardening

PR #19 is the culmination of the S7 security remediation cycle. Qodo identified **3 High-severity findings**:

1. `decideApproval` must stay public — the browser cannot send auth headers
2. Tests must exercise the actual tRPC boundary, not just unit functions
3. Capability configuration must flow from harness, not be hardcoded

All three were remediated. The resulting PR was merged into `main`.

👉 [`docs/QODO_REVIEW_LOG.md`](./docs/QODO_REVIEW_LOG.md) — complete factual ledger

> **Important:** This repository does not equate an empty review response, a busy response, or a review update with a formal dismissal unless Qodo explicitly provides that evidence.

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

The final demo follows one central story:

```text
Incident → Evidence → Proposal → Approval → Continuation → Bounded external result → STOP
```

The demo uses authentic persisted evidence surfaces and the real fixture pull request. It does **not** present the deterministic dashboard as a fresh live record of the S2 provider run.

See: [`docs/HACKATHON_DEMO.md`](./docs/HACKATHON_DEMO.md)

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

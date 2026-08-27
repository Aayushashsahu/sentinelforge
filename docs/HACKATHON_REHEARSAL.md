# Hackathon Rehearsal Checklist

> **Historical UI rehearsal note.** This checklist describes the contextual deterministic dashboard and a prior loading-state polish, not the authoritative S2 proof screen sequence. The current evidence-led recording plan is [HACKATHON_DEMO.md](./HACKATHON_DEMO.md); do not use this note to imply that the generic dashboard rendered the live S2 receipt.

## Observed Demo Presentation

The persisted mission page communicates the intended safety story through the derived timeline: real evidence and approval stages are complete, sandbox verification and write execution are visibly blocked, and safe completion is explicit. The readiness page consistently distinguishes **REAL**, **BLOCKED**, and **GUARDED** capabilities.

The one concrete presentation defect found during rehearsal is the first-load mission state: it exposes only plain `Loading persisted mission…` copy, which is too sparse for a live judging demonstration. This should be replaced with a concise, intentional loading panel that explains that persisted evidence is being retrieved and preserves the same safe-control-plane visual hierarchy.

## Final Readiness Checklist

| Area | Status |
| --- | --- |
| Three-minute flow | Ready after the loading-state polish |
| Root cause in first minute | Ready: evidence ledger presents `package.json` `1.4.0` and `release-manifest.json` `1.3.0` |
| Real MCP / approval / continuation | Ready and visibly labelled |
| Sandbox and write refusal | Ready and visibly labelled |
| Safe completion | Ready: `COMPLETED_SAFE` does not imply an applied repair |
| Tests, check, build, diff | To be re-run after the loading-state polish |
| Qodo | Configured; no artificial PR or review was created |

## Applied Minimal Polish

The mission first-load state now uses a compact persisted-evidence panel rather than bare loading text. It preserves the command-center visual language and explicitly states that no provider action, sandbox retry, or GitHub write is running. No other product redesign or backend-architecture change was made.

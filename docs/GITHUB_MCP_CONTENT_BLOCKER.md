# GitHub MCP File-Content Delivery Blocker

**Date:** 2026-08-25  
**Status:** **BLOCKED — no actual file body has reached the TrueForge agent.**

## Scope and Safety Boundary

This investigation used only SentinelForge's configured **`github`** MCP connector at `https://api.githubcopilot.com/mcp/`, attached to a TrueForge Investigator with the explicit read-only selection `@read-only`, `search_repositories`, and `get_file_contents`. The Investigator policy disables sandboxing and dynamic subagents and contains no GitHub write selector. No custom GitHub API client, direct token, curl request to GitHub, Git command, repository mutation, sandbox execution, approval continuation, branch, commit, or pull request was used.

| Requirement | Recorded result |
| --- | --- |
| Target repository | `Aayushashsahu/sentinelforge` |
| Required read sequence | `search_repositories`, then `get_file_contents` |
| Intended files | `README.md`, `server/sentinelforge/workflow.ts`, and `package.json` on `main` |
| Success criterion | Actual non-empty file text — never a SHA, URL, filename, metadata record, or search snippet |
| Outcome | **Not met.** SentinelForge holds no new direct file-body evidence from this exercise. |

## Observed Connector Shape

The earlier real Investigator turn against the safe fixture used `get_file_contents` with the correct owner/repository/path inputs. Its TrueForge-visible tool result was an acknowledgement such as `successfully downloaded text file (SHA: …)` plus directory entries, SHAs, and download URLs. The event payload available to SentinelForge and the agent did **not** include a file body or a `resource.text` field. That is metadata only and was correctly persisted only as a limitation, not as source evidence.

GitHub's MCP response protocol is known to permit a result shaped as a normal text item alongside a `resource` item with `resource.text`; the GitHub MCP project records this consumer-compatibility issue in [issue #607](https://github.com/github/github-mcp-server/issues/607). SentinelForge now contains a deterministic parser test proving it would retain that `resource.text` if the TrueForge event boundary exposes it. The parser deliberately rejects SHA-only acknowledgements as file text.

## Bounded Attempts in This Continuation

After explicitly selecting the two read tools and adding the embedded-resource content policy, two bounded calls were made to a temporary SentinelForge diagnostic entry point fixed to the required `README.md` probe. The public extraction channel returned zero extractable characters for each call. A connected-browser attempt also failed before page control with `HTTP 504: Browser extension did not respond in time`.

Those observations do **not** prove that the remote call completed, that it failed, or that it delivered text. Because direct transport inspection would require a prohibited curl/shell/custom GitHub-content path, SentinelForge does not infer any result from them and does not spend further live-read budget. The historical real MCP evidence remains the only observed connector shape: acknowledgement plus SHA/metadata without a file body.

## Effect and Supported Next Action

| Downstream capability | State | Reason |
| --- | --- | --- |
| Evidence-backed root cause from source files | **BLOCKED** | The agent has no actual file text. |
| Valid bounded Repair Engineer patch | **BLOCKED** | A patch cannot be grounded in direct source evidence. |
| Deterministic fixture verifier | **SIMULATED / available** | It remains explicitly no-sandbox and does not unblock live repair. |
| Real sandbox, approval continuation, or GitHub PR | **BLOCKED** | These retain their independent prerequisites and are not attempted. |

The supported remediation is upstream or runtime-side: ensure the TrueForge MCP-to-agent/event conversion preserves GitHub MCP `resource.text` (or provide a documented read-only tool that returns body text in the normal agent event payload). Once that delivery contract is demonstrably available, repeat **one new, separately authorized** bounded read-only attempt, require a non-empty verbatim file excerpt for all three specified files, and add an integration test using the observed event shape. Until then, SentinelForge must continue to report the content path as blocked.

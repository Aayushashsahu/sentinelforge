# TrueForge Sandbox Infrastructure Blocker

**Status:** **BLOCKED — infrastructure-owned**  
**Scope:** Live TrueForge sandbox provider only. SentinelForge mission, approval, GitHub, and TrueForge integration architecture were not changed as part of this investigation.

## Observed Runtime Result

The repeated isolated probe submitted exactly one harmless command:

```text
printf sentinel-forge-sandbox-ok
```

The live TrueForge session reached the internal `truefoundry-system` `exec` tool. That establishes that sandbox admission and command dispatch are enabled. The provider then returned the following sanitized, material error:

> `Sandbox initialization failed: Failed to pip install pydantic>=2.0.0,<3.0.0 into sandbox .venv` because the configured proxy could not connect to the package index and closed the response.

The retry emitted two real `exec` attempts. It did **not** emit a successful exec result or terminal `turn.done` before the bounded client request timed out. SentinelForge persisted the result as `UNKNOWN`; it did not treat sandboxing as functional.

## Authorized Repair-Verifier Attempt — 26 August 2026

One newly authorized isolated verification attempted the already persisted fixture-only proposal: `release-manifest.json` version `1.3.0` to `1.4.0`. The dedicated TrueForge session was `01m0ye1yq8g8w7hsmj8taxm7ne` and the provider turn was `01m0ye208xvwqbp6mzkmksck9m.local`.

The model emitted a real `truefoundry-system/exec` request that would have created only temporary sandbox files and run the deterministic manifest verifier. The runtime returned a real tool response before that command ran:

> `Sandbox initialization failed: Failed to pip install pydantic>=2.0.0,<3.0.0 into sandbox .venv`.
>
> The sandbox pip client retried `/simple/pydantic/` through its configured proxy. Each connection failed with `ProxyError: Cannot connect to proxy` and `RemoteDisconnected: Remote end closed connection without response`; the installer then reported no matching distribution for `pydantic<3.0.0,>=2.0.0`.

The client observed no terminal `turn.done` within its 90-second bound. The agent made a provider-side follow-on `exec` request after receiving the bootstrap failure, but SentinelForge did not create another session, turn, user-level retry, or host command. To prevent recurrence, the repair-verifier agent specification now has a one-iteration limit; it cannot issue a second sandbox command after a tool response.

The persisted sandbox run is `run_j54bJdCCAxF7fO`, with status **FAIL**, empty stdout, exit code `2`, and the sanitized bootstrap error in stderr. The repair was **not applied anywhere**, because the provider did not complete sandbox initialization. No GitHub, branch, commit, pull request, Qodo, approval-probe, or other external action occurred.

## Provider, Image, and Bootstrap Findings

| Question | Verified finding | Confidence |
| --- | --- | --- |
| Is a sandbox enabled? | Yes. The real internal `exec` tool was reached. | High |
| Is the provider usable? | Not yet. Initialization fails before the harmless command executes. | High |
| What provider does official TrueForge v0.1.4 support? | Its public provider registry contains only `type: "daytona"`. | High for the public tag |
| How is a provider selected? | Server boot parses private `SANDBOX_SETTINGS`; an optional private `SANDBOX_API_KEY` overrides inline credentials. | High for the public tag |
| Which provider settings exist in the public tag? | `snapshotName`, `timeoutMs`, auto-stop/archive/delete intervals, and a Daytona API key. There is no package-index or proxy field in the TrueForge provider schema. | High for the public tag |
| What actual provider is the tunnel runtime using? | **Not observable through the public runtime API.** `truefoundry-system` identifies the internal tool, not the vendor/provider or snapshot. | High |
| What image or snapshot is active? | **Not observable through the public runtime API.** No configuration endpoint was exposed. | High |
| Why is pydantic installed dynamically? | The active runtime/snapshot initializes a sandbox `.venv` and requests `pydantic>=2.0.0,<3.0.0`; this differs from the public v0.1.4 sandbox prompt, which describes pydantic as pre-installed. | High for the observed mismatch |

## Final Local-Sandbox Timebox Finding

The final source inspection used the official `v0.1.4` tag as the authority. The tag’s sandbox scripts declare PEP 723-style inline dependencies: `git_downloader.py` declares `pydantic==2.12.5`, while `mcp_client.py` declares `fastmcp==3.2.4`, `pydantic==2.12.5`, and `nats-py==2.15.0`. Those declarations explain why a script runner may create an isolated `.venv` and fetch Python dependencies at first use. The tag’s sandbox prompt nevertheless states that pydantic is pre-installed, so a healthy intended snapshot should satisfy the requirement without the observed failing bootstrap.

The official `v0.1.4` server exposes only a Daytona provider configured through private `SANDBOX_SETTINGS` with a required `snapshotName`; its source contains no local-provider implementation, no local image/environment setting, no opt-out environment variable for the script dependencies, and no pip/PyPI proxy override. Its smoke coverage tests provider-schema validation and sandbox object identity rather than a local provider. Because the user explicitly prohibited Daytona and host execution, no permitted official local-sandbox fix exists that SentinelForge can apply from this environment.

> **Final status: BLOCKED.** The active tunnel runtime’s `pydantic>=2,<3` proxy bootstrap does not match the public `v0.1.4` source’s exact inline dependency declarations or its documented Daytona-only provider contract. SentinelForge cannot safely infer, alter, or bypass the active local runtime’s image, environment, proxy, index, or credentials.

## Read-Only Configuration Discovery Attempts

| Attempt | Result | Why it did not reveal private configuration |
| --- | --- | --- |
| Read live sandbox event history | Confirmed actual `exec` calls and the pydantic/proxy bootstrap failure. No provider name, snapshot, proxy host, or authentication detail was present. |
| Query public runtime metadata endpoints | `GET /openapi.json`, `GET /docs/openapi.json`, and `GET /api/v1/config` each returned HTTP 404. |
| Inspect official TrueForge v0.1.4 server and harness source | Confirmed Daytona-only settings and `snapshotName` support, but cannot reveal the active remote runtime’s private environment. |
| Inspect official Daytona snapshot documentation | Confirms that snapshots preserve installed packages and can be built from an image. |

## Proxy and Package Index Assessment

The error establishes that the sandbox’s Python installer was configured to use a proxy path and that the proxy connection failed or was closed. The public evidence cannot determine whether that proxy is missing, invalid, unreachable, authentication-protected, or selectively blocking PyPI. It also does not reveal the package-index URL or credentials. Those are runtime-provider settings and must be examined by the operator who controls the TrueForge sandbox environment.

## Supported Remediation Order

1. **Preferred:** Select or create a Daytona snapshot whose image already contains a compatible `pydantic` release and the sandbox bootstrap prerequisites.
2. **Preferred:** Bake `pydantic>=2,<3` into the sandbox image/snapshot, then set the runtime’s private `SANDBOX_SETTINGS` to that snapshot name.
3. Restore the sandbox provider’s package-index/proxy path only if runtime installation remains necessary. Validate DNS, reachability, TLS, and proxy authentication from inside a disposable sandbox; do not expose proxy credentials in SentinelForge.
4. Do not use host execution, disable sandbox isolation, or claim a successful verification without both a successful real `exec` response and terminal `turn.done`.

No additional probe was issued during this investigation because neither the active snapshot/image nor the proxy/index settings are exposed to SentinelForge, and no infrastructure-side remedy was applied. Repeating the unchanged probe would only repeat the already verified dependency-bootstrap failure.

## Is the Sandbox Otherwise Functional?

The provider can admit a sandbox-enabled agent session and dispatch the sandbox `exec` tool. It is **not functionally usable for verification** because its mandatory initialization cannot complete. Therefore, SentinelForge must continue to report the live sandbox capability as `UNKNOWN`/blocked.

## Recommended Next Step

The runtime operator should provide a non-secret confirmation of the active provider type and snapshot/image identifier, or change it to a prebuilt Daytona snapshot containing compatible pydantic. SentinelForge can then run the same harmless probe once, capture the raw tool result and terminal turn state, and only then re-evaluate real verification.

For the current user constraints, the permitted future remedy is instead to align the local runtime’s intended sandbox artifact with its own dependency declarations and repair its package-index/proxy reachability outside SentinelForge. No host fallback, sandbox disabling, credential hardcoding, or external provider was used.

## References

[1]: https://raw.githubusercontent.com/truefoundry/trueforge/v0.1.4/packages/harness/src/core/sandbox/provider/createSandboxProvider.ts "TrueForge v0.1.4 sandbox provider registry"
[2]: https://raw.githubusercontent.com/truefoundry/trueforge/v0.1.4/packages/harness/src/core/sandbox/provider/DaytonaProvider.ts "TrueForge v0.1.4 Daytona provider"
[3]: https://raw.githubusercontent.com/truefoundry/trueforge/v0.1.4/packages/server/src/runtime/sandboxFactory.ts "TrueForge v0.1.4 sandbox factory"
[4]: https://www.daytona.io/docs/en/snapshots/ "Daytona snapshots documentation"

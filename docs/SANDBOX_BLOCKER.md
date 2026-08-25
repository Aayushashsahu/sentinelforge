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

## References

[1]: https://raw.githubusercontent.com/truefoundry/trueforge/v0.1.4/packages/harness/src/core/sandbox/provider/createSandboxProvider.ts "TrueForge v0.1.4 sandbox provider registry"
[2]: https://raw.githubusercontent.com/truefoundry/trueforge/v0.1.4/packages/harness/src/core/sandbox/provider/DaytonaProvider.ts "TrueForge v0.1.4 Daytona provider"
[3]: https://raw.githubusercontent.com/truefoundry/trueforge/v0.1.4/packages/server/src/runtime/sandboxFactory.ts "TrueForge v0.1.4 sandbox factory"
[4]: https://www.daytona.io/docs/en/snapshots/ "Daytona snapshots documentation"

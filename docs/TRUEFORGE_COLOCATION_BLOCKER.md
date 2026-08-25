# TrueForge Colocation Blocker

**Date:** 2026-08-25  
**Status:** **BLOCKED for canonical SentinelForge development use.** The managed environment can run a private loopback Node process, but the exact public `v0.1.4` source tag does not match the active runtime's required HTTP contract and lacks the credentials needed for an end-to-end NIM/GitHub-MCP verification.

## Managed-Environment Assessment

| Capability | Observed result |
| --- | --- |
| Node.js | `v22.13.0` |
| npm | `10.9.2` |
| Git | `2.43.0` |
| Disk | 31 GB available of 40 GB |
| Memory | 2.1 GiB available; 2 GiB swap unused |
| Existing local backend | `http://127.0.0.1:3000/` returned HTTP 200 |
| Private port | `127.0.0.1:8790` successfully bound; it was never publicly exposed and was stopped after testing |

## Isolated Source and Patch Evidence

The official repository was cloned into the isolated workspace `/home/ubuntu/trueforge-colocated` at exact tag `v0.1.4`, commit `fa00af91a396fe6d6d0be0a6cfa528893c12742e`. The source layout at that tag contains `packages/harness` and `packages/server`; it does **not** contain the requested `packages/trueforge-core` path.

The isolated patch is in:

```text
packages/harness/src/core/mcp/executeToolCalls.ts
```

It changes model-context conversion to retain `resource.text` alongside normal text acknowledgements. It preserves non-text MCP blocks as serialized protocol data without blob decoding or resource-link fetching. The isolated regression `packages/harness/tests/core/executeToolCalls.test.ts` covers both acknowledgement-plus-resource text and resource text alone, plus non-text preservation.

| Validation | Result |
| --- | --- |
| Focused resource-text regression | Passed |
| Full core test suite in this exact source checkout | 18 suites / 114 tests passed |
| Harness build | Passed, including declaration and distribution checks |
| Server build | Passed |

The reported local runtime result of 38 suites / 374 tests is not reproducible from this exact public `v0.1.4` tag, which is additional evidence that the active user runtime is built from a different source layout or revision.

## Required HTTP Contract Mismatch

The isolated source tag starts successfully with the patched loopback binding. Its actual routes are:

| Route | Result |
| --- | --- |
| `GET /` | HTTP 200, `OK!` |
| `GET /v1/models` | HTTP 200 and the local NIM model catalogue entry |
| `GET /healthz` | HTTP 404 |
| `GET /api/v1/models` | HTTP 404 |

The cloned `packages/server/src/app.ts` registers `/v1/models` and no `/healthz` route. SentinelForge's verified integration contract requires `GET /healthz` and `GET /api/v1/models`; making it accept this incompatible source tag would change SentinelForge behavior and violate the request to leave production configuration untouched. Adding compatibility routes to this tag would be a second, unverified runtime fork rather than a proof that the exact source corresponds to the user's active runtime.

## Credentials and MCP Boundary

The isolated server's `MODEL_API_KEY` is mandatory even for startup. A non-provider smoke value was used solely for the local health/catalogue check; no NIM request was made. A genuine private model turn requires the real NVIDIA NIM credential. Likewise, the managed environment does not automatically inherit the configured GitHub MCP connector's OAuth authentication, so the isolated `github` MCP registry has no usable header credential. As a result, the permitted read-only MCP verification was **not attempted**.

No sandbox was configured. No public tunnel, direct GitHub API call, GitHub write, branch, commit, pull request, approval continuation, or SentinelForge environment/configuration change occurred. The private listener was stopped and port 8790 released.

## Exact Next Action

Do not make this source tag canonical. Obtain the actual local runtime source/build revision that exposes `/healthz` and `/api/v1/*`, together with a supported local registry/configuration method for the NIM and GitHub MCP credentials. Then repeat the isolated build with the same resource-text regression and authorize one fresh private read-only README verification. Until that exact runtime contract is available, retain SentinelForge's external runtime configuration unchanged and do not create a tunnel fallback.

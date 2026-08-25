# TrueForge First-Party MCP Registration Blocker

**Date:** 2026-08-25  
**Status:** **BLOCKED pending a runtime-host configuration change.**

## Observed Running-Runtime Catalog

SentinelForge made only a read-only request to the running TrueForge catalog:

```text
GET /api/v1/mcp-servers
```

The catalog contains exactly one configured server:

| Field | Observed value |
| --- | --- |
| Name | `github` |
| URL | `https://api.githubcopilot.com/mcp/` |
| Authentication | Header-authenticated; status reported as authenticated |

`sentinelforge-tools` is not listed. No session, turn, agent, tool call, sandbox, approval, or GitHub action was started during this inspection.

## Supported Configuration Boundary

The official TrueForge server MCP route contract is catalog-only: `GET /v1/mcp-servers` lists entries declared in the runtime-owned `mcp.yaml`, and `GET /v1/mcp-servers/{name}/tools` performs a raw MCP `tools/list`. It intentionally provides no create, update, or delete route. The analogous active runtime catalog uses `/api/v1/mcp-servers`.

> The source route documentation states that MCP servers are “declared in `mcp.yaml`” and that authentication headers are configured through environment variables rather than returned by the catalog.[1]

Consequently, SentinelForge has **no supported HTTP mutation path** to register a new remote MCP server. An attempted `OPTIONS` request did not advertise a configuration operation. Modifying runtime-owned files through the tunnel or guessing an undocumented API would violate the requested safe configuration path, so SentinelForge did not do either.

## Exact Runtime-Host Change Required

The runtime owner must update the active TrueForge host’s `mcp.yaml` (or its equivalent mounted registry file) and restart/reload that runtime using its own supported operational procedure:

```yaml
mcp_servers:
  - name: sentinelforge-tools
    url: https://3000-iwtfcrsdleeiewbd29rdg-fe331c92.sg1.manus.computer/api/mcp/sentinelforge-tools
```

The target MCP server is first-party and already implements exactly these read-only tools:

```text
get_repository
get_file
get_issue
get_workflow_run
```

It requires no credential from TrueForge. The GitHub read token remains server-only inside SentinelForge. No GitHub write, sandbox, Daytona, arbitrary tool, or approval behavior must be added.

## Verification to Run After Host Registration

After the runtime owner confirms the active process has reloaded the registry, SentinelForge can make only these read-only verification calls:

1. `GET /api/v1/mcp-servers` must list `sentinelforge-tools`.
2. `GET /api/v1/mcp-servers/sentinelforge-tools/tools` must return exactly the four names above.
3. The tools endpoint must return HTTP 200 without an authentication-required response.

No Investigator turn is authorized by this document. That remains a separate explicit decision after catalog verification succeeds.

## Reference

[1] [TrueForge v0.1.4 MCP route definitions](https://github.com/truefoundry/trueforge/blob/v0.1.4/packages/server/src/routes/mcpRoutes.ts)

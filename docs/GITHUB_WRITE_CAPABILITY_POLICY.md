# GitHub Write-Capability Evidence Policy

SentinelForge distinguishes **readability** from **write authority** at the fixture GitHub execution boundary. Metadata reads, contents reads, pull-request reads, repository ownership, and rulesets visibility do not demonstrate that the server-side credential may create a branch, update a file, or open a pull request.

The fixture adapter therefore requires repository-bound, response-shaped write-capability evidence before every protected write operation. Branch creation and the exact `release-manifest.json` update require `contents:write`; pull-request creation requires `pull_requests:write`. The evidence must name the same immutable fixture repository, exact HTTP method and sanitized path, a successful response status, and the corresponding `X-Accepted-GitHub-Permissions` capability. It cannot be reused for another repository or a different operation.

GitHub does not expose a general, complete fine-grained-token permission manifest in this API flow. Consequently, the production policy starts with no positive write evidence and fails closed **before network I/O**. A future authorized integration may supply a repository-bound observation only when it has been independently established by a trusted GitHub response path; SentinelForge neither synthesizes a permission manifest nor infers write authority from any read response.

When evidence is absent, mismatched, or malformed, the executor records a terminal `FAILED` action with sanitized `UNKNOWN` failure evidence and an audit stating that no GitHub write was attempted. Genuine write requests that later fail retain the pre-existing terminal partial-state behavior and sanitized diagnostics.

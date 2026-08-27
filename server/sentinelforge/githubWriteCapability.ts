export type GitHubWriteCapability = "contents:write" | "pull_requests:write";
export type GitHubWriteOperation = { capability: GitHubWriteCapability; method: "POST" | "PUT"; endpoint: string };

export type GitHubConfiguredWriteCapability = {
  repository: string;
  capability: GitHubWriteCapability;
};

export class GitHubWriteCapabilityError extends Error {
  constructor(public readonly operation: GitHubWriteOperation, public readonly reason: "MISSING_CONFIGURATION" | "REPOSITORY_MISMATCH" | "CAPABILITY_MISMATCH") {
    super(`Fixture GitHub proof refused: ${operation.capability} is not configured for ${operation.method} ${operation.endpoint} (${reason}).`);
    this.name = "GitHubWriteCapabilityError";
  }
}

function normalizedPath(value: string): string {
  const path = value.split("?", 1)[0] ?? "";
  if (!path.startsWith("/") || path.includes("//") || path.includes("@")) return "/[INVALID_PATH]";
  return path;
}

/**
 * This policy proves only that an explicit, fixture-bound deployment configuration declares the
 * capability needed for a protected operation. It does not query a token manifest, infer write
 * access from reads, or claim the remote endpoint will accept the request. GitHub remains the
 * final enforcement point, and a non-2xx write response remains terminal and fail-closed.
 */
export class GitHubWriteCapabilityPolicy {
  constructor(private readonly configuredCapabilities: readonly GitHubConfiguredWriteCapability[] = []) {}

  require(repository: string, operation: GitHubWriteOperation): void {
    if (normalizedPath(operation.endpoint) !== operation.endpoint) throw new GitHubWriteCapabilityError(operation, "CAPABILITY_MISMATCH");
    const capabilityMatches = this.configuredCapabilities.filter(item => item.capability === operation.capability);
    if (capabilityMatches.length === 0) throw new GitHubWriteCapabilityError(operation, "MISSING_CONFIGURATION");
    if (!capabilityMatches.some(item => item.repository === repository)) throw new GitHubWriteCapabilityError(operation, "REPOSITORY_MISMATCH");
  }
}

export type GitHubWriteCapabilityAssessment = {
  configured: "VERIFIED" | "BLOCKED";
  effective: "UNVERIFIED";
  fullPermissionManifest: "UNVERIFIABLE";
};

export function assessConfiguredWriteCapability(configuredCapabilities: readonly GitHubConfiguredWriteCapability[], repository: string, capability: GitHubWriteCapability): GitHubWriteCapabilityAssessment {
  return {
    configured: configuredCapabilities.some(item => item.repository === repository && item.capability === capability) ? "VERIFIED" : "BLOCKED",
    effective: "UNVERIFIED",
    fullPermissionManifest: "UNVERIFIABLE",
  };
}

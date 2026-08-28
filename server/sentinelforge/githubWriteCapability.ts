import { createHash } from 'node:crypto';

export type GitHubWriteCapability = "contents:write" | "pull_requests:write";
export type GitHubWriteOperation = { repository: string; capability: GitHubWriteCapability; method: "POST" | "PUT"; endpoint: string };

export type GitHubConfiguredWriteCapability = {
  repository: string;
  capability: GitHubWriteCapability;
};

export class GitHubWriteCapabilityError extends Error {
  constructor(public readonly operation: GitHubWriteOperation, public readonly reason: "MISSING_CONFIGURATION" | "REPOSITORY_MISMATCH" | "CAPABILITY_MISMATCH" | "CREDENTIAL_MISMATCH") {
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
 * This policy proves that an explicit, fixture-bound deployment configuration declares the
 * capability needed for a protected operation and that the capability is bound to the credential
 * used for the operation. It does not query a token manifest, infer write access from reads, or
 * claim the remote endpoint will accept the request. GitHub remains the final enforcement point,
 * and a non-2xx write response remains terminal and fail-closed.
 */
export class GitHubWriteCapabilityPolicy {
  constructor(
    private readonly expectedCredentialIdentifier: string,
    private readonly configuredCapabilities: readonly GitHubConfiguredWriteCapability[] = []
  ) {}

  verify(operation: GitHubWriteOperation, token: string): void {
    // Compute the credential identifier from the provided token
    const identifier = createHash('sha256').update(token).digest('hex');
    if (identifier !== this.expectedCredentialIdentifier) {
      throw new GitHubWriteCapabilityError(operation, "CREDENTIAL_MISMATCH");
    }
    if (normalizedPath(operation.endpoint) !== operation.endpoint) throw new GitHubWriteCapabilityError(operation, "CAPABILITY_MISMATCH");
    const capabilityMatches = this.configuredCapabilities.filter(item => item.capability === operation.capability);
    if (capabilityMatches.length === 0) throw new GitHubWriteCapabilityError(operation, "MISSING_CONFIGURATION");
    if (!capabilityMatches.some(item => item.repository === operation.repository)) throw new GitHubWriteCapabilityError(operation, "REPOSITORY_MISMATCH");
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

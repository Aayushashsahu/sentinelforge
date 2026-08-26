export type GitHubWriteCapability = "contents:write" | "pull_requests:write";
export type GitHubWriteOperation = { capability: GitHubWriteCapability; method: "POST" | "PUT"; endpoint: string };

export type GitHubObservedWriteCapabilityEvidence = {
  repository: string;
  capability: GitHubWriteCapability;
  method: "POST" | "PUT";
  endpoint: string;
  status: number;
  acceptedGithubPermissions: string;
};

export class GitHubWriteCapabilityError extends Error {
  constructor(public readonly operation: GitHubWriteOperation, public readonly reason: "MISSING_EVIDENCE" | "REPOSITORY_MISMATCH" | "INVALID_EVIDENCE") {
    super(`Fixture GitHub proof refused: ${operation.capability} is not positively established for ${operation.method} ${operation.endpoint} (${reason}).`);
    this.name = "GitHubWriteCapabilityError";
  }
}

function normalizedPath(value: string): string {
  const path = value.split("?", 1)[0] ?? "";
  if (!path.startsWith("/") || path.includes("//") || path.includes("@")) return "/[INVALID_PATH]";
  return path;
}

function permissionMatches(header: string, capability: GitHubWriteCapability): boolean {
  const [resource, access] = capability.split(":") as [string, string];
  return header.split(",").map(value => value.trim().toLowerCase()).includes(`${resource}=${access}`);
}

function matchesOperation(evidence: GitHubObservedWriteCapabilityEvidence, operation: GitHubWriteOperation): boolean {
  return evidence.capability === operation.capability
    && evidence.method === operation.method
    && normalizedPath(evidence.endpoint) === operation.endpoint
    && evidence.status >= 200
    && evidence.status < 300
    && permissionMatches(evidence.acceptedGithubPermissions, evidence.capability);
}

/**
 * This policy intentionally does not query a token manifest or infer write access from reads.
 * It accepts only a repository-bound, response-shaped success evidence record whose declared
 * write capability exactly matches the protected operation. With no evidence, every write fails
 * closed before fetch is called.
 */
export class GitHubWriteCapabilityPolicy {
  constructor(private readonly evidence: readonly GitHubObservedWriteCapabilityEvidence[] = []) {}

  require(repository: string, operation: GitHubWriteOperation): void {
    const candidates = this.evidence.filter(item => item.capability === operation.capability && item.method === operation.method && normalizedPath(item.endpoint) === operation.endpoint);
    if (candidates.length === 0) throw new GitHubWriteCapabilityError(operation, "MISSING_EVIDENCE");
    if (!candidates.some(item => item.repository === repository)) throw new GitHubWriteCapabilityError(operation, "REPOSITORY_MISMATCH");
    if (!candidates.some(item => item.repository === repository && matchesOperation(item, operation))) throw new GitHubWriteCapabilityError(operation, "INVALID_EVIDENCE");
  }
}

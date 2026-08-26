export type GitHubWriteFailureClassification = "TOKEN_SCOPE" | "REPOSITORY_POLICY" | "REQUEST_CONSTRUCTION" | "OTHER_GITHUB_AUTHORIZATION" | "UNKNOWN";

export type GitHubWriteFailureEvidence = {
  httpStatus: number | null;
  method: "POST" | "PUT";
  endpoint: string;
  acceptedGithubPermissions: string | null;
  oauthScopes: string | null;
  githubErrorCode: string | null;
  message: string;
  classification: GitHubWriteFailureClassification;
};

export class GitHubFixtureWriteError extends Error {
  constructor(public readonly diagnostic: GitHubWriteFailureEvidence) {
    super(diagnostic.message);
    this.name = "GitHubFixtureWriteError";
  }
}

function truncate(value: string, limit = 1_000): string {
  return value.slice(0, limit);
}

function scrub(message: string, token?: string): string {
  let output = message;
  if (token) output = output.split(token).join("[REDACTED_TOKEN]");
  output = output
    .replace(/\bBearer\s+[^\s,;"']+/gi, "[REDACTED_CREDENTIAL]")
    .replace(/\b(authorization|token|cookie|secret)\s*[:=]\s*[^\s,;"']+/gi, "[REDACTED_CREDENTIAL]")
    .replace(/\bgithub_pat_[A-Za-z0-9_]+\b/gi, "[REDACTED_TOKEN]")
    .replace(/\bgh[pousr]_[A-Za-z0-9_]+\b/gi, "[REDACTED_TOKEN]");
  return truncate(output.trim() || "GitHub write request failed.");
}

function sanitizeEndpoint(endpoint: string): string {
  const pathname = endpoint.split("?", 1)[0] ?? "";
  if (!pathname.startsWith("/") || pathname.includes("//") || pathname.includes("@")) return "/[REDACTED_INVALID_PATH]";
  return pathname;
}

function optionalHeader(headers: Headers | undefined, name: string): string | null {
  const value = headers?.get(name);
  return typeof value === "string" && value.trim() ? truncate(value.trim(), 500) : null;
}

function safeErrorCode(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const direct = record.code;
  if (typeof direct === "string" && /^[A-Za-z0-9_.-]{1,120}$/.test(direct)) return direct;
  const errors = Array.isArray(record.errors) ? record.errors : [];
  for (const item of errors) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const code = (item as Record<string, unknown>).code;
    if (typeof code === "string" && /^[A-Za-z0-9_.-]{1,120}$/.test(code)) return code;
  }
  return null;
}

function safeErrorMessage(body: unknown, fallback: string, token?: string): string {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const message = (body as Record<string, unknown>).message;
    if (typeof message === "string") return scrub(message, token);
  }
  return scrub(fallback, token);
}

function classify(input: { status: number | null; code: string | null; message: string }): GitHubWriteFailureClassification {
  const code = input.code?.toLowerCase() ?? "";
  const message = input.message.toLowerCase();
  if (input.status === 400 || input.status === 422 || /invalid|missing|unprocessable|malformed/.test(code)) return "REQUEST_CONSTRUCTION";
  if (/protected_branch|branch_protection|repository_policy|ruleset/.test(code) || /branch protection|repository policy|ruleset/.test(message)) return "REPOSITORY_POLICY";
  if (/insufficient_scope|insufficient_permissions|missing_permission/.test(code) || /insufficient (scope|permission)|requires .* permission/.test(message)) return "TOKEN_SCOPE";
  if (input.status === 401 || /bad_credentials|authentication/.test(code)) return "OTHER_GITHUB_AUTHORIZATION";
  return "UNKNOWN";
}

export async function createGitHubWriteFailure(input: { status: number; method: "POST" | "PUT"; endpoint: string; headers?: Headers; responseJson: () => Promise<unknown>; token?: string; fallbackMessage: string }): Promise<GitHubFixtureWriteError> {
  let body: unknown = null;
  try { body = await input.responseJson(); } catch { body = null; }
  const code = safeErrorCode(body);
  const message = safeErrorMessage(body, input.fallbackMessage, input.token);
  return new GitHubFixtureWriteError({
    httpStatus: input.status,
    method: input.method,
    endpoint: sanitizeEndpoint(input.endpoint),
    acceptedGithubPermissions: optionalHeader(input.headers, "x-accepted-github-permissions"),
    oauthScopes: optionalHeader(input.headers, "x-oauth-scopes"),
    githubErrorCode: code,
    message,
    classification: classify({ status: input.status, code, message }),
  });
}

export function failureEvidenceFromUnknown(error: unknown, fallback: { method: "POST" | "PUT"; endpoint: string }): GitHubWriteFailureEvidence {
  if (error && typeof error === "object" && "operation" in error && (error as { name?: unknown }).name === "GitHubWriteCapabilityError") {
    const operation = (error as { operation: { method: "POST" | "PUT"; endpoint: string } }).operation;
    return {
      httpStatus: null,
      method: operation.method,
      endpoint: sanitizeEndpoint(operation.endpoint),
      acceptedGithubPermissions: null,
      oauthScopes: null,
      githubErrorCode: null,
      message: "Required GitHub write capability evidence is unavailable or invalid; no GitHub write was attempted.",
      classification: "UNKNOWN",
    };
  }
  if (error instanceof GitHubFixtureWriteError) return error.diagnostic;
  const raw = error instanceof Error ? error.message : "GitHub write request failed without a structured response.";
  const message = scrub(raw);
  return {
    httpStatus: null,
    method: fallback.method,
    endpoint: sanitizeEndpoint(fallback.endpoint),
    acceptedGithubPermissions: null,
    oauthScopes: null,
    githubErrorCode: null,
    message,
    classification: classify({ status: null, code: null, message }),
  };
}

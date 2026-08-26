/// <reference types="vitest/globals" />
import { describe, expect, it, vi } from "vitest";
import { GitHubFixtureWriteApi } from "./githubFixtureWrite";
import { GitHubWriteCapabilityPolicy, type GitHubObservedWriteCapabilityEvidence } from "./githubWriteCapability";

const token = "test-token";
const sha = "a".repeat(40);
const repository = "Aayushashsahu/sentinelforge-incident-fixture";

function response(status: number, body: unknown, headers: Record<string, string> = {}) { return { status, headers: new Headers(headers), json: async () => body }; }
function evidence(...items: GitHubObservedWriteCapabilityEvidence[]) { return new GitHubWriteCapabilityPolicy(items); }
function contentsEvidence(method: "POST" | "PUT", endpoint: string, repositoryName = repository): GitHubObservedWriteCapabilityEvidence { return { repository: repositoryName, capability: "contents:write", method, endpoint, status: 201, acceptedGithubPermissions: "metadata=read, contents=write" }; }
function pullRequestEvidence(repositoryName = repository): GitHubObservedWriteCapabilityEvidence { return { repository: repositoryName, capability: "pull_requests:write", method: "POST", endpoint: "/pulls", status: 201, acceptedGithubPermissions: "pull_requests=write" }; }

describe("server-only fixture GitHub write adapter", () => {
  it("refuses every call when the server-only scratch token is absent", async () => {
    const fetchImpl = vi.fn();
    const api = new GitHubFixtureWriteApi("", fetchImpl);
    await expect(api.getRepository()).rejects.toThrow(/GITHUB_SCRATCH_PR_TOKEN/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends the explicit server-side bearer token only to the immutable fixture repository endpoints", async () => {
    const fetchImpl = vi.fn(async () => response(200, { full_name: repository, default_branch: "main", archived: false }));
    const api = new GitHubFixtureWriteApi(token, fetchImpl);
    await expect(api.getRepository()).resolves.toMatchObject({ full_name: repository, default_branch: "main" });
    expect(fetchImpl).toHaveBeenCalledWith(`https://api.github.com/repos/${repository}`, expect.objectContaining({ headers: expect.objectContaining({ authorization: `Bearer ${token}` }) }));
  });

  it("allows one non-force branch create, one exact file update, and one non-auto-merge PR payload only with matching positive evidence", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response(201, { object: { sha } }))
      .mockResolvedValueOnce(response(200, { encoding: "base64", content: Buffer.from('{"version":"1.3.0"}').toString("base64"), sha }))
      .mockResolvedValueOnce(response(200, { commit: { sha } }))
      .mockResolvedValueOnce(response(201, { number: 3, html_url: `https://github.com/${repository}/pull/3`, state: "open", base: { ref: "main" }, head: { ref: "sentinelforge/sf_proof" }, auto_merge: null }));
    const api = new GitHubFixtureWriteApi(token, fetchImpl, evidence(contentsEvidence("POST", "/git/refs"), contentsEvidence("PUT", "/contents/release-manifest.json"), pullRequestEvidence()));
    await api.createBranch({ branchName: "sentinelforge/sf_proof", baseSha: sha });
    await api.updateReleaseManifest({ branchName: "sentinelforge/sf_proof", contentSha: sha, content: '{"version":"1.4.0"}' });
    await api.createPullRequest({ branchName: "sentinelforge/sf_proof" });
    const [, branchInit] = fetchImpl.mock.calls[0]!;
    const [, updateInit] = fetchImpl.mock.calls[2]!;
    const [, prInit] = fetchImpl.mock.calls[3]!;
    expect(branchInit).toMatchObject({ method: "POST" });
    expect(JSON.parse(branchInit.body)).toEqual({ ref: "refs/heads/sentinelforge/sf_proof", sha });
    expect(updateInit).toMatchObject({ method: "PUT" });
    expect(JSON.parse(updateInit.body)).toMatchObject({ sha, branch: "sentinelforge/sf_proof" });
    expect(JSON.parse(prInit.body)).toEqual(expect.objectContaining({ head: "sentinelforge/sf_proof", base: "main", maintainer_can_modify: false }));
  });

  it("has no public merge, delete, reference-update, settings, ruleset, workflow, deployment, secret, variable, webhook, collaborator, or organization operation", () => {
    const api = new GitHubFixtureWriteApi(token, vi.fn());
    for (const prohibited of ["mergePullRequest", "deleteBranch", "updateReference", "updateRepository", "updateRuleset", "updateWorkflow", "createDeployment", "putSecret", "putVariable", "createWebhook", "addCollaborator", "updateOrganization"]) expect(prohibited in api).toBe(false);
  });

  it("captures only sanitized 403 authorization diagnostics for a failed branch create", async () => {
    const secret = "test-token-with-secret-value";
    const fetchImpl = vi.fn(async () => response(403, { message: `requires Contents write; token=${secret}; authorization=Bearer ${secret}`, errors: [{ code: "insufficient_permissions", value: secret }] }, { "x-accepted-github-permissions": "contents=write", "x-oauth-scopes": "repo" }));
    const api = new GitHubFixtureWriteApi(secret, fetchImpl, evidence(contentsEvidence("POST", "/git/refs")));
    await expect(api.createBranch({ branchName: "sentinelforge/sf_proof", baseSha: sha })).rejects.toMatchObject({ diagnostic: { httpStatus: 403, method: "POST", endpoint: "/git/refs", acceptedGithubPermissions: "contents=write", oauthScopes: "repo", githubErrorCode: "insufficient_permissions", classification: "TOKEN_SCOPE" } });
    try { await api.createBranch({ branchName: "sentinelforge/sf_proof", baseSha: sha }); } catch (error) {
      expect(JSON.stringify(error)).not.toContain(secret);
      expect(JSON.stringify((error as { diagnostic: unknown }).diagnostic)).not.toContain("authorization=");
    }
  });

  it("keeps a 403 without permission evidence classified as unknown", async () => {
    const api = new GitHubFixtureWriteApi(token, vi.fn(async () => response(403, { message: "Forbidden" })), evidence(contentsEvidence("POST", "/git/refs")));
    await expect(api.createBranch({ branchName: "sentinelforge/sf_proof", baseSha: sha })).rejects.toMatchObject({ diagnostic: { classification: "UNKNOWN", acceptedGithubPermissions: null, oauthScopes: null } });
  });

  it("refuses metadata or contents-read evidence before branch creation without calling GitHub", async () => {
    const fetchImpl = vi.fn();
    const api = new GitHubFixtureWriteApi(token, fetchImpl, evidence({ repository, capability: "contents:write", method: "POST", endpoint: "/git/refs", status: 200, acceptedGithubPermissions: "metadata=read, contents=read" }));
    await expect(api.createBranch({ branchName: "sentinelforge/sf_proof", baseSha: sha })).rejects.toThrow(/INVALID_EVIDENCE/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses missing evidence before branch creation without calling GitHub", async () => {
    const fetchImpl = vi.fn();
    const api = new GitHubFixtureWriteApi(token, fetchImpl);
    await expect(api.createBranch({ branchName: "sentinelforge/sf_proof", baseSha: sha })).rejects.toThrow(/MISSING_EVIDENCE/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses manifest update without contents-write evidence before reading or writing GitHub", async () => {
    const fetchImpl = vi.fn();
    const api = new GitHubFixtureWriteApi(token, fetchImpl, evidence(contentsEvidence("POST", "/git/refs")));
    await expect(api.updateReleaseManifest({ branchName: "sentinelforge/sf_proof", contentSha: sha, content: '{"version":"1.4.0"}' })).rejects.toThrow(/MISSING_EVIDENCE/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses pull-request reads without write evidence before PR creation without calling GitHub", async () => {
    const fetchImpl = vi.fn();
    const api = new GitHubFixtureWriteApi(token, fetchImpl, evidence({ repository, capability: "pull_requests:write", method: "POST", endpoint: "/pulls", status: 200, acceptedGithubPermissions: "pull_requests=read" }));
    await expect(api.createPullRequest({ branchName: "sentinelforge/sf_proof" })).rejects.toThrow(/INVALID_EVIDENCE/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not accept repository-bound evidence for a different repository", async () => {
    const fetchImpl = vi.fn();
    const api = new GitHubFixtureWriteApi(token, fetchImpl, evidence(contentsEvidence("POST", "/git/refs", "Aayushashsahu/other")));
    await expect(api.createBranch({ branchName: "sentinelforge/sf_proof", baseSha: sha })).rejects.toThrow(/REPOSITORY_MISMATCH/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses the explicit constructor credential rather than an ambient GitHub token", async () => {
    const original = process.env.GH_TOKEN;
    process.env.GH_TOKEN = "ambient-token-must-not-be-used";
    try {
      const fetchImpl = vi.fn(async () => response(201, { object: { sha } }));
      const api = new GitHubFixtureWriteApi(token, fetchImpl, evidence(contentsEvidence("POST", "/git/refs")));
      await api.createBranch({ branchName: "sentinelforge/sf_proof", baseSha: sha });
      expect(fetchImpl).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ headers: expect.objectContaining({ authorization: `Bearer ${token}` }) }));
    } finally {
      if (original === undefined) delete process.env.GH_TOKEN; else process.env.GH_TOKEN = original;
    }
  });
});

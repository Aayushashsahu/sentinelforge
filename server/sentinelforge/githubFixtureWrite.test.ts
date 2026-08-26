import { describe, expect, it, vi } from "vitest";
import { GitHubFixtureWriteApi } from "./githubFixtureWrite";

const token = "test-token";
const sha = "a".repeat(40);

function response(status: number, body: unknown) { return { status, json: async () => body }; }

describe("server-only fixture GitHub write adapter", () => {
  it("refuses every call when the server-only scratch token is absent", async () => {
    const fetchImpl = vi.fn();
    const api = new GitHubFixtureWriteApi("", fetchImpl);
    await expect(api.getRepository()).rejects.toThrow(/GITHUB_SCRATCH_PR_TOKEN/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends the explicit server-side bearer token only to the immutable fixture repository endpoints", async () => {
    const fetchImpl = vi.fn(async () => response(200, { full_name: "Aayushashsahu/sentinelforge-incident-fixture", default_branch: "main", archived: false }));
    const api = new GitHubFixtureWriteApi(token, fetchImpl);
    await expect(api.getRepository()).resolves.toMatchObject({ full_name: "Aayushashsahu/sentinelforge-incident-fixture", default_branch: "main" });
    expect(fetchImpl).toHaveBeenCalledWith("https://api.github.com/repos/Aayushashsahu/sentinelforge-incident-fixture", expect.objectContaining({ headers: expect.objectContaining({ authorization: `Bearer ${token}` }) }));
  });

  it("allows one non-force branch create, one exact file update, and one non-auto-merge PR payload", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response(201, { object: { sha } }))
      .mockResolvedValueOnce(response(200, { encoding: "base64", content: Buffer.from('{"version":"1.3.0"}').toString("base64"), sha }))
      .mockResolvedValueOnce(response(200, { commit: { sha } }))
      .mockResolvedValueOnce(response(201, { number: 3, html_url: "https://github.com/Aayushashsahu/sentinelforge-incident-fixture/pull/3", state: "open", base: { ref: "main" }, head: { ref: "sentinelforge/sf_proof" }, auto_merge: null }));
    const api = new GitHubFixtureWriteApi(token, fetchImpl);
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
});

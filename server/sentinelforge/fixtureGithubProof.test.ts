import { describe, expect, it, vi } from "vitest";
import { FIXTURE_PROOF_AFTER_VERSION, FIXTURE_PROOF_BASE_BRANCH, FIXTURE_PROOF_BEFORE_VERSION, FIXTURE_PROOF_FILE, FIXTURE_PROOF_REPOSITORY, assertCanonicalFixtureProofPatch, buildFixtureProofIntent, executeApprovedFixtureProof, readFixtureProofPreflight, transformFixtureReleaseManifest, type FixtureProofAction, type FixtureProofGitHubPort, type FixtureProofPersistencePort } from "./fixtureGithubProof";
import { GitHubFixtureWriteError } from "./githubWriteDiagnostics";
import { GitHubWriteCapabilityError } from "./githubWriteCapability";

const fingerprint = "a".repeat(64);
const sha = (character: string) => character.repeat(40);
const before = '{\n  "version": "1.3.0",\n  "channel": "stable"\n}\n';
const after = '{\n  "version": "1.4.0",\n  "channel": "stable"\n}\n';

function makeGithub(overrides: Partial<FixtureProofGitHubPort> = {}): FixtureProofGitHubPort {
  return {
    getRepository: vi.fn(async () => ({ full_name: FIXTURE_PROOF_REPOSITORY, default_branch: FIXTURE_PROOF_BASE_BRANCH, archived: false })),
    getReleaseManifest: vi.fn(async () => ({ text: before, sha: sha("b") })),
    getMainRef: vi.fn(async () => ({ sha: sha("c") })),
    getBranchRef: vi.fn(async () => null),
    findOpenPullRequests: vi.fn(async () => []),
    createBranch: vi.fn(async () => ({ sha: sha("d") })),
    updateReleaseManifest: vi.fn(async () => ({ commitSha: sha("e") })),
    createPullRequest: vi.fn(async () => ({ number: 7, htmlUrl: "https://github.com/Aayushashsahu/sentinelforge-incident-fixture/pull/7", state: "open", base: "main", head: "sentinelforge/sf_proof", autoMerge: null })),
    getPullRequest: vi.fn(async () => ({ number: 7, htmlUrl: "https://github.com/Aayushashsahu/sentinelforge-incident-fixture/pull/7", state: "open", base: "main", head: "sentinelforge/sf_proof", autoMerge: null })),
    ...overrides,
  };
}

function makeAction(overrides: Partial<FixtureProofAction> = {}): FixtureProofAction {
  const intent = buildFixtureProofIntent({ missionId: "SF_proof", proposalFingerprint: fingerprint });
  const action: FixtureProofAction = {
    id: "act_proof",
    missionId: "SF_proof",
    status: "STAGED",
    intent,
    preflight: { repository: FIXTURE_PROOF_REPOSITORY, baseBranch: "main", contentSha: sha("b"), baseSha: sha("c"), beforeContent: before, afterContent: after, branchName: intent.branchName },
    approval: { approvalRequestId: "apr_proof", trueforgeSessionId: "session_proof", turnId: "turn_proof", threadId: "main", toolCallId: "call_proof", requiredActionId: "required_proof", continuationId: "continuation_proof", continuationStatus: "SENT" },
    remote: {},
    ...overrides,
  };
  return action;
}

function makePersistence(action: FixtureProofAction): FixtureProofPersistencePort & { updates: Array<Pick<FixtureProofAction, "status" | "remote">>; audits: Array<{ eventType: string }> } {
  const updates: Array<Pick<FixtureProofAction, "status" | "remote">> = [];
  const audits: Array<{ eventType: string }> = [];
  return {
    updates,
    audits,
    getAction: vi.fn(async () => action),
    claimActionForExecution: vi.fn(async () => true),
    updateAction: vi.fn(async (_id, update) => { updates.push({ ...update, remote: { ...update.remote }, ...(update.failure ? { failure: { ...update.failure } } : {}) }); }),
    appendAudit: vi.fn(async input => { audits.push({ eventType: input.eventType }); }),
  };
}

describe("fixture GitHub proof contract", () => {
  it("creates only the immutable target intent and exact version transformation", () => {
    const intent = buildFixtureProofIntent({ missionId: "SF_proof", proposalFingerprint: fingerprint });
    expect(intent).toMatchObject({ repository: FIXTURE_PROOF_REPOSITORY, baseBranch: "main", filePath: FIXTURE_PROOF_FILE, beforeVersion: FIXTURE_PROOF_BEFORE_VERSION, afterVersion: FIXTURE_PROOF_AFTER_VERSION, branchName: "sentinelforge/sf_proof" });
    expect(transformFixtureReleaseManifest(before)).toBe(after);
  });

  it("fails closed for wrong repository, base, file, before value, after value, branch, fingerprint, and idempotency key", async () => {
    const github = makeGithub();
    const variants = [
      { intent: { ...makeAction().intent, repository: "Aayushashsahu/other" } },
      { intent: { ...makeAction().intent, baseBranch: "trunk" } },
      { intent: { ...makeAction().intent, filePath: "package.json" } },
      { intent: { ...makeAction().intent, beforeVersion: "0.0.0" } },
      { intent: { ...makeAction().intent, afterVersion: "9.9.9" } },
      { intent: { ...makeAction().intent, branchName: "unsafe" } },
      { intent: { ...makeAction().intent, proposalFingerprint: "bad" } },
      { intent: { ...makeAction().intent, idempotencyKey: "other" } },
    ];
    for (const variant of variants) await expect(readFixtureProofPreflight(github, variant.intent as FixtureProofAction["intent"])).rejects.toThrow(/allowlist|branch name|fingerprint|idempotency/i);
    expect(() => transformFixtureReleaseManifest('{"version":"0.0.0"}')).toThrow(/expected current version/);
  });

  it("refuses changed base, content SHA, deterministic branch, and existing PR before every write", async () => {
    const intent = buildFixtureProofIntent({ missionId: "SF_proof", proposalFingerprint: fingerprint });
    await expect(readFixtureProofPreflight(makeGithub({ getBranchRef: vi.fn(async () => ({ sha: sha("z") })) }), intent)).rejects.toThrow(/branch already exists/);
    await expect(readFixtureProofPreflight(makeGithub({ findOpenPullRequests: vi.fn(async () => [{ number: 1 } as never]) }), intent)).rejects.toThrow(/pull request already exists/);
    const action = makeAction();
    const persistence = makePersistence(action);
    await expect(executeApprovedFixtureProof({ github: makeGithub({ getMainRef: vi.fn(async () => ({ sha: sha("f") })) }), persistence, actionId: action.id })).rejects.toThrow(/changed after preflight/);
    expect(persistence.updates.at(-1)?.status).toBe("FAILED");
  });

  it("refuses stale, rejected, duplicate, or correlation-mismatched approval state before any write", async () => {
    for (const action of [
      makeAction({ status: "COMMIT_CREATED" }),
      makeAction({ approval: { ...makeAction().approval, continuationStatus: "PENDING" } }),
      makeAction({ approval: { ...makeAction().approval, toolCallId: "" } }),
    ]) {
      const github = makeGithub();
      await expect(executeApprovedFixtureProof({ github, persistence: makePersistence(action), actionId: action.id })).rejects.toThrow(/one-time staged|approval correlation/);
      expect(github.createBranch).not.toHaveBeenCalled();
    }
  });

  it("performs exactly branch, one-file commit, one open unmerged PR, then permanently stops", async () => {
    const action = makeAction();
    const github = makeGithub({
      createPullRequest: vi.fn(async input => ({ number: 7, htmlUrl: "https://github.com/Aayushashsahu/sentinelforge-incident-fixture/pull/7", state: "open", base: "main", head: input.branchName, autoMerge: null })),
      getPullRequest: vi.fn(async () => ({ number: 7, htmlUrl: "https://github.com/Aayushashsahu/sentinelforge-incident-fixture/pull/7", state: "open", base: "main", head: action.intent.branchName, autoMerge: null })),
    });
    const persistence = makePersistence(action);
    const result = await executeApprovedFixtureProof({ github, persistence, actionId: action.id });
    expect(result.status).toBe("PR_CREATED");
    expect(github.createBranch).toHaveBeenCalledTimes(1);
    expect(persistence.claimActionForExecution).toHaveBeenCalledOnce();
    expect(github.updateReleaseManifest).toHaveBeenCalledWith({ branchName: action.intent.branchName, contentSha: sha("b"), content: after });
    expect(github.createPullRequest).toHaveBeenCalledTimes(1);
    expect(persistence.audits.map(item => item.eventType)).toEqual(["FIXTURE_GITHUB_BRANCH_CREATED", "FIXTURE_GITHUB_COMMIT_CREATED", "FIXTURE_GITHUB_PR_PARTIAL", "FIXTURE_GITHUB_PR_CREATED"]);
    await expect(executeApprovedFixtureProof({ github, persistence: makePersistence(result), actionId: result.id })).rejects.toThrow(/one-time staged/);
  });

  it("stops on partial branch, commit, or PR outcomes without a retry, second commit, second PR, merge, auto-merge, force update, or deletion capability", async () => {
    const branchFailure = makeGithub({ createBranch: vi.fn(async () => { throw new Error("network interrupted"); }) });
    const action = makeAction();
    const persistence = makePersistence(action);
    await expect(executeApprovedFixtureProof({ github: branchFailure, persistence, actionId: action.id })).rejects.toThrow("network interrupted");
    expect(branchFailure.updateReleaseManifest).not.toHaveBeenCalled();
    expect(persistence.updates.at(-1)?.status).toBe("PARTIAL_BRANCH_CREATED");

    const commitFailure = makeGithub({ updateReleaseManifest: vi.fn(async () => { throw new Error("commit response interrupted"); }) });
    const commitAction = makeAction();
    const commitPersistence = makePersistence(commitAction);
    await expect(executeApprovedFixtureProof({ github: commitFailure, persistence: commitPersistence, actionId: commitAction.id })).rejects.toThrow("commit response interrupted");
    expect(commitFailure.createPullRequest).not.toHaveBeenCalled();
    expect(commitPersistence.updates.at(-1)?.status).toBe("PARTIAL_COMMIT_CREATED");

    const prFailure = makeGithub({ createPullRequest: vi.fn(async () => { throw new Error("PR response interrupted"); }) });
    const prAction = makeAction();
    await expect(executeApprovedFixtureProof({ github: prFailure, persistence: makePersistence(prAction), actionId: prAction.id })).rejects.toThrow("PR response interrupted");
    expect(Object.keys(prFailure)).not.toContain("mergePullRequest");
    expect(Object.keys(prFailure)).not.toContain("deleteBranch");
    expect(Object.keys(prFailure)).not.toContain("updateReference");
  });

  it("persists sanitized structured write failure evidence on a terminal partial branch action", async () => {
    const action = makeAction();
    const persistence = makePersistence(action);
    const failure = new GitHubFixtureWriteError({ httpStatus: 403, method: "POST", endpoint: "/git/refs", acceptedGithubPermissions: "contents=write", oauthScopes: null, githubErrorCode: "insufficient_permissions", message: "Bearer [REDACTED] requires Contents write", classification: "TOKEN_SCOPE" });
    await expect(executeApprovedFixtureProof({ github: makeGithub({ createBranch: vi.fn(async () => { throw failure; }) }), persistence, actionId: action.id })).rejects.toThrow();
    const update = persistence.updates.at(-1);
    expect(update).toMatchObject({ status: "PARTIAL_BRANCH_CREATED", failure: { httpStatus: 403, method: "POST", endpoint: "/git/refs", classification: "TOKEN_SCOPE" } });
    expect(JSON.stringify(update)).not.toContain("secret-token");
    expect(persistence.audits.at(-1)?.eventType).toBe("FIXTURE_GITHUB_BRANCH_PARTIAL");
  });

  it("strips query-bearing credential fragments from fallback write-error endpoints before partial persistence", async () => {
    const action = makeAction();
    const persistence = makePersistence(action);
    const failure = new Error("write response unavailable");
    await expect(executeApprovedFixtureProof({ github: makeGithub({ createBranch: vi.fn(async () => { throw failure; }) }), persistence, actionId: action.id })).rejects.toThrow();
    expect(persistence.updates.at(-1)).toMatchObject({ failure: { endpoint: "/git/refs", classification: "UNKNOWN" } });
  });

  it("persists a terminal failed state and records no partial remote effect when write capability is absent before a branch request", async () => {
    const action = makeAction();
    const persistence = makePersistence(action);
    const capabilityFailure = new GitHubWriteCapabilityError({ capability: "contents:write", method: "POST", endpoint: "/git/refs" }, "MISSING_EVIDENCE");
    const github = makeGithub({ createBranch: vi.fn(async () => { throw capabilityFailure; }) });
    await expect(executeApprovedFixtureProof({ github, persistence, actionId: action.id })).rejects.toThrow(/MISSING_EVIDENCE/);
    expect(persistence.updates.at(-1)).toMatchObject({ status: "FAILED", remote: {}, failure: { httpStatus: null, endpoint: "/git/refs", classification: "UNKNOWN" } });
    expect(persistence.audits.at(-1)?.eventType).toBe("FIXTURE_GITHUB_WRITE_CAPABILITY_REFUSED");
    expect(github.updateReleaseManifest).not.toHaveBeenCalled();
    expect(github.createPullRequest).not.toHaveBeenCalled();
  });

  it("refuses a lost concurrent claim before final preflight or any GitHub mutation", async () => {
    const action = makeAction();
    const persistence = makePersistence(action);
    persistence.claimActionForExecution.mockResolvedValueOnce(false);
    const github = makeGithub();
    await expect(executeApprovedFixtureProof({ github, persistence, actionId: action.id })).rejects.toThrow(/already claimed/);
    expect(github.getRepository).not.toHaveBeenCalled();
    expect(github.createBranch).not.toHaveBeenCalled();
  });

  it("preserves returned PR identity under a terminal partial-PR state when verification fails", async () => {
    const action = makeAction();
    const github = makeGithub({
      createPullRequest: vi.fn(async () => ({ number: 11, htmlUrl: "https://github.com/Aayushashsahu/sentinelforge-incident-fixture/pull/11", state: "open", base: "main", head: action.intent.branchName, autoMerge: null })),
      getPullRequest: vi.fn(async () => { throw new Error("verification unavailable"); }),
    });
    const persistence = makePersistence(action);
    await expect(executeApprovedFixtureProof({ github, persistence, actionId: action.id })).rejects.toThrow("verification unavailable");
    expect(persistence.updates.at(-1)).toMatchObject({ status: "PARTIAL_PR_CREATED", remote: { pullRequestNumber: 11, pullRequestUrl: expect.stringContaining("/11") } });
  });

  it("accepts only a canonical one-file, one-line fixture repair patch", () => {
    const canonical = ["diff --git a/release-manifest.json b/release-manifest.json", "--- a/release-manifest.json", "+++ b/release-manifest.json", "@@ -1,3 +1,3 @@", '-  "version": "1.3.0",', '+  "version": "1.4.0",'].join("\n");
    expect(() => assertCanonicalFixtureProofPatch(canonical)).not.toThrow();
    expect(() => assertCanonicalFixtureProofPatch(`${canonical}\n+  "unrelated": true`)).toThrow(/only the exact/);
  });
});

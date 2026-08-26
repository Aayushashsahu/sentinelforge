import { describe, expect, it, vi } from "vitest";
import { buildFixtureProofIntent, type FixtureProofAction, type FixtureProofGitHubPort } from "./fixtureGithubProof";
import { bindFixtureProofApprovalCheckpoint, bindSentFixtureProofContinuation, stageLiveFixtureProofAction } from "./liveFixtureProof";

const fingerprint = "b".repeat(64);
const sha = (character: string) => character.repeat(40);
const before = '{"version":"1.3.0"}\n';
const after = '{"version":"1.4.0"}\n';

function github(): FixtureProofGitHubPort {
  return {
    getRepository: vi.fn(async () => ({ full_name: "Aayushashsahu/sentinelforge-incident-fixture", default_branch: "main", archived: false })),
    getReleaseManifest: vi.fn(async () => ({ text: before, sha: sha("a") })),
    getMainRef: vi.fn(async () => ({ sha: sha("b") })),
    getBranchRef: vi.fn(async () => null),
    findOpenPullRequests: vi.fn(async () => []),
    createBranch: vi.fn(), updateReleaseManifest: vi.fn(), createPullRequest: vi.fn(), getPullRequest: vi.fn(),
  };
}

function port(overrides: Partial<Awaited<ReturnType<typeof makePort>>> = {}) {
  return { ...makePort(), ...overrides };
}

function makePort() {
  const actions: FixtureProofAction[] = [];
  return {
    getMissionBundle: vi.fn(async () => ({ mission: { id: "SF_fixture", status: "PLANNING_FIX", repository: "Aayushashsahu/sentinelforge-incident-fixture", repairSummary: "Align release manifest", patch: 'diff --git a/release-manifest.json b/release-manifest.json\n- "version": "1.3.0"\n+ "version": "1.4.0"\n' }, actions: [] })),
    getAction: vi.fn(async (id: string) => actions.find(action => action.id === id) ?? null),
    stageAction: vi.fn(async (action: FixtureProofAction) => { actions.push(action); return action; }),
    replaceAction: vi.fn(async (action: FixtureProofAction) => { const index = actions.findIndex(item => item.id === action.id); if (index >= 0) actions[index] = action; }),
    updateAction: vi.fn(),
    appendAudit: vi.fn(async () => undefined),
  };
}

describe("live fixture proof coordinator", () => {
  it("stages one exact action and preflight before any provider approval or write", async () => {
    const p = makePort();
    const action = await stageLiveFixtureProofAction({ missionId: "SF_fixture", github: github(), port: p });
    expect(action.status).toBe("AWAITING_APPROVAL");
    expect(action.approval.continuationStatus).toBe("NOT_SENT");
    expect(p.stageAction).toHaveBeenCalledTimes(1);
    expect(p.appendAudit).toHaveBeenCalledWith(expect.objectContaining({ eventType: "FIXTURE_GITHUB_PROOF_STAGED" }));
  });

  it("refuses wrong mission repository, state, proposal, or duplicate proof action", async () => {
    const invalidBundles = [
      { repository: "Aayushashsahu/sentinelforge" },
      { status: "VERIFYING" },
      { patch: "unrelated" },
      { actions: [{ actionType: "FIXTURE_GITHUB_PULL_REQUEST_PROOF" }] },
    ];
    for (const override of invalidBundles) {
      const p = makePort();
      p.getMissionBundle.mockResolvedValue({ mission: { id: "SF_fixture", status: "PLANNING_FIX", repository: "Aayushashsahu/sentinelforge-incident-fixture", repairSummary: "Align", patch: 'diff --git a/release-manifest.json b/release-manifest.json\n- "version": "1.3.0"\n+ "version": "1.4.0"\n', ...override }, actions: override.actions ?? [] });
      await expect(stageLiveFixtureProofAction({ missionId: "SF_fixture", github: github(), port: p })).rejects.toThrow(/repository|planning-stage|exact evidenced|already has/i);
    }
  });

  it("binds only a correlated genuine approval checkpoint then the same sent continuation", async () => {
    const p = makePort();
    const action = await stageLiveFixtureProofAction({ missionId: "SF_fixture", github: github(), port: p });
    const waiting = await bindFixtureProofApprovalCheckpoint({ action, approval: { approvalRequestId: "apr", trueforgeSessionId: "session", turnId: "turn", threadId: "main", toolCallId: "call", requiredActionId: "required" }, port: p });
    expect(waiting.status).toBe("WAITING_APPROVAL");
    await expect(bindSentFixtureProofContinuation({ action: waiting, continuation: { id: "continuation", status: "SENT", approvalRequestId: "apr", trueforgeSessionId: "session", turnId: "turn", threadId: "main", toolCallId: "other" }, port: p })).rejects.toThrow(/correlation/);
    const staged = await bindSentFixtureProofContinuation({ action: waiting, continuation: { id: "continuation", status: "SENT", approvalRequestId: "apr", trueforgeSessionId: "session", turnId: "turn", threadId: "main", toolCallId: "call" }, port: p });
    expect(staged.status).toBe("STAGED");
    expect(staged.approval.continuationStatus).toBe("SENT");
  });
});

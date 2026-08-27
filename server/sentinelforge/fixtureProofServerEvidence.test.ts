import { describe, expect, it, vi } from "vitest";
import { buildFixtureProofIntent, fixtureProofFingerprint, type FixtureProofAction } from "./fixtureGithubProof";
import { acquireFixtureProofServerEvidence } from "./fixtureProofServerEvidence";

const missionId = "SF_fixture";
const actionId = "act_fixture";
const repository = "Aayushashsahu/sentinelforge-incident-fixture";
const summary = "Align release-manifest.json version from 1.3.0 to 1.4.0.";
const patch = ["diff --git a/release-manifest.json b/release-manifest.json", "--- a/release-manifest.json", "+++ b/release-manifest.json", "@@ -1,3 +1,3 @@", '{', '-  "version": "1.3.0",', '+  "version": "1.4.0",', '}'].join("\n");
const fingerprint = fixtureProofFingerprint({ summary, patch });

function fixtureAction(overrides: Partial<FixtureProofAction> = {}): FixtureProofAction {
  return {
    id: actionId,
    missionId,
    status: "AWAITING_APPROVAL",
    intent: buildFixtureProofIntent({ missionId, proposalFingerprint: fingerprint }),
    preflight: { repository, baseBranch: "main", contentSha: "a".repeat(40), baseSha: "b".repeat(40), beforeContent: '{"version":"1.3.0"}', afterContent: '{"version":"1.4.0"}', branchName: "sentinelforge/sf_fixture" },
    readEvidence: { packageEvidenceVerified: false, manifestEvidenceVerified: false, serverEvidence: null, correlation: null },
    approval: { approvalRequestId: null, trueforgeSessionId: null, turnId: null, threadId: null, toolCallId: null, requiredActionId: null, continuationId: null, continuationStatus: "NOT_SENT" },
    remote: {},
    ...overrides,
  };
}

function persistence(action = fixtureAction()) {
  let current = action;
  const audits: Array<Record<string, unknown>> = [];
  return {
    getMissionBundle: vi.fn(async (id: string) => id === missionId ? { mission: { id: missionId, status: "PLANNING_FIX", repository, repairSummary: summary, patch } } : null),
    getAction: vi.fn(async (id: string) => id === current.id ? current : null),
    replaceAction: vi.fn(async (next: FixtureProofAction) => { current = next; }),
    appendAudit: vi.fn(async (audit: Record<string, unknown>) => { audits.push(audit); }),
    current: () => current,
    audits: () => audits,
  };
}

function serverReadClient(overrides: { packageText?: string; manifestText?: string; packageError?: Error; manifestError?: Error } = {}) {
  return {
    getFile: vi.fn(async (owner: string, repo: string, path: string, ref: string) => {
      if (overrides.packageError && path === "package.json") throw overrides.packageError;
      if (overrides.manifestError && path === "release-manifest.json") throw overrides.manifestError;
      return { repository: `${owner}/${repo}`, path, ref, text: path === "package.json" ? (overrides.packageText ?? '{"version":"1.4.0"}') : (overrides.manifestText ?? '{"version":"1.3.0"}') };
    }),
  };
}

describe("server-orchestrated fixture proof evidence", () => {
  it("reads only both persisted canonical artifacts with an injected server client, persists evidence flags, and never places its credential in state or audit", async () => {
    const p = persistence();
    const client = serverReadClient();
    const scratchToken = "scratch-token-must-not-escape";
    const action = await acquireFixtureProofServerEvidence({ missionId, actionId, port: p, createReadClient: () => {
      void scratchToken;
      return client;
    } });

    expect(client.getFile).toHaveBeenNthCalledWith(1, "Aayushashsahu", "sentinelforge-incident-fixture", "package.json", "main");
    expect(client.getFile).toHaveBeenNthCalledWith(2, "Aayushashsahu", "sentinelforge-incident-fixture", "release-manifest.json", "main");
    expect(action.readEvidence).toEqual({ packageEvidenceVerified: true, manifestEvidenceVerified: true, serverEvidence: { source: "SERVER_ORCHESTRATED", package: { path: "package.json", version: "1.4.0" }, manifest: { path: "release-manifest.json", version: "1.3.0" } }, correlation: null });
    expect(p.replaceAction).toHaveBeenCalledTimes(2);
    expect(p.appendAudit).toHaveBeenCalledTimes(2);
    expect(JSON.stringify({ action: p.current(), audits: p.audits() })).not.toContain(scratchToken);
  });

  it("fails closed on a package read failure without reading the manifest or marking either artifact", async () => {
    const p = persistence();
    const client = serverReadClient({ packageError: new Error("read refused") });
    await expect(acquireFixtureProofServerEvidence({ missionId, actionId, port: p, createReadClient: () => client })).rejects.toThrow(/read refused/);
    expect(client.getFile).toHaveBeenCalledTimes(1);
    expect(p.current().readEvidence).toEqual({ packageEvidenceVerified: false, manifestEvidenceVerified: false, serverEvidence: null, correlation: null });
    expect(p.replaceAction).not.toHaveBeenCalled();
    expect(p.appendAudit).not.toHaveBeenCalled();
  });

  it("fails closed on a manifest read failure after only the valid package evidence is durably marked", async () => {
    const p = persistence();
    const client = serverReadClient({ manifestError: new Error("manifest refused") });
    await expect(acquireFixtureProofServerEvidence({ missionId, actionId, port: p, createReadClient: () => client })).rejects.toThrow(/manifest refused/);
    expect(client.getFile).toHaveBeenCalledTimes(2);
    expect(p.current().readEvidence).toEqual({ packageEvidenceVerified: true, manifestEvidenceVerified: false, serverEvidence: { source: "SERVER_ORCHESTRATED", package: { path: "package.json", version: "1.4.0" }, manifest: null }, correlation: null });
    expect(p.appendAudit).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["wrong package version", { packageText: '{"version":"1.3.0"}' }],
    ["wrong manifest version", { manifestText: '{"version":"1.4.0"}' }],
  ])("rejects %s without creating complete evidence", async (_label, content) => {
    const p = persistence();
    const client = serverReadClient(content);
    await expect(acquireFixtureProofServerEvidence({ missionId, actionId, port: p, createReadClient: () => client })).rejects.toThrow(/required version/);
    expect(p.current().readEvidence.manifestEvidenceVerified).toBe(false);
  });

  it("rejects a wrong immutable repository or base ref before it can create a server read client", async () => {
    const wrongRepository = persistence(fixtureAction({ intent: { ...fixtureAction().intent, repository: "Aayushashsahu/other" } }));
    const wrongRef = persistence(fixtureAction({ intent: { ...fixtureAction().intent, baseBranch: "feature" } }));
    const factory = vi.fn(serverReadClient);
    await expect(acquireFixtureProofServerEvidence({ missionId, actionId, port: wrongRepository, createReadClient: factory })).rejects.toThrow(/immutable mission/);
    await expect(acquireFixtureProofServerEvidence({ missionId, actionId, port: wrongRef, createReadClient: factory })).rejects.toThrow(/immutable mission/);
    expect(factory).not.toHaveBeenCalled();
  });

  it("rejects a persisted version mismatch before it can create a server read client or record evidence", async () => {
    const malformed = fixtureAction({ intent: { ...fixtureAction().intent, afterVersion: "9.9.9" } });
    const p = persistence(malformed);
    const factory = vi.fn(serverReadClient);
    await expect(acquireFixtureProofServerEvidence({ missionId, actionId, port: p, createReadClient: factory })).rejects.toThrow(/immutable mission/);
    expect(factory).not.toHaveBeenCalled();
    expect(p.replaceAction).not.toHaveBeenCalled();
    expect(p.appendAudit).not.toHaveBeenCalled();
  });
});

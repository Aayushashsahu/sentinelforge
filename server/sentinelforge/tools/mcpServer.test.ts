import { describe, expect, it, vi } from "vitest";
import { GitHubReadApi } from "./githubRead";
import { getSentinelForgeToolsStatus, SentinelForgeTools } from "./mcpServer";
import { buildFixtureProofIntent, fixtureProofFingerprint, type FixtureProofAction } from "../fixtureGithubProof";

const fixtureOwner = "Aayushashsahu";
const fixtureRepo = "sentinelforge-incident-fixture";
const repairSummary = "Align release-manifest.json from 1.3.0 to 1.4.0 only.";
const patch = "diff --git a/release-manifest.json b/release-manifest.json\n--- a/release-manifest.json\n+++ b/release-manifest.json\n@@ -1,3 +1,3 @@\n {\n-  \"version\": \"1.3.0\",\n+  \"version\": \"1.4.0\",\n }";
const fingerprint = fixtureProofFingerprint({ summary: repairSummary, patch });

function proofAction(overrides: Partial<FixtureProofAction> = {}): FixtureProofAction {
  return {
    id: "act_fixture",
    missionId: "SF_fixture",
    status: "AWAITING_APPROVAL",
    intent: buildFixtureProofIntent({ missionId: "SF_fixture", proposalFingerprint: fingerprint }),
    preflight: { repository: `${fixtureOwner}/${fixtureRepo}`, baseBranch: "main", contentSha: "b".repeat(40), baseSha: "c".repeat(40), beforeContent: '{"version":"1.3.0"}', afterContent: '{"version":"1.4.0"}', branchName: "sentinelforge/sf_fixture" },
    readEvidence: { packageEvidenceVerified: false, manifestEvidenceVerified: false, correlation: null },
    approval: { approvalRequestId: null, trueforgeSessionId: null, turnId: null, threadId: null, toolCallId: null, requiredActionId: null, continuationId: null, continuationStatus: "NOT_SENT" },
    remote: {},
    ...overrides,
  };
}

function state(action: FixtureProofAction | null = null, options: { repository?: string; patch?: string | null } = {}) {
  let current = action;
  return {
    getMissionBundle: vi.fn(async missionId => current && missionId === current.missionId ? {
      mission: { id: current.missionId, status: "PLANNING_FIX", repository: options.repository ?? `${fixtureOwner}/${fixtureRepo}`, repairSummary, patch: options.patch === undefined ? patch : options.patch },
      approvals: [], trueforgeTurns: [], runs: [],
    } : null),
    getFixtureProofAction: vi.fn(async actionId => current?.id === actionId ? current : null),
    replaceFixtureProofAction: vi.fn(async (next: FixtureProofAction) => { current = next; }),
    current: () => current,
  };
}

describe("sentinelforge-tools", () => {
  it("reports the read-only tool surface and fixture allowlist without returning a credential", () => {
    const status = getSentinelForgeToolsStatus();
    expect(status).toMatchObject({ name: "sentinelforge-tools", endpointPath: "/api/mcp/sentinelforge-tools", writeActionsEnabled: false, sandboxEnabled: false });
    expect(status.allowedRepositories).toEqual([`${fixtureOwner}/${fixtureRepo}`]);
    expect(status.tools).toEqual(["get_repository", "get_file", "get_issue", "get_workflow_run", "approval_probe", "repair_proposal_gate", "fixture_github_pr_gate"]);
    expect(JSON.stringify(status)).not.toContain("GITHUB_READ_TOKEN");
  });

  it("returns decoded generic allowlisted file text without returning the token", async () => {
    const token = "server-only-test-token";
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ type: "file", encoding: "base64", content: Buffer.from('{"version":"1.4.0"}\n').toString("base64"), size: 20 }), { status: 200 }));
    const tools = new SentinelForgeTools(new GitHubReadApi(token, fetchImpl as typeof fetch));
    const result = await tools.call("get_file", { owner: fixtureOwner, repo: fixtureRepo, path: "package.json", ref: "main" });
    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([{ type: "text", text: expect.stringContaining('"version":"1.4.0"') }]);
    expect(JSON.stringify(result)).not.toContain(token);
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining(`/repos/${fixtureOwner}/${fixtureRepo}/contents/package.json?ref=main`), expect.objectContaining({ headers: expect.objectContaining({ authorization: `Bearer ${token}` }) }));
  });

  it("rejects repositories outside the explicit allowlist before a generic network request", async () => {
    const fetchImpl = vi.fn();
    const result = await new SentinelForgeTools(new GitHubReadApi("server-only-test-token", fetchImpl as typeof fetch)).call("get_file", { owner: "other", repo: "repository", path: "package.json", ref: "main" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not an allowed SentinelForge investigation target");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns structured blocked approval and repair evidence without GitHub I/O", async () => {
    const fetchImpl = vi.fn();
    const tools = new SentinelForgeTools(new GitHubReadApi("server-only-test-token", fetchImpl as typeof fetch), state());
    const approval = await tools.call("approval_probe", { mission_id: "SF_missing", action_id: "act_missing" });
    const repair = await tools.call("repair_proposal_gate", { mission_id: "SF_missing", action_id: "act_missing", proposal_fingerprint: "a".repeat(64), stage: "APPROVAL_CAPTURE" });
    expect(JSON.parse(approval.content[0].text)).toMatchObject({ status: "BLOCKED", reasons: ["MISSION_NOT_FOUND"] });
    expect(JSON.parse(repair.content[0].text)).toMatchObject({ status: "BLOCKED", reasons: ["MISSION_NOT_FOUND"] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses a fixture proof gate without both persisted action-bound successful read evidences", async () => {
    const fetchImpl = vi.fn();
    const tools = new SentinelForgeTools(new GitHubReadApi("server-only-test-token", fetchImpl as typeof fetch), state(proofAction()));
    const result = await tools.call("fixture_github_pr_gate", { proof_mission_id: "SF_fixture", proof_action_id: "act_fixture" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("server-verified read evidences");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["historical misspelled repository", { repo: "sentinelforce-incident-fixture" }],
    ["alternate owner", { owner: "other" }],
    ["alternate ref", { ref: "feature" }],
    ["alternate path", { path: "other.json" }],
    ["alternate repository alias", { repository: "sentinelforce-incident-fixture" }],
    ["alternate reference alias", { reference: "feature" }],
    ["unrecognized extra field", { arbitrary: "value" }],
  ])("rejects %s as model-supplied fixture target injection before a GitHub read", async (_label, injected) => {
    const fetchImpl = vi.fn();
    const persistence = state(proofAction());
    const tools = new SentinelForgeTools(new GitHubReadApi("server-only-test-token", fetchImpl as typeof fetch), persistence);
    const result = await tools.call("get_file", { proof_mission_id: "SF_fixture", proof_action_id: "act_fixture", artifact: "package.json", ...injected });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("accept only proof identifiers and artifact");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(persistence.replaceFixtureProofAction).not.toHaveBeenCalled();
  });

  it.each([
    ["failed package read", { artifact: "package.json" }, new Response(JSON.stringify({ message: "forbidden" }), { status: 403 })],
    ["wrong package version", { artifact: "package.json" }, new Response(JSON.stringify({ type: "file", encoding: "base64", content: Buffer.from('{"version":"1.3.0"}').toString("base64"), size: 20 }), { status: 200 })],
    ["wrong artifact", { artifact: "other.json" }, null],
  ])("does not mark evidence for %s", async (_label, request, response) => {
    const fetchImpl = vi.fn(async () => response ?? new Response("unused", { status: 500 }));
    const persistence = state(proofAction());
    const tools = new SentinelForgeTools(new GitHubReadApi("server-only-test-token", fetchImpl as typeof fetch), persistence);
    const result = await tools.call("get_file", { ...request, proof_mission_id: "SF_fixture", proof_action_id: "act_fixture" });
    expect(result.isError).toBe(true);
    expect(persistence.current()?.readEvidence).toEqual({ packageEvidenceVerified: false, manifestEvidenceVerified: false, correlation: null });
    expect(persistence.replaceFixtureProofAction).not.toHaveBeenCalled();
  });

  it("marks only exact successful action-bound reads before returning non-mutating gate eligibility", async () => {
    const fetchImpl = vi.fn(async (url: string) => new Response(JSON.stringify({ type: "file", encoding: "base64", content: Buffer.from(url.includes("package.json") ? '{"version":"1.4.0"}' : '{"version":"1.3.0"}').toString("base64"), size: 20 }), { status: 200 }));
    const persistence = state(proofAction());
    const tools = new SentinelForgeTools(new GitHubReadApi("server-only-test-token", fetchImpl as typeof fetch), persistence);
    const proof = { proof_mission_id: "SF_fixture", proof_action_id: "act_fixture" };
    const packageRead = await tools.call("get_file", { ...proof, artifact: "package.json" });
    const manifestRead = await tools.call("get_file", { ...proof, artifact: "release-manifest.json" });
    expect(packageRead.isError).toBeUndefined();
    expect(manifestRead.isError).toBeUndefined();
    const result = await tools.call("fixture_github_pr_gate", proof);
    expect(JSON.parse(result.content[0].text)).toMatchObject({ status: "EVIDENCE_VERIFIED_FOR_PROVIDER_APPROVAL", packageEvidenceVerified: true, manifestEvidenceVerified: true, mutation: "NONE" });
    expect(persistence.current()?.readEvidence).toMatchObject({ packageEvidenceVerified: true, manifestEvidenceVerified: true });
    expect(persistence.replaceFixtureProofAction).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenNthCalledWith(1, expect.stringContaining(`/repos/${fixtureOwner}/${fixtureRepo}/contents/package.json?ref=main`), expect.any(Object));
    expect(fetchImpl).toHaveBeenNthCalledWith(2, expect.stringContaining(`/repos/${fixtureOwner}/${fixtureRepo}/contents/release-manifest.json?ref=main`), expect.any(Object));
  });

  it.each([
    ["wrong mission", { proof_mission_id: "SF_other", proof_action_id: "act_fixture", artifact: "package.json" }, state(proofAction())],
    ["wrong action", { proof_mission_id: "SF_fixture", proof_action_id: "act_other", artifact: "package.json" }, state(proofAction())],
    ["fingerprint mismatch", { proof_mission_id: "SF_fixture", proof_action_id: "act_fixture", artifact: "package.json" }, state(proofAction(), { patch: `${patch}\n` })],
  ])("rejects %s before any GitHub request or approval state change", async (_label, request, persistence) => {
    const fetchImpl = vi.fn();
    const result = await new SentinelForgeTools(new GitHubReadApi("server-only-test-token", fetchImpl as typeof fetch), persistence).call("get_file", request);
    expect(result.isError).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(persistence.replaceFixtureProofAction).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import type { FixtureProofAction } from "../fixtureGithubProof";
import { inspectApprovalProbe, inspectRepairProposalGate, type SafetyInspectionPort } from "./safetyInspection";

const missionId = "SF_probe123";
const fingerprint = "a".repeat(64);
const action: FixtureProofAction = {
  id: "act_probe123",
  missionId,
  status: "WAITING_APPROVAL",
  intent: { missionId, repository: "Aayushashsahu/sentinelforge-incident-fixture", baseBranch: "main", filePath: "release-manifest.json", beforeVersion: "1.3.0", afterVersion: "1.4.0", branchName: "sentinelforge/sf_probe123", proposalFingerprint: fingerprint, idempotencyKey: `fixture-github-pr:${missionId}:${fingerprint}` },
  preflight: { repository: "Aayushashsahu/sentinelforge-incident-fixture", baseBranch: "main", contentSha: "c".repeat(40), baseSha: "b".repeat(40), beforeContent: '{\n  "version": "1.3.0",\n}\n', afterContent: '{\n  "version": "1.4.0",\n}\n', branchName: "sentinelforge/sf_probe123" },
  approval: { approvalRequestId: "apr_probe", trueforgeSessionId: "sess_probe", turnId: "turn_probe", threadId: "main", toolCallId: "call_probe", requiredActionId: "req_probe", continuationId: null, continuationStatus: "NOT_SENT" },
  remote: {},
};

const patch = ["diff --git a/release-manifest.json b/release-manifest.json", "--- a/release-manifest.json", "+++ b/release-manifest.json", "@@ -1,3 +1,3 @@", '-  "version": "1.3.0",', '+  "version": "1.4.0",'].join("\n");

function port(overrides: Partial<NonNullable<Awaited<ReturnType<SafetyInspectionPort["getMissionBundle"]>>>> = {}): SafetyInspectionPort & { reads: ReturnType<typeof vi.fn> } {
  const bundle = { mission: { id: missionId, status: "WAITING_APPROVAL", repository: "Aayushashsahu/sentinelforge-incident-fixture", repairSummary: "align", patch }, approvals: [{ id: "apr_probe", status: "PENDING", expiresAt: Date.now() + 60_000, actionType: "TRUEFORGE_FIXTURE_GITHUB_PR_GATE:fixture_github_pr_gate" }], trueforgeTurns: [{ turnId: "turn_probe", status: "WAITING_APPROVAL", threadId: "main", toolCallId: "call_probe", requiredActionId: "req_probe" }], runs: [] as Array<{ status: string }> };
  const reads = vi.fn(async () => ({ ...bundle, ...overrides }));
  return { reads, getMissionBundle: reads, getFixtureProofAction: vi.fn(async id => id === action.id ? action : null) };
}

describe("read-only safety inspections", () => {
  it("blocks malformed or unknown approval-probe requests without a state read", async () => {
    const state = port();
    expect(await inspectApprovalProbe({}, state)).toMatchObject({ status: "BLOCKED", reasons: ["MALFORMED_INPUT"] });
    expect(state.reads).not.toHaveBeenCalled();
    state.getMissionBundle = vi.fn(async () => null);
    expect(await inspectApprovalProbe({ mission_id: missionId, action_id: action.id }, state)).toMatchObject({ status: "BLOCKED", reasons: ["MISSION_NOT_FOUND"] });
  });

  it("returns usable structured pending approval evidence only for exact action, fingerprint, and correlation", async () => {
    const result = await inspectApprovalProbe({ mission_id: missionId, action_id: action.id, required_action_id: "req_probe", thread_id: "main", tool_call_id: "call_probe", proposal_fingerprint: fingerprint }, port());
    expect(result).toMatchObject({ status: "ALLOWED_FOR_NEXT_STAGE", missionState: "WAITING_APPROVAL", actionState: "WAITING_APPROVAL", approvalState: "PENDING", correlationMatch: true, fingerprintMatch: true, belongsToRequestedAction: true, usable: true });
  });

  it("supports one unambiguous mission-only approval-probe checkpoint without treating it as a fixture action", async () => {
    const state = port({ approvals: [{ id: "apr_probe", status: "PENDING", expiresAt: Date.now() + 60_000, actionType: "TRUEFORGE_PENDING:approval_probe" }] });
    await expect(inspectApprovalProbe({ mission_id: missionId }, state)).resolves.toMatchObject({ status: "ALLOWED_FOR_NEXT_STAGE", actionState: null, approvalState: "PENDING", correlationMatch: true, belongsToRequestedAction: true, usable: true });
  });

  it("fails closed for stale, decided, wrong-thread, wrong-tool, wrong-action, and wrong-fingerprint approval evidence", async () => {
    const stale = port({ approvals: [{ id: "apr_probe", status: "PENDING", expiresAt: Date.now() - 1, actionType: "gate" }] });
    expect((await inspectApprovalProbe({ mission_id: missionId, action_id: action.id }, stale)).reasons).toContain("APPROVAL_STALE");
    const rejected = port({ approvals: [{ id: "apr_probe", status: "REJECTED", expiresAt: Date.now() + 60_000, actionType: "gate" }] });
    expect((await inspectApprovalProbe({ mission_id: missionId, action_id: action.id }, rejected)).reasons).toContain("APPROVAL_NOT_PENDING");
    expect((await inspectApprovalProbe({ mission_id: missionId, action_id: action.id, thread_id: "wrong" }, port())).reasons).toContain("CORRELATION_MISMATCH");
    expect((await inspectApprovalProbe({ mission_id: missionId, action_id: action.id, tool_call_id: "wrong" }, port())).reasons).toContain("CORRELATION_MISMATCH");
    expect((await inspectApprovalProbe({ mission_id: missionId, action_id: "act_other" }, port())).reasons).toContain("ACTION_NOT_FOUND");
    expect((await inspectApprovalProbe({ mission_id: missionId, action_id: action.id, proposal_fingerprint: "b".repeat(64) }, port())).reasons).toContain("FINGERPRINT_MISMATCH");
    const unrelatedTurn = port({ trueforgeTurns: [{ turnId: "turn_unrelated", status: "WAITING_APPROVAL", threadId: "main", toolCallId: "call_unrelated", requiredActionId: "req_unrelated" }, { turnId: "turn_probe", status: "WAITING_APPROVAL", threadId: "main", toolCallId: "call_probe", requiredActionId: "req_probe" }] });
    await expect(inspectApprovalProbe({ mission_id: missionId, action_id: action.id }, unrelatedTurn)).resolves.toMatchObject({ status: "ALLOWED_FOR_NEXT_STAGE", correlationMatch: true });
    const mismatchedActionTurn = port({ trueforgeTurns: [{ turnId: "turn_unrelated", status: "WAITING_APPROVAL", threadId: "main", toolCallId: "call_unrelated", requiredActionId: "req_unrelated" }] });
    expect((await inspectApprovalProbe({ mission_id: missionId, action_id: action.id }, mismatchedActionTurn)).reasons).toContain("ACTION_CORRELATION_MISMATCH");
    const ambiguousProbe = port({ approvals: [{ id: "apr_one", status: "PENDING", expiresAt: Date.now() + 60_000, actionType: "TRUEFORGE_PENDING:approval_probe" }, { id: "apr_two", status: "PENDING", expiresAt: Date.now() + 60_000, actionType: "TRUEFORGE_PENDING:approval_probe" }] });
    expect((await inspectApprovalProbe({ mission_id: missionId }, ambiguousProbe)).reasons).toEqual(expect.arrayContaining(["APPROVAL_AMBIGUOUS", "APPROVAL_NOT_PRESENT"]));
  });

  it("allows a canonical fixture proposal only for approval capture and exposes no secret material", async () => {
    const result = await inspectRepairProposalGate({ mission_id: missionId, action_id: action.id, proposal_fingerprint: fingerprint, stage: "APPROVAL_CAPTURE" }, port());
    expect(result).toMatchObject({ status: "ALLOWED_FOR_NEXT_STAGE", target: { repository: "Aayushashsahu/sentinelforge-incident-fixture", baseBranch: "main", files: ["release-manifest.json"], operation: "1.3.0->1.4.0" }, idempotencyMatch: true, sandboxState: "UNKNOWN", writeCapabilityState: "NOT_REQUIRED" });
    expect(JSON.stringify(result)).not.toContain("server-only-test-token");
  });

  it("blocks proposal gates for malformed input, unknown actions, changed target/patch, fingerprint or idempotency mismatch, and all external-execution preconditions", async () => {
    expect(await inspectRepairProposalGate({}, port())).toMatchObject({ status: "BLOCKED", reasons: ["MALFORMED_INPUT"] });
    expect((await inspectRepairProposalGate({ mission_id: missionId, action_id: "act_other", proposal_fingerprint: fingerprint, stage: "APPROVAL_CAPTURE" }, port())).reasons).toContain("ACTION_NOT_FOUND");
    expect((await inspectRepairProposalGate({ mission_id: missionId, action_id: action.id, proposal_fingerprint: "b".repeat(64), stage: "APPROVAL_CAPTURE" }, port())).reasons).toContain("FINGERPRINT_MISMATCH");
    expect((await inspectRepairProposalGate({ mission_id: missionId, action_id: action.id, proposal_fingerprint: fingerprint, stage: "EXTERNAL_EXECUTION" }, port())).reasons).toEqual(expect.arrayContaining(["SANDBOX_VERIFICATION_BLOCKED", "APPROVAL_NOT_PRESENT", "WRITE_CAPABILITY_UNVERIFIED"]));
    await expect(inspectRepairProposalGate({ mission_id: missionId, action_id: action.id, proposal_fingerprint: fingerprint, stage: "EXTERNAL_EXECUTION" }, port({ runs: [{ status: "PASS" }, { status: "FAIL" }] }))).resolves.toMatchObject({ sandboxState: "PASSED" });
    await expect(inspectRepairProposalGate({ mission_id: missionId, action_id: action.id, proposal_fingerprint: fingerprint, stage: "EXTERNAL_EXECUTION" }, port({ runs: [{ status: "FAIL" }, { status: "PASS" }] }))).resolves.toMatchObject({ sandboxState: "BLOCKED" });
    const changedPatch = port({ mission: { id: missionId, status: "WAITING_APPROVAL", repository: "other/repo", repairSummary: "align", patch: "not a canonical patch" } });
    const changed = await inspectRepairProposalGate({ mission_id: missionId, proposal_fingerprint: fingerprint, stage: "APPROVAL_CAPTURE" }, changedPatch);
    expect(changed.reasons).toEqual(expect.arrayContaining(["TARGET_NOT_ALLOWLISTED", "PROPOSAL_SEMANTICS_INVALID"]));
  });
});

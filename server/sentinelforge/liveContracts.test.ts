import { describe, expect, it } from "vitest";
import { assertLiveGitHubPrExecutionAllowed, buildGuardedGitHubRepairExecutionPlan, buildIdempotentGitHubPullRequestIntent, buildTrueForgeApprovalContinuation, createRepairFingerprint, getLiveExecutionContractStatus, getSandboxVerificationCapabilityState, parseTrueForgeApprovalRequiredEvent, parseTrueForgeProviderApprovalPauseEvent, type LiveRepairProposal } from "./liveContracts";

const proposal: LiveRepairProposal = { summary: "Fix failing build", patch: "diff --git a/a b/a", files_changed: ["src/a.ts"], expected_effect: "Build passes", risk: "LOW" };

describe("live provider-neutral execution contracts", () => {
  it("parses only a real approval-required event with correlated identifiers", () => {
    expect(parseTrueForgeApprovalRequiredEvent({ type: "tool.approval_required", thread_id: "thread_1", tool_call_id: "call_1", required_action_id: "action_1", tool_name: "github.create_pull_request" })).toMatchObject({ thread_id: "thread_1", tool_call_id: "call_1" });
    expect(parseTrueForgeApprovalRequiredEvent({ type: "mcp.initialize" })).toBeNull();
  });

  it("parses the actual provider pause shape only when it has one correlated tool-call identity", () => {
    const event = { type: "tool.approval_required", id: "approval_event_1", created_at: "2026-08-25T15:00:00.000Z", thread_id: "thread_1", tool_calls: [{ id: "call_1", source_event_id: "model_event_1" }] };
    expect(parseTrueForgeProviderApprovalPauseEvent(event)).toMatchObject({ thread_id: "thread_1", tool_calls: [{ id: "call_1" }] });
    expect(parseTrueForgeProviderApprovalPauseEvent({ ...event, tool_calls: [] })).toBeNull();
    expect(parseTrueForgeProviderApprovalPauseEvent({ ...event, tool_calls: [...event.tool_calls, { id: "call_2", source_event_id: "model_event_1" }] })).toBeNull();
  });

  it("rejects oversized untrusted approval-event fields before they can exceed persistence limits", () => {
    expect(parseTrueForgeApprovalRequiredEvent({ type: "tool.approval_required", thread_id: "t".repeat(129), tool_call_id: "call_1", tool_name: "github.create_pull_request" })).toBeNull();
    expect(parseTrueForgeApprovalRequiredEvent({ type: "tool.approval_required", thread_id: "thread_1", tool_call_id: "c".repeat(129), tool_name: "github.create_pull_request" })).toBeNull();
    expect(parseTrueForgeApprovalRequiredEvent({ type: "tool.approval_required", thread_id: "thread_1", tool_call_id: "call_1", required_action_id: "a".repeat(129), tool_name: "github.create_pull_request" })).toBeNull();
    expect(parseTrueForgeApprovalRequiredEvent({ type: "tool.approval_required", thread_id: "thread_1", tool_call_id: "call_1", tool_name: "g".repeat(111) })).toBeNull();
    expect(parseTrueForgeApprovalRequiredEvent({ type: "tool.approval_required", thread_id: " thread_1", tool_call_id: "call_1", tool_name: "github.create_pull_request" })).toBeNull();
    expect(parseTrueForgeApprovalRequiredEvent({ type: "tool.approval_required", thread_id: "thread_1", tool_call_id: "call_1 ", tool_name: "github.create_pull_request" })).toBeNull();
    expect(parseTrueForgeApprovalRequiredEvent({ type: "tool.approval_required", thread_id: "thread_1", tool_call_id: "call_1", tool_name: " github.create_pull_request" })).toBeNull();
  });

  it("builds an explicit allow or deny continuation without executing it", () => {
    expect(buildTrueForgeApprovalContinuation({ threadId: "thread_1", toolCallId: "call_1", approve: true })).toEqual({ type: "user.tool_approval", thread_id: "thread_1", tool_call_id: "call_1", approval: { status: "allow" } });
    expect(buildTrueForgeApprovalContinuation({ threadId: "thread_1", toolCallId: "call_1", approve: false, denialReason: "out of scope" }).approval).toEqual({ status: "deny", reason: "out of scope" });
  });

  it("fails closed when a dormant approval continuation has malformed identifiers or an invalid denial reason", () => {
    expect(() => buildTrueForgeApprovalContinuation({ threadId: " ", toolCallId: "call_1", approve: true })).toThrow(/bounded non-blank/);
    expect(() => buildTrueForgeApprovalContinuation({ threadId: " thread_1", toolCallId: "call_1", approve: true })).toThrow(/bounded non-blank/);
    expect(() => buildTrueForgeApprovalContinuation({ threadId: "thread_1", toolCallId: "call_1 ", approve: true })).toThrow(/bounded non-blank/);
    expect(() => buildTrueForgeApprovalContinuation({ threadId: "thread_1", toolCallId: "c".repeat(129), approve: true })).toThrow(/bounded non-blank/);
    expect(() => buildTrueForgeApprovalContinuation({ threadId: "thread_1", toolCallId: "call_1", approve: false, denialReason: "   " })).toThrow(/denial reason/);
    expect(() => buildTrueForgeApprovalContinuation({ threadId: "thread_1", toolCallId: "call_1", approve: false, denialReason: "d".repeat(4_001) })).toThrow(/denial reason/);
  });

  it("fails closed until approval, verification, correlation, fingerprint, and idempotency prerequisites all pass", () => {
    const fingerprint = createRepairFingerprint(proposal);
    const gate = { missionStatus: "WAITING_APPROVAL" as const, approvalStatus: "APPROVED" as const, verificationStatus: "PASS" as const, approvedFingerprint: fingerprint, currentFingerprint: fingerprint, requiredActionId: "action_1", toolCallId: "call_1", existingActionCount: 0, risk: "LOW" as const };
    expect(() => assertLiveGitHubPrExecutionAllowed(gate)).not.toThrow();
    expect(() => assertLiveGitHubPrExecutionAllowed({ ...gate, verificationStatus: "UNKNOWN" })).toThrow(/verification/);
    expect(() => assertLiveGitHubPrExecutionAllowed({ ...gate, currentFingerprint: "a".repeat(64) })).toThrow(/proposal changed/);
    expect(() => assertLiveGitHubPrExecutionAllowed({ ...gate, approvedFingerprint: "malformed", currentFingerprint: "malformed" })).toThrow(/invalid fingerprint/);
    expect(() => assertLiveGitHubPrExecutionAllowed({ ...gate, existingActionCount: 1 })).toThrow(/idempotent/);
  });

  it("creates a deterministic PR intent but performs no GitHub request", () => {
    const fingerprint = createRepairFingerprint(proposal);
    expect(buildIdempotentGitHubPullRequestIntent({ missionId: "SF_1", repository: "owner/repo", proposal, fingerprint })).toMatchObject({ actionType: "GITHUB_PULL_REQUEST", idempotencyKey: `trueforge-pr:SF_1:${fingerprint}`, branchName: "sentinelforge/sf_1" });
  });

  it("produces an exact non-executable branch, commit, and PR plan that blocks on sandbox failure", () => {
    const fingerprint = createRepairFingerprint(proposal);
    const plan = buildGuardedGitHubRepairExecutionPlan({ missionId: "SF_1", repository: "owner/repo", proposal, fingerprint, verificationStatus: "FAIL" });
    expect(plan).toMatchObject({ status: "BLOCKED_SANDBOX_VERIFICATION", intent: { idempotencyKey: `trueforge-pr:SF_1:${fingerprint}` }, operations: [
      { kind: "create_branch", branchName: "sentinelforge/sf_1", baseRef: "main" },
      { kind: "commit_patch", filesChanged: ["src/a.ts"] },
      { kind: "create_pull_request", title: "Fix failing build" },
    ] });
    expect(buildGuardedGitHubRepairExecutionPlan({ missionId: "SF_1", repository: "owner/repo", proposal, fingerprint, verificationStatus: "PASS" }).status).toBe("REQUIRES_SEPARATE_WRITE_AUTHORIZATION");
  });

  it("refuses every GitHub execution precondition for a sandbox-blocked mission", () => {
    const fingerprint = createRepairFingerprint(proposal);
    const blocked = { missionStatus: "COMPLETED" as const, approvalStatus: "APPROVED" as const, verificationStatus: "FAIL" as const, approvedFingerprint: fingerprint, currentFingerprint: fingerprint, requiredActionId: "action_1", toolCallId: "call_1", existingActionCount: 0, risk: "LOW" as const };
    expect(() => assertLiveGitHubPrExecutionAllowed(blocked)).toThrow(/mission is not waiting/);
    expect(buildGuardedGitHubRepairExecutionPlan({ missionId: "SF_1", repository: "owner/repo", proposal, fingerprint, verificationStatus: "FAIL" }).operations.map(operation => operation.kind)).toEqual(["create_branch", "commit_patch", "create_pull_request"]);
  });

  it("fails closed for unsafe dormant PR-intent targets", () => {
    const fingerprint = createRepairFingerprint(proposal);
    expect(() => buildIdempotentGitHubPullRequestIntent({ missionId: "mission_1", repository: "owner/repo", proposal, fingerprint })).toThrow(/SentinelForge mission/);
    expect(() => buildIdempotentGitHubPullRequestIntent({ missionId: "SF_1", repository: "owner/repo/extra", proposal, fingerprint })).toThrow(/owner\/repository/);
    expect(() => buildIdempotentGitHubPullRequestIntent({ missionId: "SF_1", repository: "owner/repo", proposal: { ...proposal, files_changed: ["../secret"] }, fingerprint })).toThrow(/unsafe changed-file path/);
  });

  it("reports contracts as guarded or blocked rather than claiming a live approval or write", () => {
    expect(getLiveExecutionContractStatus()).toMatchObject({
      repairProposal: "PERSISTED_UNAPPLIED_READ_ONLY_PROPOSAL",
      sandbox: "SANDBOX_VERIFICATION_BLOCKED",
      githubWrite: "GUARDED_NO_REMOTE_WRITE_IMPLEMENTED",
    });
  });

  it("classifies every non-pass verifier result as sandbox verification blocked", () => {
    expect(getSandboxVerificationCapabilityState("PASS")).toBe("SANDBOX_VERIFICATION_PASSED");
    expect(getSandboxVerificationCapabilityState("FAIL")).toBe("SANDBOX_VERIFICATION_BLOCKED");
    expect(getSandboxVerificationCapabilityState("UNKNOWN")).toBe("SANDBOX_VERIFICATION_BLOCKED");
    expect(getSandboxVerificationCapabilityState("TIMEOUT")).toBe("SANDBOX_VERIFICATION_BLOCKED");
  });
});

import { describe, expect, it, vi } from "vitest";
import { persistTrueForgeApprovalRequired } from "./trueforgeApproval";

function makePort(status: "VERIFYING" | "PLANNING_FIX" = "VERIFYING") {
  return {
    getMission: vi.fn().mockResolvedValue({ id: "SF_1", status }),
    getLatestTrueForgeTurn: vi.fn().mockResolvedValue({ turnId: "turn_1" }),
    addApprovalRequest: vi.fn().mockResolvedValue({ id: "apr_1" }),
    updateTrueForgeTurn: vi.fn().mockResolvedValue(undefined),
    setMissionStatus: vi.fn().mockResolvedValue(undefined),
    appendMissionEvent: vi.fn().mockResolvedValue(undefined),
    notifyOwner: vi.fn().mockResolvedValue(true),
    getMissionBundle: vi.fn().mockResolvedValue({ mission: { id: "SF_1", status: "WAITING_APPROVAL" } }),
  };
}

describe("TrueForge approval-required persistence", () => {
  it("persists a real provider pause, correlates the turn, notifies the owner, and performs no continuation", async () => {
    const port = makePort();
    await expect(persistTrueForgeApprovalRequired(port, { missionId: "SF_1", event: { type: "tool.approval_required", thread_id: "thread_1", tool_call_id: "call_1", required_action_id: "action_1", tool_name: "github.create_pull_request" }, risk: "LOW", repairFingerprint: "a".repeat(64), verificationEvidenceRefs: ["run_1"] })).resolves.toMatchObject({ mission: { status: "WAITING_APPROVAL" } });
    expect(port.updateTrueForgeTurn).toHaveBeenCalledWith({ turnId: "turn_1", status: "WAITING_APPROVAL", threadId: "thread_1", requiredActionId: "action_1", toolCallId: "call_1" });
    expect(port.setMissionStatus).toHaveBeenCalledWith("SF_1", "WAITING_APPROVAL");
    expect(port.notifyOwner).toHaveBeenCalledOnce();
    expect(port.appendMissionEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "TRUEFORGE_TOOL_APPROVAL_REQUIRED", correlationId: "call_1" }));
  });

  it("fails closed before persistence when verification has not produced an eligible mission state", async () => {
    const port = makePort("PLANNING_FIX");
    await expect(persistTrueForgeApprovalRequired(port, { missionId: "SF_1", event: { type: "tool.approval_required", thread_id: "thread_1", tool_call_id: "call_1", tool_name: "github.create_pull_request" }, risk: "LOW", repairFingerprint: "a".repeat(64), verificationEvidenceRefs: [] })).rejects.toThrow(/VERIFYING/);
    expect(port.addApprovalRequest).not.toHaveBeenCalled();
    expect(port.updateTrueForgeTurn).not.toHaveBeenCalled();
  });

  it("fails closed before turn, approval, audit, notification, or status persistence for an invalid repair fingerprint", async () => {
    const port = makePort();
    await expect(persistTrueForgeApprovalRequired(port, { missionId: "SF_1", event: { type: "tool.approval_required", thread_id: "thread_1", tool_call_id: "call_1", tool_name: "github.create_pull_request" }, risk: "LOW", repairFingerprint: "not-a-fingerprint", verificationEvidenceRefs: ["run_1"] })).rejects.toThrow(/fingerprint is invalid/);
    expect(port.getLatestTrueForgeTurn).not.toHaveBeenCalled();
    expect(port.addApprovalRequest).not.toHaveBeenCalled();
    expect(port.updateTrueForgeTurn).not.toHaveBeenCalled();
    expect(port.setMissionStatus).not.toHaveBeenCalled();
    expect(port.appendMissionEvent).not.toHaveBeenCalled();
    expect(port.notifyOwner).not.toHaveBeenCalled();
  });

  it("fails closed before approval persistence when no correlated TrueForge turn exists", async () => {
    const port = makePort();
    port.getLatestTrueForgeTurn.mockResolvedValue(null);
    await expect(persistTrueForgeApprovalRequired(port, { missionId: "SF_1", event: { type: "tool.approval_required", thread_id: "thread_1", tool_call_id: "call_1", tool_name: "github.create_pull_request" }, risk: "LOW", repairFingerprint: "a".repeat(64), verificationEvidenceRefs: ["run_1"] })).rejects.toThrow(/no correlated turn/);
    expect(port.addApprovalRequest).not.toHaveBeenCalled();
    expect(port.updateTrueForgeTurn).not.toHaveBeenCalled();
    expect(port.setMissionStatus).not.toHaveBeenCalled();
    expect(port.appendMissionEvent).not.toHaveBeenCalled();
    expect(port.notifyOwner).not.toHaveBeenCalled();
  });

  it("keeps the action paused and audits a notification outage without invoking a continuation", async () => {
    const port = makePort();
    port.notifyOwner.mockResolvedValue(false);
    await expect(persistTrueForgeApprovalRequired(port, { missionId: "SF_1", event: { type: "tool.approval_required", thread_id: "thread_1", tool_call_id: "call_1", tool_name: "github.create_pull_request" }, risk: "MEDIUM", repairFingerprint: "a".repeat(64), verificationEvidenceRefs: ["run_1"] })).resolves.toMatchObject({ mission: { status: "WAITING_APPROVAL" } });
    expect(port.updateTrueForgeTurn).toHaveBeenCalledWith({ turnId: "turn_1", status: "WAITING_APPROVAL", threadId: "thread_1", toolCallId: "call_1" });
    expect(port.setMissionStatus).toHaveBeenCalledWith("SF_1", "WAITING_APPROVAL");
    expect(port.appendMissionEvent).toHaveBeenLastCalledWith(expect.objectContaining({
      eventType: "OWNER_NOTIFIED",
      result: "Owner notification unavailable; the TrueForge action remains safely paused.",
    }));
  });
});

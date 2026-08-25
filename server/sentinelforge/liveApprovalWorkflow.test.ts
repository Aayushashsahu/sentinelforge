import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addApprovalRequest: vi.fn(),
  appendMissionEvent: vi.fn(),
  getMissionBundle: vi.fn(),
  getTrueForgeTurnByMission: vi.fn(),
  notifyOwner: vi.fn(),
  setMissionStatus: vi.fn(),
  updateTrueForgeTurn: vi.fn(),
}));

vi.mock("../_core/notification", () => ({ notifyOwner: mocks.notifyOwner }));
vi.mock("./repository", () => ({
  addApprovalRequest: mocks.addApprovalRequest,
  appendMissionEvent: mocks.appendMissionEvent,
  getMissionBundle: mocks.getMissionBundle,
  getTrueForgeTurnByMission: mocks.getTrueForgeTurnByMission,
  setMissionStatus: mocks.setMissionStatus,
  updateTrueForgeTurn: mocks.updateTrueForgeTurn,
}));

import { persistLiveTrueForgeApprovalRequired } from "./liveApprovalWorkflow";

function validApprovalEvent() {
  return {
    type: "tool.approval_required",
    thread_id: "thread_1",
    tool_call_id: "call_1",
    tool_name: "github.create_pull_request",
  };
}

function expectNoRepositoryOrNotificationAccess() {
  expect(mocks.getMissionBundle).not.toHaveBeenCalled();
  expect(mocks.getTrueForgeTurnByMission).not.toHaveBeenCalled();
  expect(mocks.addApprovalRequest).not.toHaveBeenCalled();
  expect(mocks.updateTrueForgeTurn).not.toHaveBeenCalled();
  expect(mocks.setMissionStatus).not.toHaveBeenCalled();
  expect(mocks.appendMissionEvent).not.toHaveBeenCalled();
  expect(mocks.notifyOwner).not.toHaveBeenCalled();
}

describe("live TrueForge approval adapter", () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset());
  });

  it("rejects a non-approval stream event before any repository lookup", async () => {
    await expect(persistLiveTrueForgeApprovalRequired({
      missionId: "SF_1",
      streamEvent: { type: "mcp.initialize" },
      repairFingerprint: "a".repeat(64),
      verificationEvidenceRefs: [],
    })).rejects.toThrow(/not a valid tool\.approval_required/);
    expectNoRepositoryOrNotificationAccess();
  });

  it("rejects an invalid repair fingerprint before any repository lookup", async () => {
    await expect(persistLiveTrueForgeApprovalRequired({
      missionId: "SF_1",
      streamEvent: validApprovalEvent(),
      repairFingerprint: "invalid-fingerprint",
      verificationEvidenceRefs: [],
    })).rejects.toThrow(/repair fingerprint is invalid/);
    expectNoRepositoryOrNotificationAccess();
  });
});

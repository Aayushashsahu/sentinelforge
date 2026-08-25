import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMissionBundle: vi.fn(),
  linkTrueForgeSession: vi.fn(),
  appendMissionEvent: vi.fn(),
  recordTrueForgeTurn: vi.fn(),
  addEvidence: vi.fn(),
  setMissionPlanningArtifacts: vi.fn(),
  setMissionStatus: vi.fn(),
  recoverPlanningMissionAfterRepairParsingFailure: vi.fn(),
  createInlineSession: vi.fn(),
  resolveModelName: vi.fn(),
  createTurnStream: vi.fn(),
  readTrueForgeSse: vi.fn(),
  listSessionEvents: vi.fn(),
}));

vi.mock("./repository", () => ({
  getMissionBundle: mocks.getMissionBundle,
  linkTrueForgeSession: mocks.linkTrueForgeSession,
  appendMissionEvent: mocks.appendMissionEvent,
  recordTrueForgeTurn: mocks.recordTrueForgeTurn,
  addEvidence: mocks.addEvidence,
  setMissionPlanningArtifacts: mocks.setMissionPlanningArtifacts,
  setMissionStatus: mocks.setMissionStatus,
  recoverPlanningMissionAfterRepairParsingFailure: mocks.recoverPlanningMissionAfterRepairParsingFailure,
  addSandboxRun: vi.fn(),
  createMission: vi.fn(),
  getTrueForgeSessionByMission: vi.fn(),
  getTrueForgeTurnByMission: vi.fn(),
}));

vi.mock("./trueforge/client", () => ({
  getTrueForgeRuntimeConfig: () => ({ baseUrl: "https://runtime.example", model: "nemotron", githubMcpName: "github", toolsMcpName: "sentinelforge-tools" }),
  TrueForgeClient: class {
    resolveModelName = mocks.resolveModelName;
    createInlineSession = mocks.createInlineSession;
    createTurnStream = mocks.createTurnStream;
    listSessionEvents = mocks.listSessionEvents;
  },
}));

vi.mock("./trueforge/stream", () => ({
  readTrueForgeSse: mocks.readTrueForgeSse,
  TrueForgeSseAbortedError: class extends Error {},
}));

import { recoverCompletedLiveRepairPlan, runLiveRepairPlan } from "./liveWorkflow";

describe("live Repair Engineer limitation handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveModelName.mockResolvedValue("nvidia-nim/nemotron");
    mocks.createInlineSession.mockResolvedValue({ id: "repair-session" });
    mocks.createTurnStream.mockResolvedValue(new Response(""));
    mocks.readTrueForgeSse.mockResolvedValue([
      { event: "turn.created", data: { type: "turn.created", turn_id: "repair-turn" } },
      { event: "message", data: { type: "model.message", thread_id: "main", tool_calls: [{ function: { name: "get_file" }, tool_info: { type: "mcp", server_name: "sentinelforge-tools" } }] } },
      { event: "message", data: { type: "model.message", content: JSON.stringify({ summary: "File body unavailable", patch: null, files_changed: [], expected_effect: null, risk: "none", evidence_limitations: "sentinelforge-tools returned no usable ordinary file text." }) } },
    ]);
    mocks.addEvidence.mockResolvedValue({ id: "evd_limited" });
    mocks.getMissionBundle.mockResolvedValue({ mission: { id: "m1", status: "PLANNING_FIX", repository: "Aayushashsahu/sentinelforge-incident-fixture", incident: "manifest mismatch", rootCause: "file body unavailable" } });
  });

  it("persists a limitation event and leaves the planning mission free of approval and action calls", async () => {
    await expect(runLiveRepairPlan("m1")).resolves.toBeDefined();

    expect(mocks.addEvidence).toHaveBeenCalledWith(expect.objectContaining({ kind: "REPAIR_LIMITATION" }));
    expect(mocks.appendMissionEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "REPAIR_LIMITED" }));
    expect(mocks.setMissionStatus).not.toHaveBeenCalled();
    expect(mocks.setMissionPlanningArtifacts).not.toHaveBeenCalled();
  });

  it("recovers a completed object-shaped manifest proposal from read-only history without creating another turn", async () => {
    const failedBundle = {
      mission: { id: "m1", status: "FAILED", repository: "Aayushashsahu/sentinelforge-incident-fixture", incident: "manifest mismatch", rootCause: "version mismatch" },
      events: [{ eventType: "MISSION_FAILED", actor: "Repair Engineer" }],
      trueforgeSessions: [{ sessionId: "repair-session", status: "REPAIR_PLANNING" }],
      trueforgeTurns: [{ turnId: "repair-turn", trueforgeSessionId: "repair-session" }],
    };
    mocks.getMissionBundle.mockResolvedValueOnce(failedBundle).mockResolvedValueOnce({ ...failedBundle, mission: { ...failedBundle.mission, status: "PLANNING_FIX", patch: "recovered" } });
    mocks.listSessionEvents.mockResolvedValue({ data: [
      { event: { type: "turn.created", turn_id: "repair-turn" } },
      { event: { type: "model.message", tool_calls: [{ function: { name: "get_file" }, tool_info: { type: "mcp", server_name: "sentinelforge-tools" } }] } },
      { event: { type: "model.message", content: JSON.stringify({ summary: "Align manifest", patch: { file: "release-manifest.json", old_version: "1.3.0", new_version: "1.4.0" }, files_changed: ["release-manifest.json"], expected_effect: "versions align", risk: "Low", evidence_limitations: "read-only evidence" }) } },
    ] });
    mocks.addEvidence.mockResolvedValue({ id: "evd_recovered" });

    await expect(recoverCompletedLiveRepairPlan("m1")).resolves.toMatchObject({ mission: { status: "PLANNING_FIX" } });
    expect(mocks.createInlineSession).not.toHaveBeenCalled();
    expect(mocks.createTurnStream).not.toHaveBeenCalled();
    expect(mocks.recoverPlanningMissionAfterRepairParsingFailure).toHaveBeenCalledWith("m1", expect.objectContaining({ patch: expect.stringContaining("release-manifest.json") }));
    expect(mocks.appendMissionEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "REPAIR_PROPOSAL_RECOVERED", tool: "mcp:sentinelforge-tools" }));
    expect(mocks.setMissionStatus).not.toHaveBeenCalled();
  });
});

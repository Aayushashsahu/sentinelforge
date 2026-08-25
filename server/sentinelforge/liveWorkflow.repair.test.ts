import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMissionBundle: vi.fn(),
  linkTrueForgeSession: vi.fn(),
  appendMissionEvent: vi.fn(),
  recordTrueForgeTurn: vi.fn(),
  addEvidence: vi.fn(),
  setMissionPlanningArtifacts: vi.fn(),
  setMissionStatus: vi.fn(),
  createInlineSession: vi.fn(),
  resolveModelName: vi.fn(),
  createTurnStream: vi.fn(),
  readTrueForgeSse: vi.fn(),
}));

vi.mock("./repository", () => ({
  getMissionBundle: mocks.getMissionBundle,
  linkTrueForgeSession: mocks.linkTrueForgeSession,
  appendMissionEvent: mocks.appendMissionEvent,
  recordTrueForgeTurn: mocks.recordTrueForgeTurn,
  addEvidence: mocks.addEvidence,
  setMissionPlanningArtifacts: mocks.setMissionPlanningArtifacts,
  setMissionStatus: mocks.setMissionStatus,
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
    listSessionEvents = vi.fn();
  },
}));

vi.mock("./trueforge/stream", () => ({
  readTrueForgeSse: mocks.readTrueForgeSse,
  TrueForgeSseAbortedError: class extends Error {},
}));

import { runLiveRepairPlan } from "./liveWorkflow";

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
});

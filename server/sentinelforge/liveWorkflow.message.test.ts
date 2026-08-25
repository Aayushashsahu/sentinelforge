import { describe, expect, it } from "vitest";
import { buildIncidentInvestigationMessage, buildStreamAuditInputs, findTrueForgeApprovalProbePause, selectSemanticStreamEventsForAudit } from "./liveWorkflow";

describe("incident investigation message", () => {
  it("uses the mission repository and requires the fixture evidence files", () => {
    const message = buildIncidentInvestigationMessage({ repository: "Aayushashsahu/sentinelforge-incident-fixture", incident: "package version does not match release manifest" });
    expect(message).toContain('owner "Aayushashsahu"');
    expect(message).toContain('repo "sentinelforge-incident-fixture"');
    expect(message).toContain("package.json, release-manifest.json, test.js, .github/workflows/test.yml");
  });

  it("rejects a malformed repository before creating a remote turn", () => {
    expect(() => buildIncidentInvestigationMessage({ repository: "not-a-repository", incident: "x" })).toThrow(/owner\/repository/);
  });

  it("uses the requested README, workflow, and package file set for the SentinelForge content probe", () => {
    const message = buildIncidentInvestigationMessage({ repository: "Aayushashsahu/sentinelforge", incident: "prove MCP file text delivery" });
    expect(message).toContain("sentinelforge-tools get_file");
    expect(message).toContain("README.md, server/sentinelforge/workflow.ts, package.json");
    expect(message).toContain("ordinary MCP text");
  });

  it("retains semantic tool and terminal events but omits repeated model deltas from the audit write set", () => {
    const selected = selectSemanticStreamEventsForAudit([
      { event: "message", data: { type: "model.message.delta" } },
      { event: "message", data: { type: "model.message", tool_calls: [] } },
      { event: "turn.done", data: { type: "turn.done" } },
    ]);
    expect(selected).toHaveLength(2);
    expect(selected.map(item => item.event)).toEqual(["message", "turn.done"]);
  });

  it("maps semantic stream events to an ordered batch of sanitized immutable audit inputs", () => {
    const inputs = buildStreamAuditInputs({
      missionId: "m1",
      turnId: "turn-1",
      events: [
        { event: "message", data: { type: "model.message.delta", content: "skip" } },
        { event: "message", data: { type: "model.message", id: "e1", tool_calls: [] } },
        { event: "turn.done", data: { type: "turn.done", id: "e2" } },
      ],
    });
    expect(inputs).toHaveLength(2);
    expect(inputs.map(input => input.correlationId)).toEqual(["turn-1", "turn-1"]);
    expect(inputs.map(input => input.payload)).toEqual([
      expect.objectContaining({ remoteType: "model.message", remoteEventId: "e1" }),
      expect.objectContaining({ remoteType: "turn.done", remoteEventId: "e2" }),
    ]);
  });

  it("accepts one actual provider approval pause and rejects unrelated or ambiguous approval events", () => {
    const pause = { type: "tool.approval_required", id: "approval_event_1", created_at: "2026-08-25T15:00:00.000Z", thread_id: "thread_1", tool_calls: [{ id: "call_1", source_event_id: "model_event_1" }] };
    expect(findTrueForgeApprovalProbePause([{ event: "message", data: { type: "model.message" } }, { event: "message", data: pause }])).toEqual(pause);
    expect(findTrueForgeApprovalProbePause([{ event: "message", data: { ...pause, tool_calls: [] } }])).toBeNull();
  });
});

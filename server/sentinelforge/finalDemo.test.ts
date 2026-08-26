import { describe, expect, it } from "vitest";
import { buildFinalDemoTimeline } from "./finalDemo";

const event = (eventType: string) => ({ id: `evt_${eventType}`, eventType, createdAt: 1, evidenceRefs: "[]" });

describe("final demo timeline", () => {
  it("shows the live workflow as safely complete but never repaired when sandbox verification is blocked", () => {
    const timeline = buildFinalDemoTimeline({
      missionStatus: "COMPLETED",
      events: ["ROOT_CAUSE_IDENTIFIED", "REPAIR_PROPOSED", "TRUEFORGE_REPAIR_PROPOSAL_APPROVAL_REQUIRED", "TRUEFORGE_APPROVAL_ACCEPTED", "TRUEFORGE_CONTINUATION_SENT", "SANDBOX_VERIFICATION_BLOCKED", "GITHUB_PR_INTENT_BLOCKED"].map(event),
      runs: [{ id: "run_1", status: "FAIL" }],
      actions: [],
    });
    expect(timeline.currentState).toBe("COMPLETED_SAFE");
    expect(timeline.writePermitted).toBe(false);
    expect(timeline.repairApplied).toBe(false);
    expect(timeline.stages.find(stage => stage.state === "SANDBOX_VERIFICATION_BLOCKED")).toMatchObject({ status: "BLOCKED" });
    expect(timeline.stages.find(stage => stage.state === "WRITE_BLOCKED")).toMatchObject({ status: "BLOCKED" });
  });

  it("does not claim a safe completion without both the blocker and write-blocked decision", () => {
    const timeline = buildFinalDemoTimeline({ missionStatus: "COMPLETED", events: [event("ROOT_CAUSE_IDENTIFIED")], runs: [], actions: [] });
    expect(timeline.currentState).not.toBe("COMPLETED_SAFE");
  });
});

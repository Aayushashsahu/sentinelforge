import { describe, expect, it } from "vitest";
import { recoverCompletedLiveRepairPlan } from "./liveWorkflow";

const runRepairRecovery = process.env.RECOVER_REPAIR_ENGINEER_LIVE === "1";
const missionId = "SF_xF37FKFqr1NvtA";

describe.skipIf(!runRepairRecovery)("completed Repair Engineer history recovery", () => {
  it("persists the one completed read-only proposal without creating another turn or external action", async () => {
    const bundle = await recoverCompletedLiveRepairPlan(missionId);

    expect(bundle?.mission.id).toBe(missionId);
    expect(bundle?.mission.status).toBe("PLANNING_FIX");
    expect(bundle?.trueforgeSessions.filter((item) => item.status === "REPAIR_PLANNING")).toHaveLength(1);
    expect(bundle?.trueforgeTurns.filter((item) => item.trueforgeSessionId === bundle?.trueforgeSessions.find((session) => session.status === "REPAIR_PLANNING")?.sessionId)).toHaveLength(1);
    expect(bundle?.mission.patch).toContain("release-manifest.json");
    expect(bundle?.mission.patch).toContain("1.3.0");
    expect(bundle?.mission.patch).toContain("1.4.0");
    expect(bundle?.evidence.some((item) => item.kind === "PATCH_PROPOSAL" && item.source === "trueforge/repair-engineer")).toBe(true);
    expect(bundle?.events.some((item) => item.eventType === "REPAIR_PROPOSAL_RECOVERED" && item.tool === "mcp:sentinelforge-tools")).toBe(true);
    expect(bundle?.approvals).toHaveLength(0);
    expect(bundle?.actions).toHaveLength(0);
  }, 30_000);
});

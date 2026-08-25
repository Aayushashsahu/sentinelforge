import { describe, expect, it } from "vitest";
import { runLiveRepairPlan } from "./liveWorkflow";
import { getMissionBundle } from "./repository";

const runLiveRepairEngineer = process.env.RUN_REPAIR_ENGINEER_LIVE === "1";
const missionId = "SF_xF37FKFqr1NvtA";

describe.skipIf(!runLiveRepairEngineer)("first-party MCP Repair Engineer integration", () => {
  it("uses one real sentinelforge-tools turn to persist an un-applied release-manifest proposal", async () => {
    const completedBundle = await runLiveRepairPlan(missionId);

    expect(completedBundle?.mission.id).toBe(missionId);
    expect(completedBundle?.mission.status).toBe("PLANNING_FIX");
    expect(completedBundle?.trueforgeSessions.filter((item) => item.status === "REPAIR_PLANNING")).toHaveLength(1);
    expect(completedBundle?.trueforgeTurns.filter((item) => item.trueforgeSessionId === completedBundle?.trueforgeSessions.find((session) => session.status === "REPAIR_PLANNING")?.sessionId)).toHaveLength(1);
    expect(completedBundle?.evidence.some((item) => item.kind === "PATCH_PROPOSAL" && item.source === "trueforge/repair-engineer" && item.content.includes("release-manifest.json"))).toBe(true);
    expect(completedBundle?.events.some((item) => item.eventType === "REPAIR_PROPOSED" && item.tool === "mcp:sentinelforge-tools")).toBe(true);
    expect(completedBundle?.approvals).toHaveLength(0);
    expect(completedBundle?.externalActions).toHaveLength(0);

    const persistedBundle = await getMissionBundle(missionId);
    expect(persistedBundle?.mission.repairPatch).toContain("release-manifest.json");
    expect(persistedBundle?.mission.repairPatch).toContain("1.3.0");
    expect(persistedBundle?.mission.repairPatch).toContain("1.4.0");
  }, 120_000);
});

import { describe, expect, it, vi } from "vitest";
import { assertAllowedMissionTransition } from "./transitions";
import { prepareFixtureProofPlanningMission, type FixtureProofPlanningMission } from "./fixtureProofPlanningSetup";

const patch = "diff --git a/release-manifest.json b/release-manifest.json\n--- a/release-manifest.json\n+++ b/release-manifest.json\n@@ -1,3 +1,3 @@\n {\n-  \"version\": \"1.3.0\",\n+  \"version\": \"1.4.0\",\n }";
const rootCause = "Canonical release manifest version lags the authoritative package version.";
const repairSummary = "Align release-manifest.json from 1.3.0 to 1.4.0 only.";

function setupPort(initial: FixtureProofPlanningMission) {
  let mission = { ...initial };
  const port = {
    getMission: vi.fn(async () => mission),
    setMissionStatus: vi.fn(async (_missionId: string, status: "INVESTIGATING" | "PLANNING_FIX", updates: { rootCause?: string; repairSummary?: string; patch?: string } = {}) => { mission = { ...mission, status, ...updates }; }),
    appendAudit: vi.fn(async () => undefined),
  };
  return { port, current: () => mission };
}

describe("fixture-proof planning setup", () => {
  it("keeps a direct CREATED to PLANNING_FIX transition rejected by the production state machine", () => {
    expect(() => assertAllowedMissionTransition("CREATED", "PLANNING_FIX")).toThrow("Mission transition refused: CREATED → PLANNING_FIX");
  });

  it("reaches planning only through CREATED to INVESTIGATING to PLANNING_FIX and creates no action", async () => {
    const fixture = setupPort({ id: "SF_setup", status: "CREATED", repository: "Aayushashsahu/sentinelforge-incident-fixture", rootCause: null, repairSummary: null, patch: null });
    await expect(prepareFixtureProofPlanningMission({ missionId: "SF_setup", rootCause, repairSummary, patch, port: fixture.port })).resolves.toMatchObject({ status: "PLANNING_FIX", rootCause, repairSummary, patch });
    expect(fixture.port.setMissionStatus).toHaveBeenNthCalledWith(1, "SF_setup", "INVESTIGATING");
    expect(fixture.port.setMissionStatus).toHaveBeenNthCalledWith(2, "SF_setup", "PLANNING_FIX", { rootCause, repairSummary, patch });
    expect(fixture.port.appendAudit).toHaveBeenCalledTimes(2);
    expect(fixture.current().status).toBe("PLANNING_FIX");
    expect(Object.keys(fixture.port)).not.toContain("stageAction");
  });

  it("is idempotent for an exact existing planning proposal without duplicate transitions or audit", async () => {
    const fixture = setupPort({ id: "SF_setup", status: "PLANNING_FIX", repository: "Aayushashsahu/sentinelforge-incident-fixture", rootCause, repairSummary, patch });
    await expect(prepareFixtureProofPlanningMission({ missionId: "SF_setup", rootCause, repairSummary, patch, port: fixture.port })).resolves.toMatchObject({ id: "SF_setup", status: "PLANNING_FIX" });
    expect(fixture.port.setMissionStatus).not.toHaveBeenCalled();
    expect(fixture.port.appendAudit).not.toHaveBeenCalled();
  });

  it("fails closed for an ineligible state or mismatched persisted planning proposal", async () => {
    const executing = setupPort({ id: "SF_setup", status: "EXECUTING", repository: "Aayushashsahu/sentinelforge-incident-fixture", rootCause: null, repairSummary: null, patch: null });
    await expect(prepareFixtureProofPlanningMission({ missionId: "SF_setup", rootCause, repairSummary, patch, port: executing.port })).rejects.toThrow(/not eligible/);
    const mismatched = setupPort({ id: "SF_setup", status: "PLANNING_FIX", repository: "Aayushashsahu/sentinelforge-incident-fixture", rootCause, repairSummary: "other", patch });
    await expect(prepareFixtureProofPlanningMission({ missionId: "SF_setup", rootCause, repairSummary, patch, port: mismatched.port })).rejects.toThrow(/artifacts differ/);
  });
});

import { describe, expect, it } from "vitest";
import { createLiveMission, investigateLiveMission } from "./liveWorkflow";
import { getMissionBundle } from "./repository";

const runLiveInvestigator = process.env.RUN_FIRST_PARTY_INVESTIGATOR_LIVE === "1";

describe.skipIf(!runLiveInvestigator)("first-party MCP Investigator integration", () => {
  it("uses one real sentinelforge-tools Investigator turn to persist fixture file-body evidence", async () => {
    const bundle = await createLiveMission({
      title: "Read-only fixture release investigation",
      repository: "Aayushashsahu/sentinelforge-incident-fixture",
      incident: "The release validation intentionally fails because the package and release manifest versions are believed to differ.",
      risk: "LOW",
    });

    const missionId = bundle.mission.id;
    await investigateLiveMission(missionId);
    const completedBundle = await getMissionBundle(missionId);

    expect(completedBundle?.mission.status).toBe("PLANNING_FIX");
    expect(completedBundle?.trueforgeSessions).toHaveLength(1);
    expect(completedBundle?.trueforgeTurns).toHaveLength(1);
    expect(completedBundle?.evidence.some((item) => item.kind === "OBSERVED" && item.source === "package.json" && item.content.includes("1.4.0"))).toBe(true);
    expect(completedBundle?.evidence.some((item) => item.kind === "OBSERVED" && item.source === "release-manifest.json" && item.content.includes("1.3.0"))).toBe(true);
    expect(completedBundle?.evidence.some((item) => item.kind === "OBSERVED" && item.source === "test.js" && item.content.includes("exits with code 1"))).toBe(true);
    expect(completedBundle?.mission.rootCause).toMatch(/1\.4\.0|1\.3\.0|version/i);
  }, 120_000);
});

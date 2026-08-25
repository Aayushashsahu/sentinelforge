import { describe, expect, it } from "vitest";
import { buildIncidentInvestigationMessage, selectSemanticStreamEventsForAudit } from "./liveWorkflow";

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
    expect(message).toContain("search_repositories");
    expect(message).toContain("README.md, server/sentinelforge/workflow.ts, package.json");
    expect(message).toContain("embedded resource");
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
});

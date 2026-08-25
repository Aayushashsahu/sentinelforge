import { describe, expect, it } from "vitest";
import { buildReadOnlyRepairEngineerSpec, parseRepairEngineerOutcome, parseRepairEngineerResult } from "./repairEngineer";
import { buildRepairEngineerMessage } from "../liveWorkflow";

describe("read-only Repair Engineer", () => {
  it("uses only explicit first-party MCP reads and disables sandbox execution", () => {
    const spec = buildReadOnlyRepairEngineerSpec({ model: "nemotron", toolsMcpName: "sentinelforge-tools" });
    expect(spec.mcp_servers[0]).toMatchObject({ name: "sentinelforge-tools", enable_tools: ["get_repository", "get_file", "get_issue", "get_workflow_run"], require_approval_for_tools: ["@write", "@destructive"] });
    expect(spec.config.sandbox.enabled).toBe(false);
  });

  it("accepts a structured proposal but refuses malformed repair output", () => {
    const result = parseRepairEngineerResult([{ content: JSON.stringify({ summary: "Align manifest version", patch: "--- a/release-manifest.json\n+++ b/release-manifest.json", files_changed: ["release-manifest.json"], expected_effect: "release check passes", risk: "LOW", evidence_limitations: ["Live MCP returned checksums only."] }) }]);
    expect(result.files_changed).toEqual(["release-manifest.json"]);
    expect(() => parseRepairEngineerResult([{ content: "not JSON" }])).toThrow(/malformed/i);
  });

  it("pins the repair request to the exact mission repository and prohibits writes", () => {
    const message = buildRepairEngineerMessage({ repository: "Aayushashsahu/sentinelforge-incident-fixture", incident: "manifest mismatch", rootCause: "MCP file body limitation" });
    expect(message).toContain('owner "Aayushashsahu"');
    expect(message).toContain('repo "sentinelforge-incident-fixture"');
    expect(message).toContain("Do not apply the patch");
  });

  it("treats an explicit no-patch content limitation as a safe planning outcome rather than a proposal", () => {
    const outcome = parseRepairEngineerOutcome([{ content: JSON.stringify({ summary: "File text unavailable", patch: null, files_changed: [], expected_effect: null, risk: "none", evidence_limitations: "GitHub MCP returned only a SHA." }) }]);
    expect(outcome).toEqual({ kind: "LIMITATION", summary: "File text unavailable", limitations: ["GitHub MCP returned only a SHA."] });
  });
});

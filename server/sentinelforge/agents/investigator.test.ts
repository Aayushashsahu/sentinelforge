import { describe, expect, it } from "vitest";
import { buildReadOnlyInvestigatorSpec, parseInvestigatorResult } from "./investigator";

describe("read-only Investigator", () => {
  it("restricts its configured GitHub MCP tools to read-only and disables sandboxing", () => {
    const spec = buildReadOnlyInvestigatorSpec({ model: "nemotron", githubMcpName: "github" });
    expect(spec.mcp_servers).toEqual([{ name: "github", enable_tools: ["@read-only"], require_approval_for_tools: ["@write", "@destructive"], preload: true }]);
    expect(spec.config.sandbox.enabled).toBe(false);
  });

  it("accepts only evidence-backed structured results from the event stream", () => {
    const result = parseInvestigatorResult([{ message: JSON.stringify({ finding: "CI manifest differs", root_cause: "Version drift", confidence: 0.9, evidence: [{ source: "github:file", detail: "manifest version differs" }], recommended_next_step: "Prepare a minimal patch" }) }]);
    expect(result.root_cause).toBe("Version drift");
    expect(() => parseInvestigatorResult([{ message: "not structured output" }])).toThrow(/malformed/i);
  });
});

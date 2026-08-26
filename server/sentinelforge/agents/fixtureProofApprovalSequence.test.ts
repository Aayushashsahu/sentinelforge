import { describe, expect, it } from "vitest";
import { validateFixtureProofApprovalCaptureSequence } from "./fixtureProofApprovalSequence";
import type { TrueForgeStreamEvent } from "../trueforge/stream";

const toolsMcpName = "sentinelforge-tools";

function modelTool(name: string, path?: string): TrueForgeStreamEvent {
  return {
    event: "model.message",
    data: {
      type: "model.message",
      turn_id: "turn_fixture_1",
      tool_calls: [{ function: { name, arguments: JSON.stringify(path ? { path } : {}) }, tool_info: { type: "mcp", server_name: toolsMcpName } }],
    },
  };
}

const pause: TrueForgeStreamEvent = {
  event: "tool.approval_required",
  data: { type: "tool.approval_required", id: "required_fixture_1", created_at: "2026-08-26T00:00:00.000Z", thread_id: "main", tool_calls: [{ id: "call_fixture_1", source_event_id: "model_fixture_1" }] },
};

describe("fixture proof approval capture sequence", () => {
  it("accepts only the exact package, manifest, gate, and genuine-pause sequence", () => {
    const result = validateFixtureProofApprovalCaptureSequence([
      modelTool("get_file", "package.json"),
      modelTool("get_file", "release-manifest.json"),
      modelTool("fixture_github_pr_gate"),
      pause,
    ], toolsMcpName);
    expect(result.turnId).toBe("turn_fixture_1");
    expect(result.pause.thread_id).toBe("main");
  });

  it.each([
    ["wrong file", [modelTool("get_file", "package.json"), modelTool("get_file", "README.md"), modelTool("fixture_github_pr_gate"), pause]],
    ["wrong order", [modelTool("get_file", "release-manifest.json"), modelTool("get_file", "package.json"), modelTool("fixture_github_pr_gate"), pause]],
    ["wrong gate", [modelTool("get_file", "package.json"), modelTool("get_file", "release-manifest.json"), modelTool("repair_proposal_gate"), pause]],
    ["missing approval", [modelTool("get_file", "package.json"), modelTool("get_file", "release-manifest.json"), modelTool("fixture_github_pr_gate")]],
  ])("fails closed for %s", (_label, events) => {
    expect(() => validateFixtureProofApprovalCaptureSequence(events, toolsMcpName)).toThrow(/Fixture proof approval capture/);
  });
});

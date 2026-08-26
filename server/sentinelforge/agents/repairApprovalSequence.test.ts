import { describe, expect, it } from "vitest";
import { validateRepairApprovalCaptureSequence } from "./repairApprovalSequence";

const tools = "sentinelforge-tools";
const turn = { event: "turn.created", data: { type: "turn.created", turn_id: "turn_1" } } as const;
const call = (name: string, path?: string) => ({ event: "model.message", data: { type: "model.message", tool_calls: [{ function: { name, arguments: JSON.stringify(path ? { path } : {}) }, tool_info: { server_name: tools } }] } });
const pause = { event: "tool.approval_required", data: { type: "tool.approval_required", id: "action_1", created_at: "2026-08-26T00:00:00.000Z", thread_id: "main", tool_calls: [{ id: "call_1", source_event_id: "event_1" }] } } as const;

describe("repair approval capture sequence", () => {
  it("rejects turn.done with zero tool calls", () => expect(() => validateRepairApprovalCaptureSequence([turn, { event: "turn.done", data: { type: "turn.done" } }], tools)).toThrow(/exactly get_file/));
  it("rejects one get_file only", () => expect(() => validateRepairApprovalCaptureSequence([turn, call("get_file", "package.json")], tools)).toThrow(/exactly get_file/));
  it("rejects a wrong get_file path", () => expect(() => validateRepairApprovalCaptureSequence([turn, call("get_file", "README.md"), call("get_file", "release-manifest.json"), call("repair_proposal_gate")], tools)).toThrow(/exactly get_file/));
  it("rejects two required reads without the gate", () => expect(() => validateRepairApprovalCaptureSequence([turn, call("get_file", "package.json"), call("get_file", "release-manifest.json")], tools)).toThrow(/exactly get_file/));
  it("rejects a gate without provider approval", () => expect(() => validateRepairApprovalCaptureSequence([turn, call("get_file", "package.json"), call("get_file", "release-manifest.json"), call("repair_proposal_gate")], tools)).toThrow(/approval_required/));
  it("accepts only the complete ordered sequence with valid provider correlation", () => expect(validateRepairApprovalCaptureSequence([turn, call("get_file", "package.json"), call("get_file", "release-manifest.json"), call("repair_proposal_gate"), pause], tools)).toMatchObject({ turnId: "turn_1", pause: { id: "action_1", thread_id: "main" } }));
  it("rejects malformed approval correlation", () => expect(() => validateRepairApprovalCaptureSequence([turn, call("get_file", "package.json"), call("get_file", "release-manifest.json"), call("repair_proposal_gate"), { ...pause, data: { ...pause.data, tool_calls: [{ id: "", source_event_id: "event_1" }] } }], tools)).toThrow(/approval_required/));
});

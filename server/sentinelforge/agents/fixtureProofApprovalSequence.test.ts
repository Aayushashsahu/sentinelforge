import { describe, expect, it } from "vitest";
import { validateFixtureProofApprovalCaptureSequence } from "./fixtureProofApprovalSequence";
import type { TrueForgeStreamEvent } from "../trueforge/stream";

const toolsMcpName = "sentinelforge-tools";
const turnId = "turn_fixture_1";
const threadId = "main";

function record(event: TrueForgeStreamEvent) { return event.data as Record<string, unknown>; }
function modelTool(id: string, name: string, args: Record<string, unknown>, eventId = `event_${id}`): TrueForgeStreamEvent {
  return { event: "model.message", data: { type: "model.message", id: eventId, turn_id: turnId, thread_id: threadId, tool_calls: [{ id, function: { name, arguments: JSON.stringify(args) }, tool_info: { type: "mcp", server_name: toolsMcpName } }] } };
}
function readResponse(callId: string, path: string, version: string): TrueForgeStreamEvent {
  return { event: "tool.response", data: { type: "tool.response", id: `response_${callId}`, turn_id: turnId, thread_id: threadId, tool_call_id: callId, content: `Repository: Aayushashsahu/sentinelforge-incident-fixture\nPath: ${path}\nRef: main\n\n{\n  "version": "${version}"\n}\n` } };
}
function validEvents(): TrueForgeStreamEvent[] {
  const packageCall = modelTool("call_package", "get_file", { owner: "Aayushashsahu", repo: "sentinelforge-incident-fixture", ref: "main", path: "package.json" });
  const manifestCall = modelTool("call_manifest", "get_file", { owner: "Aayushashsahu", repo: "sentinelforge-incident-fixture", ref: "main", path: "release-manifest.json" });
  const gate = modelTool("call_gate", "fixture_github_pr_gate", {});
  const pause: TrueForgeStreamEvent = { event: "tool.approval_required", data: { type: "tool.approval_required", id: "required_fixture_1", created_at: "2026-08-26T00:00:00.000Z", thread_id: threadId, tool_calls: [{ id: "call_gate", source_event_id: "event_call_gate" }] } };
  return [packageCall, readResponse("call_package", "package.json", "1.4.0"), manifestCall, readResponse("call_manifest", "release-manifest.json", "1.3.0"), gate, pause];
}

describe("fixture proof approval capture sequence", () => {
  it("accepts only exact successful allowlisted reads followed by a source-correlated fixture-gate pause", () => {
    const result = validateFixtureProofApprovalCaptureSequence(validEvents(), toolsMcpName);
    expect(result.turnId).toBe(turnId);
    expect(result.pause.tool_calls[0]?.id).toBe("call_gate");
  });

  it.each([
    ["wrong owner", (events: TrueForgeStreamEvent[]) => { const call = record(events[0]!); ((call.tool_calls as Array<{ function: { arguments: string } }>)[0]!).function.arguments = JSON.stringify({ owner: "other", repo: "sentinelforge-incident-fixture", ref: "main", path: "package.json" }); }],
    ["wrong repository", (events: TrueForgeStreamEvent[]) => { const call = record(events[2]!); ((call.tool_calls as Array<{ function: { arguments: string } }>)[0]!).function.arguments = JSON.stringify({ owner: "Aayushashsahu", repo: "other", ref: "main", path: "release-manifest.json" }); }],
    ["wrong ref", (events: TrueForgeStreamEvent[]) => { const call = record(events[0]!); ((call.tool_calls as Array<{ function: { arguments: string } }>)[0]!).function.arguments = JSON.stringify({ owner: "Aayushashsahu", repo: "sentinelforge-incident-fixture", ref: "feature", path: "package.json" }); }],
    ["wrong body version", (events: TrueForgeStreamEvent[]) => { record(events[3]!).content = (record(readResponse("call_manifest", "release-manifest.json", "1.2.0")).content); }],
    ["wrong gate source event", (events: TrueForgeStreamEvent[]) => { ((record(events[5]!).tool_calls as Array<{ source_event_id: string }>)[0]!).source_event_id = "other_event"; }],
    ["pause before gate", (events: TrueForgeStreamEvent[]) => { const pause = events.pop()!; events.splice(0, 0, pause); }],
    ["missing approval", (events: TrueForgeStreamEvent[]) => { events.pop(); }],
  ])("fails closed for %s", (_label, mutate) => {
    const events = validEvents();
    mutate(events);
    expect(() => validateFixtureProofApprovalCaptureSequence(events, toolsMcpName)).toThrow(/Fixture proof approval capture/);
  });
});

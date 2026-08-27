import { describe, expect, it } from "vitest";
import { validateFixtureProofApprovalCaptureSequence } from "./fixtureProofApprovalSequence";
import type { TrueForgeStreamEvent } from "../trueforge/stream";
import { buildFixtureProofIntent, type FixtureProofAction } from "../fixtureGithubProof";
import { buildFixtureProofApprovalMessage, buildFixtureProofApprovalSpec } from "./fixtureProofApproval";

const toolsMcpName = "sentinelforge-tools";
const turnId = "turn_fixture_1";
const threadId = "main";
const action: FixtureProofAction = {
  id: "act_fixture",
  missionId: "SF_fixture",
  status: "AWAITING_APPROVAL",
  intent: buildFixtureProofIntent({ missionId: "SF_fixture", proposalFingerprint: "a".repeat(64) }),
  preflight: { repository: "Aayushashsahu/sentinelforge-incident-fixture", baseBranch: "main", contentSha: "b".repeat(40), baseSha: "c".repeat(40), beforeContent: '{"version":"1.3.0"}', afterContent: '{"version":"1.4.0"}', branchName: "sentinelforge/sf_fixture" },
  readEvidence: { packageEvidenceVerified: false, manifestEvidenceVerified: false, correlation: null },
  approval: { approvalRequestId: null, trueforgeSessionId: null, turnId: null, threadId: null, toolCallId: null, requiredActionId: null, continuationId: null, continuationStatus: "NOT_SENT" },
  remote: {},
};

function record(event: TrueForgeStreamEvent) { return event.data as Record<string, unknown>; }
function modelTool(id: string, name: string, args: Record<string, unknown>, eventId = `event_${id}`): TrueForgeStreamEvent {
  return { event: "model.message", data: { type: "model.message", id: eventId, turn_id: turnId, thread_id: threadId, tool_calls: [{ id, function: { name, arguments: JSON.stringify(args) }, tool_info: { type: "mcp", server_name: toolsMcpName } }] } };
}
function readResponse(callId: string, path: string, version: string): TrueForgeStreamEvent {
  return { event: "tool.response", data: { type: "tool.response", id: `response_${callId}`, turn_id: turnId, thread_id: threadId, tool_call_id: callId, content: `Repository: Aayushashsahu/sentinelforge-incident-fixture\nPath: ${path}\nRef: main\n\n{\n  "version": "${version}"\n}\n` } };
}
function validEvents(): TrueForgeStreamEvent[] {
  const proof = { proof_mission_id: action.missionId, proof_action_id: action.id };
  const packageCall = modelTool("call_package", "get_file", { artifact: "package.json", ...proof });
  const manifestCall = modelTool("call_manifest", "get_file", { artifact: "release-manifest.json", ...proof });
  const gate = modelTool("call_gate", "fixture_github_pr_gate", proof);
  const pause: TrueForgeStreamEvent = { event: "tool.approval_required", data: { type: "tool.approval_required", id: "required_fixture_1", created_at: "2026-08-26T00:00:00.000Z", thread_id: threadId, tool_calls: [{ id: "call_gate", source_event_id: "event_call_gate" }] } };
  return [packageCall, readResponse("call_package", "package.json", "1.4.0"), manifestCall, readResponse("call_manifest", "release-manifest.json", "1.3.0"), gate, pause];
}

describe("fixture proof approval capture sequence", () => {
  it("binds the model prompt and tool catalog to persisted proof IDs while preserving read-only tools and approval-gated execution", () => {
    const message = buildFixtureProofApprovalMessage({ missionId: action.missionId, actionId: action.id });
    const spec = buildFixtureProofApprovalSpec({ model: "model", toolsMcpName });
    expect(message).toContain(`proof_mission_id "${action.missionId}"`);
    expect(message).toContain(`proof_action_id "${action.id}"`);
    expect(message).toContain('artifact "package.json"');
    expect(message).toContain("Do not supply owner, repo, ref, or path");
    expect(message).not.toContain('repo "sentinelforge-incident-fixture"');
    expect(spec.mcp_servers?.[0]).toMatchObject({ enable_tools: ["get_file", "fixture_github_pr_gate"], require_approval_for_tools: ["fixture_github_pr_gate"], preload: true });
    expect(spec.config.sandbox.enabled).toBe(false);
  });
  it("accepts only exact successful allowlisted reads followed by a source-correlated fixture-gate pause", () => {
    const result = validateFixtureProofApprovalCaptureSequence(validEvents(), toolsMcpName, action);
    expect(result.turnId).toBe(turnId);
    expect(result.pause.tool_calls[0]?.id).toBe("call_gate");
  });

  it.each([
    ["model-supplied owner", (events: TrueForgeStreamEvent[]) => { const call = record(events[0]!); ((call.tool_calls as Array<{ function: { arguments: string } }>)[0]!).function.arguments = JSON.stringify({ owner: "other", artifact: "package.json", proof_mission_id: action.missionId, proof_action_id: action.id }); }],
    ["model-supplied repository", (events: TrueForgeStreamEvent[]) => { const call = record(events[2]!); ((call.tool_calls as Array<{ function: { arguments: string } }>)[0]!).function.arguments = JSON.stringify({ repo: "sentinelforce-incident-fixture", artifact: "release-manifest.json", proof_mission_id: action.missionId, proof_action_id: action.id }); }],
    ["model-supplied ref", (events: TrueForgeStreamEvent[]) => { const call = record(events[0]!); ((call.tool_calls as Array<{ function: { arguments: string } }>)[0]!).function.arguments = JSON.stringify({ ref: "feature", artifact: "package.json", proof_mission_id: action.missionId, proof_action_id: action.id }); }],
    ["unrecognized extra field", (events: TrueForgeStreamEvent[]) => { const call = record(events[0]!); ((call.tool_calls as Array<{ function: { arguments: string } }>)[0]!).function.arguments = JSON.stringify({ arbitrary: "value", artifact: "package.json", proof_mission_id: action.missionId, proof_action_id: action.id }); }],
    ["wrong artifact", (events: TrueForgeStreamEvent[]) => { const call = record(events[0]!); ((call.tool_calls as Array<{ function: { arguments: string } }>)[0]!).function.arguments = JSON.stringify({ artifact: "other.json", proof_mission_id: action.missionId, proof_action_id: action.id }); }],
    ["wrong action", (events: TrueForgeStreamEvent[]) => { const call = record(events[0]!); ((call.tool_calls as Array<{ function: { arguments: string } }>)[0]!).function.arguments = JSON.stringify({ artifact: "package.json", proof_mission_id: action.missionId, proof_action_id: "act_other" }); }],
    ["wrong body version", (events: TrueForgeStreamEvent[]) => { record(events[3]!).content = (record(readResponse("call_manifest", "release-manifest.json", "1.2.0")).content); }],
    ["wrong gate source event", (events: TrueForgeStreamEvent[]) => { ((record(events[5]!).tool_calls as Array<{ source_event_id: string }>)[0]!).source_event_id = "other_event"; }],
    ["pause before gate", (events: TrueForgeStreamEvent[]) => { const pause = events.pop()!; events.splice(0, 0, pause); }],
    ["missing approval", (events: TrueForgeStreamEvent[]) => { events.pop(); }],
  ])("fails closed for %s", (_label, mutate) => {
    const events = validEvents();
    mutate(events);
    expect(() => validateFixtureProofApprovalCaptureSequence(events, toolsMcpName, action)).toThrow(/Fixture proof approval capture/);
  });
});

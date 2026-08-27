import { describe, expect, it } from "vitest";
import { validateFixtureProofApprovalCaptureSequence } from "./fixtureProofApprovalSequence";
import type { TrueForgeStreamEvent } from "../trueforge/stream";
import { buildFixtureProofIntent, type FixtureProofAction } from "../fixtureGithubProof";
import { buildFixtureProofApprovalMessage, buildFixtureProofApprovalSpec } from "./fixtureProofApproval";

const toolsMcpName = "sentinelforge-tools";
const sessionId = "session_fixture_1";
const turnId = "turn_fixture_1";
const threadId = "main";
const action: FixtureProofAction = {
  id: "act_fixture",
  missionId: "SF_fixture",
  status: "AWAITING_APPROVAL",
  intent: buildFixtureProofIntent({ missionId: "SF_fixture", proposalFingerprint: "a".repeat(64) }),
  preflight: { repository: "Aayushashsahu/sentinelforge-incident-fixture", baseBranch: "main", contentSha: "b".repeat(40), baseSha: "c".repeat(40), beforeContent: '{"version":"1.3.0"}', afterContent: '{"version":"1.4.0"}', branchName: "sentinelforge/sf_fixture" },
  readEvidence: { packageEvidenceVerified: true, manifestEvidenceVerified: true, serverEvidence: { source: "SERVER_ORCHESTRATED", package: { path: "package.json", version: "1.4.0" }, manifest: { path: "release-manifest.json", version: "1.3.0" } }, correlation: null },
  approval: { approvalRequestId: null, trueforgeSessionId: null, turnId: null, threadId: null, toolCallId: null, requiredActionId: null, continuationId: null, continuationStatus: "NOT_SENT" },
  remote: {},
};

function record(event: TrueForgeStreamEvent) { return event.data as Record<string, unknown>; }
function modelTool(id: string, name: string, args: Record<string, unknown>, input: { eventId?: string; turn?: string; thread?: string } = {}): TrueForgeStreamEvent {
  return { event: "model.message", data: { type: "model.message", id: input.eventId ?? `event_${id}`, turn_id: input.turn ?? turnId, thread_id: input.thread ?? threadId, tool_calls: [{ id, function: { name, arguments: JSON.stringify(args) }, tool_info: { type: "mcp", server_name: toolsMcpName } }] } };
}
function turnEvent(type: "turn.created" | "turn.done", id: string, input: { turn?: string; thread?: string } = {}): TrueForgeStreamEvent {
  return { event: type, data: { type, id, turn_id: input.turn ?? turnId, thread_id: input.thread ?? threadId } };
}
function initEvent(): TrueForgeStreamEvent { return { event: "mcp.initialize", data: { type: "mcp.initialize", id: "mcp_init_1", server_name: toolsMcpName } }; }
function pauseEvent(input: { requiredActionId?: string; callId?: string; sourceEventId?: string; thread?: string } = {}): TrueForgeStreamEvent {
  return { event: "tool.approval_required", data: { type: "tool.approval_required", id: input.requiredActionId ?? "required_fixture_1", created_at: "2026-08-26T00:00:00.000Z", thread_id: input.thread ?? threadId, tool_calls: [{ id: input.callId ?? "call_gate", source_event_id: input.sourceEventId ?? "event_call_gate" }] } };
}
function validEvents(): TrueForgeStreamEvent[] {
  const proof = { proof_mission_id: action.missionId, proof_action_id: action.id };
  return [turnEvent("turn.created", "created_1"), initEvent(), modelTool("call_gate", "fixture_github_pr_gate", proof), pauseEvent(), turnEvent("turn.done", "done_1")];
}
function validate(events: TrueForgeStreamEvent[]) { return validateFixtureProofApprovalCaptureSequence(events, toolsMcpName, structuredClone(action), sessionId); }

describe("fixture proof approval capture sequence", () => {
  it("binds the model prompt and tool catalog to persisted proof IDs while retaining server-orchestrated evidence and approval-gated execution", () => {
    const message = buildFixtureProofApprovalMessage({ missionId: action.missionId, actionId: action.id });
    const spec = buildFixtureProofApprovalSpec({ model: "model", toolsMcpName });
    expect(message).toContain(`proof_mission_id "${action.missionId}"`);
    expect(message).toContain(`proof_action_id "${action.id}"`);
    expect(message).toContain("server has already verified");
    expect(message).toContain("Do not attempt or claim any file reads");
    expect(message).not.toContain('repo "sentinelforge-incident-fixture"');
    expect(spec.mcp_servers?.[0]).toMatchObject({ enable_tools: ["fixture_github_pr_gate"], require_approval_for_tools: ["fixture_github_pr_gate"], preload: true });
    expect(spec.config.sandbox.enabled).toBe(false);
  });

  it("accepts one source-correlated fixture-gate pause only after server evidence is already marked", () => {
    const result = validate(validEvents());
    expect(result.turnId).toBe(turnId);
    expect(result.pause.tool_calls[0]?.id).toBe("call_gate");
    expect(result.rawGateCallCount).toBe(1);
    expect(result.canonicalGateCallCount).toBe(1);
  });

  it("canonicalizes duplicate serialized gate and approval records with identical complete correlation", () => {
    const events = validEvents();
    events.splice(3, 0, structuredClone(events[2]!), structuredClone(events[3]!));
    const result = validate(events);
    expect(result.rawGateCallCount).toBe(2);
    expect(result.canonicalGateCallCount).toBe(1);
    expect(result.rawApprovalPauseCount).toBe(2);
    expect(result.canonicalApprovalPauseCount).toBe(1);
  });

  it("canonicalizes duplicated terminal records with the same turn/thread/id", () => {
    const events = validEvents();
    events.push(structuredClone(events[4]!));
    expect(validate(events).canonicalGateCallCount).toBe(1);
  });

  it("accepts the observed failed S2 provider-history representation as one logical gate", () => {
    const proof = { proof_mission_id: "SF_Ey9cVUoLBNGn0M", proof_action_id: "act_Njt60Oiv-kvXAd" };
    const historicalAction = structuredClone(action);
    historicalAction.id = proof.proof_action_id;
    historicalAction.missionId = proof.proof_mission_id;
    historicalAction.intent = buildFixtureProofIntent({ missionId: proof.proof_mission_id, proposalFingerprint: "d".repeat(64) });
    const gate = modelTool("call-5fe8222b-dc69-46e6-aecb-a366369386e6", "fixture_github_pr_gate", proof, { eventId: "01m11rp92zw1q1jwfb4rqhpdsw" });
    const events = [turnEvent("turn.created", "01m11rp7hthxwcca74knmvqpds"), initEvent(), gate, structuredClone(gate), pauseEvent({ requiredActionId: "01m11rpfjbwh5c8trh5v47d17h", callId: "call-5fe8222b-dc69-46e6-aecb-a366369386e6", sourceEventId: "01m11rp92zw1q1jwfb4rqhpdsw" }), turnEvent("turn.done", "01m11rpfjch4s47d35mcz8bfv8")];
    const result = validateFixtureProofApprovalCaptureSequence(events, toolsMcpName, historicalAction, "01m11rp14s0ntkqg12g67vq48v");
    expect(result.gateToolCallId).toBe("call-5fe8222b-dc69-46e6-aecb-a366369386e6");
    expect(result.canonicalGateCallCount).toBe(1);
  });

  it.each([
    ["model-supplied owner", (events: TrueForgeStreamEvent[]) => { const call = record(events[2]!); ((call.tool_calls as Array<{ function: { arguments: string } }>)[0]!).function.arguments = JSON.stringify({ owner: "other", proof_mission_id: action.missionId, proof_action_id: action.id }); }],
    ["two gate calls with different tool-call IDs", (events: TrueForgeStreamEvent[]) => { events.splice(3, 0, modelTool("call_second", "fixture_github_pr_gate", { proof_mission_id: action.missionId, proof_action_id: action.id }, { eventId: "event_second" })); }],
    ["two approval pauses with different required-action IDs", (events: TrueForgeStreamEvent[]) => { events.splice(4, 0, pauseEvent({ requiredActionId: "required_other" })); }],
    ["same tool call with a different turn", (events: TrueForgeStreamEvent[]) => { events.splice(3, 0, modelTool("call_gate", "fixture_github_pr_gate", { proof_mission_id: action.missionId, proof_action_id: action.id }, { eventId: "event_call_gate", turn: "turn_other" })); }],
    ["same tool call with a different thread", (events: TrueForgeStreamEvent[]) => { events.splice(3, 0, modelTool("call_gate", "fixture_github_pr_gate", { proof_mission_id: action.missionId, proof_action_id: action.id }, { eventId: "event_call_gate", thread: "thread_other" })); }],
    ["same tool call with a different serialized session", (events: TrueForgeStreamEvent[]) => { (record(events[2]!) as { session_id?: string }).session_id = "session_other"; }],
    ["approval referring to a different tool call", (events: TrueForgeStreamEvent[]) => { events[3] = pauseEvent({ callId: "call_other" }); }],
    ["missing gate thread correlation", (events: TrueForgeStreamEvent[]) => { delete record(events[2]!).thread_id; }],
    ["unrelated extra MCP tool", (events: TrueForgeStreamEvent[]) => { events.splice(3, 0, modelTool("call_other", "get_file", { path: "other.json" }, { eventId: "event_other" })); }],
    ["missing terminal event", (events: TrueForgeStreamEvent[]) => { events.pop(); }],
  ])("fails closed for %s", (_label, mutate) => {
    const events = validEvents();
    mutate(events);
    expect(() => validate(events)).toThrow(/Fixture proof approval capture/);
  });
});

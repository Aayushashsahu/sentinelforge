import { parseTrueForgeProviderApprovalPauseEvent } from "../liveContracts";
import { FIXTURE_GITHUB_PR_GATE_TOOL_NAME } from "./fixtureProofApproval";
import type { TrueForgeStreamEvent } from "../trueforge/stream";
import type { FixtureProofAction } from "../fixtureGithubProof";

type ModelToolCall = { name: string; server: string | null; callId: string; eventId: string; turnId: string; threadId: string | null; eventIndex: number; arguments: Record<string, unknown> };

function dataRecord(event: TrueForgeStreamEvent): Record<string, unknown> {
  return event.data && typeof event.data === "object" && !Array.isArray(event.data) ? event.data as Record<string, unknown> : {};
}

function parseArguments(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

function extractModelToolCalls(event: TrueForgeStreamEvent, eventIndex: number): ModelToolCall[] {
  const data = dataRecord(event);
  const eventId = typeof data.id === "string" ? data.id : null;
  const turnId = typeof data.turn_id === "string" ? data.turn_id : null;
  const threadId = typeof data.thread_id === "string" ? data.thread_id : null;
  if (!eventId || !turnId || !Array.isArray(data.tool_calls)) return [];
  return data.tool_calls.flatMap(call => {
    if (!call || typeof call !== "object") return [];
    const record = call as Record<string, unknown>;
    const fn = record.function && typeof record.function === "object" ? record.function as Record<string, unknown> : {};
    const info = record.tool_info && typeof record.tool_info === "object" ? record.tool_info as Record<string, unknown> : {};
    const callId = typeof record.id === "string" ? record.id : null;
    const name = typeof fn.name === "string" ? fn.name : null;
    if (!callId || !name) return [];
    return [{ name, callId, eventId, turnId, threadId, eventIndex, server: typeof info.server_name === "string" ? info.server_name : null, arguments: parseArguments(fn.arguments) }];
  });
}

export function validateFixtureProofApprovalCaptureSequence(events: readonly TrueForgeStreamEvent[], toolsMcpName: string, action: FixtureProofAction) {
  const orderedCalls = events.flatMap((event, eventIndex) => extractModelToolCalls(event, eventIndex));
  if (orderedCalls.length !== 1) throw new Error("Fixture proof approval capture requires exactly one fixture gate call after server-orchestrated evidence verification.");
  const gateCall = orderedCalls[0];
  const serverEvidence = action.readEvidence.serverEvidence;
  const exactProofKeys = gateCall ? Object.keys(gateCall.arguments).sort().join(",") === "proof_action_id,proof_mission_id" : false;
  if (!gateCall || !action.readEvidence.packageEvidenceVerified || !action.readEvidence.manifestEvidenceVerified || !serverEvidence || serverEvidence.source !== "SERVER_ORCHESTRATED" || serverEvidence.package?.path !== "package.json" || serverEvidence.package.version !== action.intent.afterVersion || serverEvidence.manifest?.path !== action.intent.filePath || serverEvidence.manifest.version !== action.intent.beforeVersion || gateCall.name !== FIXTURE_GITHUB_PR_GATE_TOOL_NAME || gateCall.server !== toolsMcpName || !exactProofKeys || gateCall.arguments.proof_mission_id !== action.missionId || gateCall.arguments.proof_action_id !== action.id || !gateCall.threadId) {
    throw new Error("Fixture proof approval capture requires exact server-orchestrated evidence and one non-mutating fixture gate call.");
  }
  const pauseIndex = events.findIndex(event => parseTrueForgeProviderApprovalPauseEvent(event.data) !== null);
  const pause = pauseIndex >= 0 ? parseTrueForgeProviderApprovalPauseEvent(events[pauseIndex]!.data) : null;
  if (!pause || pauseIndex <= gateCall.eventIndex || pause.thread_id !== gateCall.threadId || pause.tool_calls.length !== 1 || pause.tool_calls[0]!.id !== gateCall.callId || pause.tool_calls[0]!.source_event_id !== gateCall.eventId) {
    throw new Error("Fixture proof approval capture requires a genuine approval pause correlated to the preceding fixture gate call.");
  }
  return { pause, turnId: gateCall.turnId, threadId: gateCall.threadId, gateToolCallId: gateCall.callId };
}

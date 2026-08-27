import { parseTrueForgeProviderApprovalPauseEvent } from "../liveContracts";
import { FIXTURE_GITHUB_PR_GATE_TOOL_NAME } from "./fixtureProofApproval";
import type { TrueForgeStreamEvent } from "../trueforge/stream";
import type { FixtureProofAction } from "../fixtureGithubProof";

type ModelToolCall = { name: string; server: string | null; callId: string; eventId: string; turnId: string; threadId: string | null; eventIndex: number; arguments: Record<string, unknown> };
type CanonicalGateCall = ModelToolCall & { identity: string };
type CanonicalApprovalPause = { pause: NonNullable<ReturnType<typeof parseTrueForgeProviderApprovalPauseEvent>>; eventIndex: number; identity: string };

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
    const sourceEventId = typeof record.source_event_id === "string" ? record.source_event_id : eventId;
    if (!sourceEventId) return [];
    return [{ name, callId, eventId: sourceEventId, turnId, threadId, eventIndex, server: typeof info.server_name === "string" ? info.server_name : null, arguments: parseArguments(fn.arguments) }];
  });
}

function canonicalizeGateCalls(events: readonly TrueForgeStreamEvent[], sessionId: string): CanonicalGateCall[] {
  const unique = new Map<string, CanonicalGateCall>();
  for (const call of events.flatMap((event, eventIndex) => extractModelToolCalls(event, eventIndex))) {
    const serializedSessionId = dataRecord(events[call.eventIndex]!).session_id;
    if (typeof serializedSessionId === "string" && serializedSessionId !== sessionId) throw new Error("Fixture proof approval capture refused: provider history gate session correlation differs from the capture session.");
    if (!call.threadId || !call.server) continue;
    const identity = [sessionId, call.turnId, call.threadId, call.callId, call.eventId].join("\u0000");
    if (!unique.has(identity)) unique.set(identity, { ...call, identity });
  }
  return Array.from(unique.values());
}

function canonicalizeApprovalPauses(events: readonly TrueForgeStreamEvent[], sessionId: string, gate: CanonicalGateCall): CanonicalApprovalPause[] {
  const unique = new Map<string, CanonicalApprovalPause>();
  events.forEach((event, eventIndex) => {
    const pause = parseTrueForgeProviderApprovalPauseEvent(event.data);
    if (!pause) return;
    const call = pause.tool_calls[0];
    if (!call) return;
    const identity = [sessionId, gate.turnId, pause.thread_id, call.id, pause.id, call.source_event_id].join("\u0000");
    if (!unique.has(identity)) unique.set(identity, { pause, eventIndex, identity });
  });
  return Array.from(unique.values());
}

function eventType(event: TrueForgeStreamEvent): string | null {
  const data = dataRecord(event);
  return typeof data.type === "string" ? data.type : event.event || null;
}

function countCanonicalLifecycleEvents(events: readonly TrueForgeStreamEvent[], type: string, turnId: string, threadId: string): number {
  const identities = new Set<string>();
  events.forEach((event, index) => {
    const data = dataRecord(event);
    if (eventType(event) !== type || data.turn_id !== turnId) return;
    if (typeof data.thread_id === "string" && data.thread_id !== threadId) return;
    const id = typeof data.id === "string" ? data.id : `${type}:${index}`;
    identities.add([turnId, threadId, id].join("\u0000"));
  });
  return identities.size;
}

export function validateFixtureProofApprovalCaptureSequence(events: readonly TrueForgeStreamEvent[], toolsMcpName: string, action: FixtureProofAction, sessionId: string) {
  if (!sessionId.trim()) throw new Error("Fixture proof approval capture requires a non-blank provider session correlation.");
  const orderedCalls = canonicalizeGateCalls(events, sessionId);
  if (orderedCalls.length !== 1) throw new Error("Fixture proof approval capture requires exactly one logical fixture gate call after server-orchestrated evidence verification.");
  const gateCall = orderedCalls[0];
  const serverEvidence = action.readEvidence.serverEvidence;
  const exactProofKeys = gateCall ? Object.keys(gateCall.arguments).sort().join(",") === "proof_action_id,proof_mission_id" : false;
  if (!gateCall || !action.readEvidence.packageEvidenceVerified || !action.readEvidence.manifestEvidenceVerified || !serverEvidence || serverEvidence.source !== "SERVER_ORCHESTRATED" || serverEvidence.package?.path !== "package.json" || serverEvidence.package.version !== action.intent.afterVersion || serverEvidence.manifest?.path !== action.intent.filePath || serverEvidence.manifest.version !== action.intent.beforeVersion || gateCall.name !== FIXTURE_GITHUB_PR_GATE_TOOL_NAME || gateCall.server !== toolsMcpName || !exactProofKeys || gateCall.arguments.proof_mission_id !== action.missionId || gateCall.arguments.proof_action_id !== action.id || !gateCall.threadId) {
    throw new Error("Fixture proof approval capture requires exact server-orchestrated evidence and one non-mutating fixture gate call.");
  }
  const pauses = canonicalizeApprovalPauses(events, sessionId, gateCall);
  if (pauses.length !== 1) throw new Error("Fixture proof approval capture requires exactly one logical approval-required pause.");
  const canonicalPause = pauses[0]!;
  const pause = canonicalPause.pause;
  const createdCount = countCanonicalLifecycleEvents(events, "turn.created", gateCall.turnId, gateCall.threadId);
  const initializedCount = events.filter(event => eventType(event) === "mcp.initialize").length;
  const terminalCount = countCanonicalLifecycleEvents(events, "turn.done", gateCall.turnId, gateCall.threadId);
  if (createdCount !== 1 || initializedCount !== 1 || terminalCount !== 1 || canonicalPause.eventIndex <= gateCall.eventIndex || pause.thread_id !== gateCall.threadId || pause.tool_calls.length !== 1 || pause.tool_calls[0]!.id !== gateCall.callId || pause.tool_calls[0]!.source_event_id !== gateCall.eventId) {
    throw new Error("Fixture proof approval capture requires a genuine approval pause correlated to the preceding fixture gate call.");
  }
  return { pause, turnId: gateCall.turnId, threadId: gateCall.threadId, gateToolCallId: gateCall.callId, rawGateCallCount: events.flatMap((event, eventIndex) => extractModelToolCalls(event, eventIndex)).length, canonicalGateCallCount: orderedCalls.length, rawApprovalPauseCount: events.filter(event => parseTrueForgeProviderApprovalPauseEvent(event.data) !== null).length, canonicalApprovalPauseCount: pauses.length };
}

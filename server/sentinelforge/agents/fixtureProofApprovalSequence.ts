import { parseTrueForgeProviderApprovalPauseEvent } from "../liveContracts";
import { FIXTURE_GITHUB_PR_GATE_TOOL_NAME } from "./fixtureProofApproval";
import type { TrueForgeStreamEvent } from "../trueforge/stream";
import type { FixtureProofAction } from "../fixtureGithubProof";
import { normalizedFixtureProviderEventData } from "../fixtureProviderHistoryNormalization";

type ModelToolCall = { name: string; server: string | null; callId: string; eventId: string; turnId: string; threadId: string | null; eventIndex: number; arguments: Record<string, unknown> };
type CanonicalGateCall = ModelToolCall & { identity: string };
type CanonicalApprovalPause = { pause: NonNullable<ReturnType<typeof parseTrueForgeProviderApprovalPauseEvent>>; eventIndex: number; identity: string };
type CanonicalLifecycleEvent = { eventIndex: number; identity: string };

function dataRecord(event: TrueForgeStreamEvent): Record<string, unknown> {
  return normalizedFixtureProviderEventData(event);
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
  if (data.type !== "model.message") return [];
  if (!Array.isArray(data.tool_calls)) return [];
  const eventId = typeof data.id === "string" ? data.id : null;
  const turnId = typeof data.turn_id === "string" ? data.turn_id : null;
  const threadId = typeof data.thread_id === "string" ? data.thread_id : null;
  if (!eventId || !turnId || !threadId) throw new Error("Fixture proof approval capture refused: every provider model tool-call record requires complete event, turn, and raw thread correlation.");
  return data.tool_calls.map(call => {
    if (!call || typeof call !== "object") throw new Error("Fixture proof approval capture refused: provider model tool-call data is malformed.");
    const record = call as Record<string, unknown>;
    const fn = record.function && typeof record.function === "object" ? record.function as Record<string, unknown> : {};
    const info = record.tool_info && typeof record.tool_info === "object" ? record.tool_info as Record<string, unknown> : {};
    const callId = typeof record.id === "string" ? record.id : null;
    const name = typeof fn.name === "string" ? fn.name : null;
    const server = typeof info.server_name === "string" ? info.server_name : null;
    if (!callId || !name || !server) throw new Error("Fixture proof approval capture refused: provider model tool-call correlation is incomplete or malformed.");
    const sourceEventId = typeof record.source_event_id === "string" ? record.source_event_id : eventId;
    if (!sourceEventId) throw new Error("Fixture proof approval capture refused: provider model tool-call source-event correlation is unavailable.");
    return { name, callId, eventId: sourceEventId, turnId, threadId, eventIndex, server, arguments: parseArguments(fn.arguments) };
  });
}

function canonicalizeGateCalls(events: readonly TrueForgeStreamEvent[], sessionId: string): CanonicalGateCall[] {
  const unique = new Map<string, { call: CanonicalGateCall; signature: string }>();
  for (const call of events.flatMap((event, eventIndex) => extractModelToolCalls(event, eventIndex))) {
    const serializedSessionId = dataRecord(events[call.eventIndex]!).session_id;
    if (typeof serializedSessionId === "string" && serializedSessionId !== sessionId) throw new Error("Fixture proof approval capture refused: provider history gate session correlation differs from the capture session.");
    if (!call.threadId || !call.server) throw new Error("Fixture proof approval capture refused: every provider tool call requires complete thread and MCP server correlation.");
    const identity = [sessionId, call.turnId, call.threadId, call.callId, call.eventId].join("\u0000");
    const canonical = { ...call, identity };
    const signature = JSON.stringify({ normalizedData: dataRecord(events[call.eventIndex]!), rawData: events[call.eventIndex]!.data });
    const existing = unique.get(identity);
    if (existing && existing.signature !== signature) throw new Error("Fixture proof approval capture refused: duplicate gate correlation contains conflicting semantic payload.");
    if (!existing) unique.set(identity, { call: canonical, signature });
  }
  return Array.from(unique.values(), value => value.call);
}

function canonicalizeApprovalPauses(events: readonly TrueForgeStreamEvent[], sessionId: string, gate: CanonicalGateCall): CanonicalApprovalPause[] {
  const unique = new Map<string, { value: CanonicalApprovalPause; signature: string }>();
  events.forEach((event, eventIndex) => {
    const pause = parseTrueForgeProviderApprovalPauseEvent(event.data);
    if (!pause) return;
    const call = pause.tool_calls[0];
    if (!call) return;
    const identity = [sessionId, gate.turnId, pause.thread_id, call.id, pause.id, call.source_event_id].join("\u0000");
    const value = { pause, eventIndex, identity };
    const signature = JSON.stringify({ normalizedData: dataRecord(event), rawData: event.data });
    const existing = unique.get(identity);
    if (existing && existing.signature !== signature) throw new Error("Fixture proof approval capture refused: duplicate approval correlation contains conflicting semantic payload.");
    if (!existing) unique.set(identity, { value, signature });
  });
  return Array.from(unique.values(), value => value.value);
}

function eventType(event: TrueForgeStreamEvent): string | null {
  const data = dataRecord(event);
  return typeof data.type === "string" ? data.type : event.event || null;
}

function canonicalizeLifecycleEvents(events: readonly TrueForgeStreamEvent[], type: "turn.created" | "turn.done", sessionId: string, turnId: string): CanonicalLifecycleEvent[] {
  const unique = new Map<string, { value: CanonicalLifecycleEvent; signature: string }>();
  events.forEach((event, index) => {
    const data = dataRecord(event);
    if (eventType(event) !== type) return;
    if (data.turn_id !== turnId || typeof data.id !== "string" || !data.id) throw new Error("Fixture proof approval capture refused: lifecycle event turn correlation is incomplete or differs from the canonical gate.");
    if (typeof data.session_id === "string" && data.session_id !== sessionId) throw new Error("Fixture proof approval capture refused: lifecycle event session correlation differs from the capture session.");
    const identity = [sessionId, turnId, type, data.id].join("\u0000");
    const value = { eventIndex: index, identity };
    const signature = JSON.stringify(data);
    const existing = unique.get(identity);
    if (existing && existing.signature !== signature) throw new Error("Fixture proof approval capture refused: duplicate lifecycle correlation contains conflicting semantic payload.");
    if (!existing) unique.set(identity, { value, signature });
  });
  return Array.from(unique.values(), value => value.value);
}

function canonicalizeFixtureInitialization(events: readonly TrueForgeStreamEvent[], toolsMcpName: string, sessionId: string, turnId: string, threadId: string): CanonicalLifecycleEvent[] {
  const unique = new Map<string, { value: CanonicalLifecycleEvent; signature: string }>();
  events.forEach((event, index) => {
    const data = dataRecord(event);
    if (eventType(event) !== "mcp.initialize") return;
    const mcpServers = Array.isArray(data.mcp_servers) ? data.mcp_servers : [];
    const matchingServers = mcpServers.filter(server => server && typeof server === "object" && (server as Record<string, unknown>).name === toolsMcpName);
    if (matchingServers.length !== 1 || data.session_id !== sessionId || data.turn_id !== turnId || data.thread_id !== threadId || typeof data.id !== "string" || !data.id) throw new Error("Fixture proof approval capture refused: MCP initialization correlation is incomplete or does not identify the fixture tools server.");
    const identity = [sessionId, turnId, threadId, toolsMcpName, data.id].join("\u0000");
    const value = { eventIndex: index, identity };
    const signature = JSON.stringify(data);
    const existing = unique.get(identity);
    if (existing && existing.signature !== signature) throw new Error("Fixture proof approval capture refused: duplicate MCP initialization contains conflicting semantic payload.");
    if (!existing) unique.set(identity, { value, signature });
  });
  return Array.from(unique.values(), value => value.value);
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
  const created = canonicalizeLifecycleEvents(events, "turn.created", sessionId, gateCall.turnId);
  const initialized = canonicalizeFixtureInitialization(events, toolsMcpName, sessionId, gateCall.turnId, gateCall.threadId);
  const terminal = canonicalizeLifecycleEvents(events, "turn.done", sessionId, gateCall.turnId);
  if (created.length !== 1 || initialized.length !== 1 || terminal.length !== 1 || !(created[0]!.eventIndex < initialized[0]!.eventIndex && initialized[0]!.eventIndex < gateCall.eventIndex && gateCall.eventIndex < canonicalPause.eventIndex && canonicalPause.eventIndex < terminal[0]!.eventIndex) || pause.thread_id !== gateCall.threadId || pause.tool_calls.length !== 1 || pause.tool_calls[0]!.id !== gateCall.callId || pause.tool_calls[0]!.source_event_id !== gateCall.eventId) {
    throw new Error("Fixture proof approval capture requires a genuine approval pause correlated to the preceding fixture gate call.");
  }
  return { pause, turnId: gateCall.turnId, threadId: gateCall.threadId, gateToolCallId: gateCall.callId, rawGateCallCount: events.flatMap((event, eventIndex) => extractModelToolCalls(event, eventIndex)).length, canonicalGateCallCount: orderedCalls.length, rawApprovalPauseCount: events.filter(event => parseTrueForgeProviderApprovalPauseEvent(event.data) !== null).length, canonicalApprovalPauseCount: pauses.length };
}

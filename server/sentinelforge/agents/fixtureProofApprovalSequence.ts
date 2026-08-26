import { parseTrueForgeProviderApprovalPauseEvent } from "../liveContracts";
import { FIXTURE_GITHUB_PR_GATE_TOOL_NAME } from "./fixtureProofApproval";
import type { TrueForgeStreamEvent } from "../trueforge/stream";

type ExpectedRead = { path: "package.json" | "release-manifest.json"; expectedVersion: "1.4.0" | "1.3.0" };
type ModelToolCall = { name: string; server: string | null; callId: string; eventId: string; turnId: string; threadId: string | null; eventIndex: number; arguments: Record<string, unknown> };

const expectedReads: readonly ExpectedRead[] = [
  { path: "package.json", expectedVersion: "1.4.0" },
  { path: "release-manifest.json", expectedVersion: "1.3.0" },
];

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

function assertReadCall(call: ModelToolCall, expected: ExpectedRead, toolsMcpName: string) {
  if (call.name !== "get_file" || call.server !== toolsMcpName || call.arguments.owner !== "Aayushashsahu" || call.arguments.repo !== "sentinelforge-incident-fixture" || call.arguments.ref !== "main" || call.arguments.path !== expected.path) {
    throw new Error(`Fixture proof approval capture requires an exact successful get_file(${expected.path}) call for the allowlisted target on main.`);
  }
}

function assertSuccessfulReadResponse(events: readonly TrueForgeStreamEvent[], call: ModelToolCall, expected: ExpectedRead) {
  const response = events.slice(call.eventIndex + 1).find(event => {
    const data = dataRecord(event);
    return data.type === "tool.response" && data.tool_call_id === call.callId && data.turn_id === call.turnId && data.thread_id === call.threadId && typeof data.content === "string";
  });
  const content = response ? dataRecord(response).content : null;
  const expectedHeader = `Repository: Aayushashsahu/sentinelforge-incident-fixture\nPath: ${expected.path}\nRef: main`;
  const versionPattern = new RegExp(`"version"\\s*:\\s*"${expected.expectedVersion.replaceAll(".", "\\.")}"`);
  if (typeof content !== "string" || !content.includes(expectedHeader) || !versionPattern.test(content)) {
    throw new Error(`Fixture proof approval capture requires a successful allowlisted ${expected.path} body containing version ${expected.expectedVersion}.`);
  }
}

export function validateFixtureProofApprovalCaptureSequence(events: readonly TrueForgeStreamEvent[], toolsMcpName: string) {
  const orderedCalls = events.flatMap((event, eventIndex) => extractModelToolCalls(event, eventIndex));
  if (orderedCalls.length !== 3) throw new Error("Fixture proof approval capture requires exactly two file reads and one fixture gate call.");
  const [packageCall, manifestCall, gateCall] = orderedCalls;
  if (!packageCall || !manifestCall || !gateCall) throw new Error("Fixture proof approval capture has an incomplete required sequence.");
  assertReadCall(packageCall, expectedReads[0]!, toolsMcpName);
  assertReadCall(manifestCall, expectedReads[1]!, toolsMcpName);
  assertSuccessfulReadResponse(events, packageCall, expectedReads[0]!);
  assertSuccessfulReadResponse(events, manifestCall, expectedReads[1]!);
  if (gateCall.name !== FIXTURE_GITHUB_PR_GATE_TOOL_NAME || gateCall.server !== toolsMcpName || Object.keys(gateCall.arguments).length !== 0 || gateCall.turnId !== packageCall.turnId || gateCall.turnId !== manifestCall.turnId || gateCall.threadId !== packageCall.threadId || gateCall.threadId !== manifestCall.threadId) {
    throw new Error("Fixture proof approval capture requires the exact non-mutating fixture gate after the two same-turn allowlisted reads.");
  }
  const pauseIndex = events.findIndex(event => parseTrueForgeProviderApprovalPauseEvent(event.data) !== null);
  const pause = pauseIndex >= 0 ? parseTrueForgeProviderApprovalPauseEvent(events[pauseIndex]!.data) : null;
  if (!pause || pauseIndex <= gateCall.eventIndex || pause.thread_id !== gateCall.threadId || pause.tool_calls.length !== 1 || pause.tool_calls[0]!.id !== gateCall.callId || pause.tool_calls[0]!.source_event_id !== gateCall.eventId) {
    throw new Error("Fixture proof approval capture requires a genuine approval pause correlated to the preceding fixture gate call.");
  }
  return { pause, turnId: gateCall.turnId };
}

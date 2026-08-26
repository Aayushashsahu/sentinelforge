import { parseTrueForgeProviderApprovalPauseEvent } from "../liveContracts";
import { FIXTURE_GITHUB_PR_GATE_TOOL_NAME } from "./fixtureProofApproval";
import type { TrueForgeStreamEvent } from "../trueforge/stream";

type ToolCall = { name: string; server: string | null; path: string | null };

function parseArguments(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

function extractToolCalls(events: readonly TrueForgeStreamEvent[]): ToolCall[] {
  return events.flatMap(event => {
    const data = event.data && typeof event.data === "object" && !Array.isArray(event.data) ? event.data as Record<string, unknown> : {};
    if (!Array.isArray(data.tool_calls)) return [];
    return data.tool_calls.flatMap(call => {
      if (!call || typeof call !== "object") return [];
      const record = call as Record<string, unknown>;
      const fn = record.function && typeof record.function === "object" ? record.function as Record<string, unknown> : {};
      const info = record.tool_info && typeof record.tool_info === "object" ? record.tool_info as Record<string, unknown> : {};
      const args = parseArguments(fn.arguments);
      return typeof fn.name === "string" ? [{ name: fn.name, server: typeof info.server_name === "string" ? info.server_name : null, path: typeof args.path === "string" ? args.path : null }] : [];
    });
  });
}

export function validateFixtureProofApprovalCaptureSequence(events: readonly TrueForgeStreamEvent[], toolsMcpName: string) {
  const calls = extractToolCalls(events).filter(call => call.server === toolsMcpName);
  const expected = [
    { name: "get_file", path: "package.json" },
    { name: "get_file", path: "release-manifest.json" },
    { name: FIXTURE_GITHUB_PR_GATE_TOOL_NAME, path: null },
  ];
  if (calls.length !== expected.length || calls.some((call, index) => call.name !== expected[index]?.name || call.path !== expected[index]?.path)) {
    throw new Error("Fixture proof approval capture requires exactly get_file(package.json), get_file(release-manifest.json), then fixture_github_pr_gate.");
  }
  const pause = events.map(event => parseTrueForgeProviderApprovalPauseEvent(event.data)).find((item): item is NonNullable<typeof item> => item !== null);
  if (!pause) throw new Error("Fixture proof approval capture requires a genuine fixture_github_pr_gate tool.approval_required event.");
  const turnId = events.flatMap(event => {
    const data = event.data && typeof event.data === "object" && !Array.isArray(event.data) ? event.data as Record<string, unknown> : {};
    return typeof data.turn_id === "string" && data.turn_id ? [data.turn_id] : [];
  })[0] ?? null;
  if (!turnId) throw new Error("Fixture proof approval capture requires a provider turn identity.");
  return { pause, turnId };
}

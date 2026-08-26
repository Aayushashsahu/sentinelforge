import type { TrueForgeStreamEvent } from "../trueforge/stream";
import { parseTrueForgeProviderApprovalPauseEvent } from "../liveContracts";

type RepairToolCall = { name: string; server: string | null; path: string | null };

function parseArguments(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (!value || typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function extractToolCalls(events: readonly TrueForgeStreamEvent[]): RepairToolCall[] {
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

export function validateRepairApprovalCaptureSequence(events: readonly TrueForgeStreamEvent[], toolsMcpName: string) {
  const calls = extractToolCalls(events).filter(call => call.server === toolsMcpName);
  const expected = [
    { name: "get_file", path: "package.json" },
    { name: "get_file", path: "release-manifest.json" },
    { name: "repair_proposal_gate", path: null },
  ];
  if (calls.length !== expected.length || calls.some((call, index) => call.name !== expected[index]?.name || call.path !== expected[index]?.path)) {
    throw new Error("TrueForge repair approval capture requires exactly get_file(package.json), get_file(release-manifest.json), then repair_proposal_gate.");
  }
  const pause = events.map(event => parseTrueForgeProviderApprovalPauseEvent(event.data)).find((item): item is NonNullable<typeof item> => item !== null);
  if (!pause) throw new Error("TrueForge repair approval capture requires a genuine tool.approval_required provider event after the repair gate.");
  const turnId = events.flatMap(event => {
    const data = event.data && typeof event.data === "object" && !Array.isArray(event.data) ? event.data as Record<string, unknown> : {};
    return typeof data.turn_id === "string" && data.turn_id ? [data.turn_id] : [];
  })[0] ?? null;
  if (!turnId) throw new Error("TrueForge repair approval capture requires a provider turn identity.");
  return { pause, turnId };
}

import { describe, expect, it } from "vitest";
import { getTrueForgeRuntimeConfig, TrueForgeClient } from "./trueforge/client";
import { mapTrueForgeSessionHistory, selectSemanticStreamEventsForAudit } from "./liveWorkflow";

const enabled = process.env.RUN_LIVE_REPAIR_APPROVAL_DIAGNOSTIC === "1";
const sessionId = process.env.TRUEFORGE_DIAGNOSTIC_SESSION_ID ?? "01m0y3xe6jpty90rx60yxpyekh";

function sanitizeEvent(event: ReturnType<typeof mapTrueForgeSessionHistory>[number]) {
  const data = event.data && typeof event.data === "object" && !Array.isArray(event.data) ? event.data as Record<string, unknown> : {};
  const toolCalls = Array.isArray(data.tool_calls) ? data.tool_calls.flatMap(call => {
    if (!call || typeof call !== "object") return [];
    const record = call as Record<string, unknown>;
    const fn = record.function && typeof record.function === "object" ? record.function as Record<string, unknown> : {};
    const toolInfo = record.tool_info && typeof record.tool_info === "object" ? record.tool_info as Record<string, unknown> : {};
    return [{ name: typeof fn.name === "string" ? fn.name : null, provider: typeof toolInfo.type === "string" ? toolInfo.type : null, server: typeof toolInfo.server_name === "string" ? toolInfo.server_name : null }];
  }) : [];
  return { sourceEvent: event.event, type: typeof data.type === "string" ? data.type : null, eventId: typeof data.id === "string" ? data.id : null, turnId: typeof data.turn_id === "string" ? data.turn_id : null, threadId: typeof data.thread_id === "string" ? data.thread_id : null, status: typeof data.status === "string" ? data.status : null, toolCalls };
}

describe.skipIf(!enabled)("failed repair approval capture provider history", () => {
  it("reads the existing session history without creating or continuing a turn", async () => {
    const history = mapTrueForgeSessionHistory(await new TrueForgeClient(getTrueForgeRuntimeConfig()).listSessionEvents(sessionId));
    const summary = selectSemanticStreamEventsForAudit(history).map(sanitizeEvent);
    console.info("REPAIR_APPROVAL_CAPTURE_DIAGNOSTIC", JSON.stringify({ sessionId, eventCount: history.length, events: summary }));
    expect(history.length).toBeGreaterThan(0);
  }, 30_000);
});

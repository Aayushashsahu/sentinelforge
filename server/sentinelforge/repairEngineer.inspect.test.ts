import { describe, expect, it } from "vitest";
import { getMissionBundle } from "./repository";
import { mapTrueForgeSessionHistory } from "./liveWorkflow";
import { getTrueForgeRuntimeConfig, TrueForgeClient } from "./trueforge/client";

const inspectRepairEngineer = process.env.INSPECT_REPAIR_ENGINEER_LIVE === "1";
const missionId = "SF_xF37FKFqr1NvtA";

describe.skipIf(!inspectRepairEngineer)("read-only Repair Engineer post-turn inspection", () => {
  it("reports persisted state and remote MCP call metadata without issuing a turn", async () => {
    const bundle = await getMissionBundle(missionId);
    expect(bundle?.mission.id).toBe(missionId);
    const repairSessions = bundle?.trueforgeSessions.filter((item) => item.status === "REPAIR_PLANNING") ?? [];
    expect(repairSessions).toHaveLength(1);
    const repairSession = repairSessions[0];
    const turns = bundle?.trueforgeTurns.filter((item) => item.trueforgeSessionId === repairSession.sessionId) ?? [];
    expect(turns).toHaveLength(1);

    const history = mapTrueForgeSessionHistory(await new TrueForgeClient(getTrueForgeRuntimeConfig()).listSessionEvents(repairSession.sessionId));
    const toolCalls = history.flatMap((event) => {
      if (!event.data || typeof event.data !== "object" || Array.isArray(event.data)) return [];
      const data = event.data as { tool_calls?: unknown };
      return Array.isArray(data.tool_calls) ? data.tool_calls.flatMap((call) => {
        if (!call || typeof call !== "object") return [];
        const record = call as { function?: { name?: unknown; arguments?: unknown }; tool_info?: { type?: unknown; server_name?: unknown } };
        return [{ name: typeof record.function?.name === "string" ? record.function.name : null, arguments: typeof record.function?.arguments === "string" ? record.function.arguments : null, provider: typeof record.tool_info?.type === "string" ? record.tool_info.type : null, server: typeof record.tool_info?.server_name === "string" ? record.tool_info.server_name : null }];
      }) : [];
    });
    const finalContents = history.flatMap((event) => {
      if (!event.data || typeof event.data !== "object" || Array.isArray(event.data)) return [];
      const content = (event.data as { content?: unknown }).content;
      return typeof content === "string" ? [content] : [];
    });
    console.info("REPAIR_ENGINEER_READ_ONLY_INSPECTION", JSON.stringify({
      missionId,
      missionStatus: bundle?.mission.status,
      repairSessionId: repairSession.sessionId,
      repairTurnId: turns[0]?.turnId,
      toolCalls,
      evidenceKinds: bundle?.evidence.map((item) => item.kind),
      eventTypes: bundle?.events.map((item) => item.eventType),
      approvalCount: bundle?.approvals.length,
      externalActionCount: bundle?.actions.length,
      finalContents,
    }));
    expect(bundle?.approvals).toHaveLength(0);
    expect(bundle?.actions).toHaveLength(0);
  }, 30_000);
});

import { describe, expect, it } from "vitest";
import { getTrueForgeRuntimeConfig, TrueForgeClient } from "./client";

const runHistoryInspection = process.env.RUN_TRUEFORGE_MCP_HISTORY_INSPECTION === "1";
const completedSessionId = "01m0w1wngneqzp1g7ta5r1wr2j";

type ResourceShape = {
  blockType: string;
  resourceKeys: string[];
  textLength: number;
  hasUri: boolean;
};

function collectResourceShapes(value: unknown, shapes: ResourceShape[] = []): ResourceShape[] {
  if (Array.isArray(value)) {
    for (const item of value) collectResourceShapes(item, shapes);
    return shapes;
  }
  if (!value || typeof value !== "object") return shapes;
  const record = value as Record<string, unknown>;
  if ((record.type === "resource" || record.type === "embeddedResource") && record.resource && typeof record.resource === "object") {
    const resource = record.resource as Record<string, unknown>;
    shapes.push({
      blockType: String(record.type),
      resourceKeys: Object.keys(resource).sort(),
      textLength: typeof resource.text === "string" ? resource.text.length : 0,
      hasUri: typeof resource.uri === "string" && resource.uri.length > 0,
    });
  }
  for (const child of Object.values(record)) collectResourceShapes(child, shapes);
  return shapes;
}

function eventTypeSummary(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const record = raw as Record<string, unknown>;
  const events = Array.isArray(record.data) ? record.data : Array.isArray(record.events) ? record.events : Array.isArray(raw) ? raw : [];
  return events
    .map(event => (event && typeof event === "object" ? (event as Record<string, unknown>).type : undefined))
    .filter((type): type is string => typeof type === "string")
    .slice(0, 80);
}

function eventShapeSummary(raw: unknown): Array<{ keys: string[]; type: string | null; dataKeys: string[] }> {
  if (!raw || typeof raw !== "object") return [];
  const record = raw as Record<string, unknown>;
  const events = Array.isArray(record.data) ? record.data : Array.isArray(record.events) ? record.events : Array.isArray(raw) ? raw : [];
  return events.slice(0, 12).flatMap(event => {
    if (!event || typeof event !== "object") return [];
    const eventRecord = event as Record<string, unknown>;
    const data = eventRecord.data;
    return [{
      keys: Object.keys(eventRecord).sort(),
      type: typeof eventRecord.type === "string" ? eventRecord.type : null,
      dataKeys: data && typeof data === "object" && !Array.isArray(data) ? Object.keys(data as Record<string, unknown>).sort() : [],
    }];
  });
}

describe.skipIf(!runHistoryInspection)("completed TrueForge MCP resource session history", () => {
  it("inspects the completed session read-only without creating another turn", async () => {
    const raw = await new TrueForgeClient(getTrueForgeRuntimeConfig()).listSessionEvents(completedSessionId);
    const resourceShapes = collectResourceShapes(raw);
    console.info(JSON.stringify({
      sessionId: completedSessionId,
      topLevelKind: Array.isArray(raw) ? "array" : typeof raw,
      topLevelKeys: raw && typeof raw === "object" && !Array.isArray(raw) ? Object.keys(raw as Record<string, unknown>).sort() : [],
      eventTypes: eventTypeSummary(raw),
      eventShapes: eventShapeSummary(raw),
      resourceBlocks: resourceShapes.length,
      resourceShapes,
      serializedLength: JSON.stringify(raw).length,
    }));
    expect(JSON.stringify(raw).length).toBeGreaterThan(2);
  }, 20_000);
});

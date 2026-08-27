import { describe, expect, it } from "vitest";
import { buildFixtureProviderHistoryAuditInputs, normalizeFixtureProviderHistory } from "./fixtureProviderHistoryNormalization";
import type { TrueForgeStreamEvent } from "./trueforge/stream";
import { mapTrueForgeSessionHistory } from "./liveWorkflow";

const sessionId = "session_expected";
const turnId = "turn_expected";

function event(data: Record<string, unknown>, envelope: Record<string, string> = { sessionId, turnId }): TrueForgeStreamEvent {
  return { event: String(data.type ?? "message"), data, historyEnvelope: envelope };
}

describe("fixture provider-history normalization", () => {
  it("inherits only documented session-history-envelope turn context and capture-session context", () => {
    const normalized = normalizeFixtureProviderHistory({ events: [event({ type: "turn.done", id: "done" })], sessionId });
    expect(normalized[0]?.data).toEqual({ type: "turn.done", id: "done" });
    expect(normalized[0]?.normalizedData).toMatchObject({ session_id: sessionId, turn_id: turnId });
    expect(normalized[0]?.normalizedCorrelation).toEqual({ sessionId: "capture_session_context", turnId: "session_history_envelope", threadId: "unavailable" });
  });

  it("preserves raw event correlation when present", () => {
    const normalized = normalizeFixtureProviderHistory({ events: [event({ type: "model.message", id: "gate", session_id: sessionId, turn_id: turnId, thread_id: "main" })], sessionId });
    expect(normalized[0]?.normalizedCorrelation).toEqual({ sessionId: "raw_event", turnId: "raw_event", threadId: "raw_event" });
  });

  it("models the observed session-history envelope and propagates only its documented turn context", () => {
    const history = mapTrueForgeSessionHistory({ data: [
      { turn_id: turnId, event: { type: "turn.created", id: "created", turn_id: turnId } },
      { turn_id: turnId, event: { type: "mcp.initialize", id: "initialize", thread_id: "main", mcp_servers: [{ id: "mcp", name: "sentinelforge-tools" }] } },
      { turn_id: turnId, event: { type: "model.message", id: "gate", thread_id: "main", tool_calls: [{ id: "call_gate", function: { name: "fixture_github_pr_gate", arguments: "{}" }, tool_info: { type: "mcp", server_name: "sentinelforge-tools" } }] } },
      { turn_id: turnId, event: { type: "tool.approval_required", id: "required", created_at: "2026-08-27T00:00:00.000Z", thread_id: "main", tool_calls: [{ id: "call_gate", source_event_id: "gate" }] } },
      { turn_id: turnId, event: { type: "turn.done", id: "done", state: "completed" } },
    ] }, { sessionId });
    const normalized = normalizeFixtureProviderHistory({ events: history, sessionId });
    expect(normalized.map(item => item.normalizedData.turn_id)).toEqual([turnId, turnId, turnId, turnId, turnId]);
    expect(normalized[1]?.data).toMatchObject({ type: "mcp.initialize", thread_id: "main", mcp_servers: [{ name: "sentinelforge-tools" }] });
    expect(normalized[1]?.normalizedCorrelation.turnId).toBe("session_history_envelope");
  });

  it.each([
    ["absent envelope turn", event({ type: "turn.done", id: "done" }, { sessionId })],
    ["mismatched envelope session", event({ type: "turn.done", id: "done" }, { sessionId: "other", turnId })],
    ["mismatched raw and envelope turn", event({ type: "turn.done", id: "done", turn_id: "other" })],
  ])("fails closed for %s", (_label, source) => {
    expect(() => normalizeFixtureProviderHistory({ events: [source], sessionId })).toThrow(/PROVIDER_CORRELATION_UNAVAILABLE/);
  });

  it("records raw and normalized provider event audit rows separately with provenance", () => {
    const raw = [event({ type: "turn.done", id: "done" })];
    const normalized = normalizeFixtureProviderHistory({ events: raw, sessionId });
    const rows = buildFixtureProviderHistoryAuditInputs({ missionId: "SF_fixture", turnId, rawEvents: raw, normalizedEvents: normalized });
    expect(rows.map(row => row.eventType)).toEqual(["RAW_PROVIDER_EVENT", "NORMALIZED_PROVIDER_EVENT"]);
    expect(rows[0]?.payload).toMatchObject({ rawTurnId: null, historyEnvelope: { sessionId, turnId } });
    expect(rows[1]?.payload).toMatchObject({ correlationProvenance: { turnId: "session_history_envelope" } });
  });
});

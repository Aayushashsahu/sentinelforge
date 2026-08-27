import type { TrueForgeStreamEvent } from "./trueforge/stream";

export type FixtureProviderCorrelationProvenance = {
  sessionId: "raw_event" | "capture_session_context";
  turnId: "raw_event" | "session_history_envelope" | "unavailable";
  threadId: "raw_event" | "unavailable";
};

export type NormalizedFixtureProviderEvent = TrueForgeStreamEvent & {
  normalizedData: Record<string, unknown>;
  normalizedCorrelation: FixtureProviderCorrelationProvenance;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function nonBlank(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizedData(event: TrueForgeStreamEvent, expectedSessionId: string): { data: Record<string, unknown>; provenance: FixtureProviderCorrelationProvenance } {
  const raw = record(event.data);
  const rawSessionId = nonBlank(raw.session_id);
  const envelopeSessionId = nonBlank(event.historyEnvelope?.sessionId);
  if (rawSessionId && rawSessionId !== expectedSessionId) throw new Error("PROVIDER_CORRELATION_UNAVAILABLE: raw event session ID differs from the capture session.");
  if (envelopeSessionId && envelopeSessionId !== expectedSessionId) throw new Error("PROVIDER_CORRELATION_UNAVAILABLE: session-history envelope session ID differs from the capture session.");
  const rawTurnId = nonBlank(raw.turn_id);
  const envelopeTurnId = nonBlank(event.historyEnvelope?.turnId);
  if (rawTurnId && envelopeTurnId && rawTurnId !== envelopeTurnId) throw new Error("PROVIDER_CORRELATION_UNAVAILABLE: raw event turn ID differs from the session-history envelope turn ID.");
  const turnId = rawTurnId ?? envelopeTurnId;
  if (!turnId) throw new Error("PROVIDER_CORRELATION_UNAVAILABLE: provider event has no raw turn ID and no authoritative session-history-envelope turn ID.");
  const threadId = nonBlank(raw.thread_id);
  return {
    data: { ...raw, session_id: rawSessionId ?? expectedSessionId, ...(turnId ? { turn_id: turnId } : {}) },
    provenance: {
      sessionId: rawSessionId ? "raw_event" : "capture_session_context",
      turnId: rawTurnId ? "raw_event" : envelopeTurnId ? "session_history_envelope" : "unavailable",
      threadId: threadId ? "raw_event" : "unavailable",
    },
  };
}

export function normalizeFixtureProviderHistory(input: { events: readonly TrueForgeStreamEvent[]; sessionId: string }): NormalizedFixtureProviderEvent[] {
  if (!input.sessionId.trim()) throw new Error("PROVIDER_CORRELATION_UNAVAILABLE: capture session ID is blank.");
  return input.events.map(event => {
    const normalized = normalizedData(event, input.sessionId);
    return { event: event.event, data: event.data, ...(event.historyEnvelope ? { historyEnvelope: event.historyEnvelope } : {}), normalizedData: normalized.data, normalizedCorrelation: normalized.provenance };
  });
}

export function normalizedFixtureProviderEventData(event: TrueForgeStreamEvent): Record<string, unknown> {
  const candidate = event as Partial<NormalizedFixtureProviderEvent>;
  return candidate.normalizedData ?? record(event.data);
}

function sanitizeEvent(event: TrueForgeStreamEvent, normalized = false) {
  const data = normalized ? normalizedFixtureProviderEventData(event) : record(event.data);
  const calls = Array.isArray(data.tool_calls) ? data.tool_calls.flatMap(value => {
    const call = record(value);
    const fn = record(call.function);
    return [{ toolCallId: nonBlank(call.id), toolName: nonBlank(fn.name), sourceEventId: nonBlank(call.source_event_id) }];
  }) : [];
  return {
    providerType: nonBlank(data.type) ?? event.event,
    providerEventId: nonBlank(data.id),
    rawSessionId: nonBlank(data.session_id),
    rawTurnId: nonBlank(data.turn_id),
    rawThreadId: nonBlank(data.thread_id),
    historyEnvelope: event.historyEnvelope ?? null,
    toolCalls: calls,
  };
}

export function buildFixtureProviderHistoryAuditInputs(input: { missionId: string; turnId: string; rawEvents: readonly TrueForgeStreamEvent[]; normalizedEvents: readonly NormalizedFixtureProviderEvent[] }) {
  const raw = input.rawEvents.map((event, index) => ({
    missionId: input.missionId,
    eventType: "RAW_PROVIDER_EVENT",
    actor: "TrueForge",
    correlationId: input.turnId,
    result: "Observed raw provider-history event before correlation normalization.",
    payload: { index, ...sanitizeEvent(event) },
  }));
  const normalized = input.normalizedEvents.map((event, index) => ({
    missionId: input.missionId,
    eventType: "NORMALIZED_PROVIDER_EVENT",
    actor: "SentinelForge",
    correlationId: input.turnId,
    result: "Normalized provider-history event using only authoritative raw, session-route, or session-history-envelope correlation context.",
    payload: { index, ...sanitizeEvent(event, true), correlationProvenance: event.normalizedCorrelation },
  }));
  return [...raw, ...normalized];
}

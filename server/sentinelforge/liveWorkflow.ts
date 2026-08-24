import type { Risk } from "../../shared/sentinelforge";
import { buildReadOnlyInvestigatorSpec, parseInvestigatorResult } from "./agents/investigator";
import { buildSandboxProbeSpec } from "./agents/sandboxProbe";
import { addEvidence, addSandboxRun, appendMissionEvent, createMission, getMissionBundle, getTrueForgeSessionByMission, getTrueForgeTurnByMission, linkTrueForgeSession, recordTrueForgeTurn, setMissionStatus } from "./repository";
import { getTrueForgeRuntimeConfig, TrueForgeClient } from "./trueforge/client";
import { readTrueForgeSse, type TrueForgeStreamEvent } from "./trueforge/stream";

function findFirstString(value: unknown, keys: readonly string[]): string | null {
  if (Array.isArray(value)) {
    for (const item of value) { const found = findFirstString(item, keys); if (found) return found; }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  for (const [key, item] of Object.entries(value)) {
    if (keys.includes(key) && typeof item === "string" && item.length > 0) return item;
    const found = findFirstString(item, keys); if (found) return found;
  }
  return null;
}

function sanitizeLiveProviderError(error: unknown): string {
  const message = error instanceof Error ? error.message : "TrueForge live-provider operation failed.";
  return message
    .replace(/https?:\/\/[^\s,\])]+/g, "[REDACTED_URL]")
    .replace(/params:\s*[\s\S]*/i, "params: [REDACTED]");
}

function sanitizeStreamMetadata(event: TrueForgeStreamEvent) {
  const data = event.data && typeof event.data === "object" && !Array.isArray(event.data) ? event.data as Record<string, unknown> : {};
  const eventType = typeof data.type === "string" ? data.type : null;
  const toolCalls = Array.isArray(data.tool_calls) ? data.tool_calls.flatMap(call => {
    if (!call || typeof call !== "object") return [];
    const record = call as Record<string, unknown>;
    const functionRecord = record.function && typeof record.function === "object" ? record.function as Record<string, unknown> : {};
    const toolInfo = record.tool_info && typeof record.tool_info === "object" ? record.tool_info as Record<string, unknown> : {};
    return [{ name: typeof functionRecord.name === "string" ? functionRecord.name : null, provider: typeof toolInfo.type === "string" ? toolInfo.type : null, server: typeof toolInfo.server_name === "string" ? toolInfo.server_name : null }];
  }) : [];
  return {
    sourceEvent: event.event,
    remoteType: eventType,
    remoteEventId: typeof data.id === "string" ? data.id : null,
    turnId: typeof data.turn_id === "string" ? data.turn_id : null,
    threadId: typeof data.thread_id === "string" ? data.thread_id : null,
    toolCalls,
  };
}

export function containsGithubMcpToolEvent(events: readonly TrueForgeStreamEvent[], githubMcpName: string): boolean {
  return events.some(event => {
    const metadata = sanitizeStreamMetadata(event);
    return metadata.toolCalls.some(tool => tool.provider === "mcp" && tool.server === githubMcpName && Boolean(tool.name));
  });
}

export function mapTrueForgeSessionHistory(payload: unknown): TrueForgeStreamEvent[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { data?: unknown }).data)) throw new Error("TrueForge session event history was malformed.");
  return (payload as { data: unknown[] }).data.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const record = item as { event?: unknown };
    if (!record.event || typeof record.event !== "object") return [];
    const event = record.event as Record<string, unknown>;
    return [{ event: typeof event.type === "string" ? event.type : "message", data: event }];
  });
}

async function ingestCompletedInvestigation(input: { missionId: string; sessionId: string; streamEvents: TrueForgeStreamEvent[] }) {
  const turnId = findFirstString(input.streamEvents.map(event => event.data), ["turn_id", "turnId"]);
  if (!turnId) throw new Error("TrueForge streamed no identifiable turn ID.");
  const existingTurn = await getTrueForgeTurnByMission(input.missionId);
  const threadId = findFirstString(input.streamEvents, ["thread_id", "threadId"]);
  if (!existingTurn) {
    await recordTrueForgeTurn({ missionId: input.missionId, trueforgeSessionId: input.sessionId, turnId, status: "COMPLETED", ...(threadId ? { threadId } : {}) });
    await appendMissionEvent({ missionId: input.missionId, eventType: "TURN_CREATED", actor: "TrueForge", correlationId: turnId, result: "TrueForge Investigator turn completed and its event stream was captured.", payload: { streamEventCount: input.streamEvents.length } });
    for (const event of input.streamEvents) {
      await appendMissionEvent({ missionId: input.missionId, eventType: "TRUEFORGE_STREAM_EVENT", actor: "TrueForge", correlationId: turnId, result: `Observed TrueForge stream event: ${event.event}.`, payload: sanitizeStreamMetadata(event) });
    }
  }
  if (!containsGithubMcpToolEvent(input.streamEvents, getTrueForgeRuntimeConfig().githubMcpName)) throw new Error("Investigator stream contained no actual GitHub MCP tool call; refusing to treat model text as evidence-backed.");
  const result = parseInvestigatorResult(input.streamEvents.map(event => event.data));
  const observedEvidence = await Promise.all(result.evidence.map(item => addEvidence({ missionId: input.missionId, kind: "OBSERVED", title: "GitHub MCP observation", content: item.detail, source: item.source })));
  const inference = await addEvidence({ missionId: input.missionId, kind: "INFERENCE", title: "Investigator root-cause inference", content: result.root_cause, source: "trueforge/investigator" });
  await appendMissionEvent({ missionId: input.missionId, eventType: "MCP_CALL_COMPLETED", actor: "Investigator", correlationId: turnId, tool: `mcp:${getTrueForgeRuntimeConfig().githubMcpName}`, result: "Read-only GitHub MCP-backed evidence was returned by the Investigator.", evidenceRefs: observedEvidence.map(item => item.id) });
  await appendMissionEvent({ missionId: input.missionId, eventType: "ROOT_CAUSE_IDENTIFIED", actor: "Investigator", correlationId: turnId, result: result.root_cause, payload: { confidence: result.confidence, recommendedNextStep: result.recommended_next_step }, evidenceRefs: [...observedEvidence.map(item => item.id), inference.id] });
  await setMissionStatus(input.missionId, "PLANNING_FIX", { rootCause: result.root_cause });
  return getMissionBundle(input.missionId);
}

export async function createLiveMission(input: { title: string; repository: string; incident: string; risk: Risk }) {
  const config = getTrueForgeRuntimeConfig();
  if (!config.model) throw new Error("TRUEFORGE_MODEL is not configured.");
  if (!config.githubMcpName) throw new Error("TRUEFORGE_GITHUB_MCP_NAME is not configured.");

  const mission = await createMission({ ...input, mode: "LIVE" });
  const client = new TrueForgeClient(config);
  try {
    const resolvedModel = await client.resolveModelName(config.model);
    const session = await client.createInlineSession(buildReadOnlyInvestigatorSpec({ model: resolvedModel, githubMcpName: config.githubMcpName }));
    await linkTrueForgeSession({ missionId: mission.id, sessionId: session.id, baseUrl: config.baseUrl, model: resolvedModel, status: "CREATED" });
    await appendMissionEvent({ missionId: mission.id, eventType: "TRUEFORGE_SESSION_CREATED", actor: "TrueForge", correlationId: session.id, result: "Live TrueForge session created with the read-only GitHub MCP policy.", payload: { model: resolvedModel, mcpServer: config.githubMcpName, sandbox: "disabled" } });
    return getMissionBundle(mission.id);
  } catch (error) {
    await setMissionStatus(mission.id, "FAILED");
    await appendMissionEvent({ missionId: mission.id, eventType: "MISSION_FAILED", actor: "TrueForge", result: error instanceof Error ? error.message : "TrueForge session creation failed." });
    throw error;
  }
}

export async function investigateLiveMission(missionId: string) {
  const session = await getTrueForgeSessionByMission(missionId);
  if (!session) throw new Error("Live TrueForge session is not linked to this mission.");
  const bundle = await getMissionBundle(missionId);
  if (!bundle) throw new Error("Mission was not found.");
  if (bundle.mission.status !== "CREATED") throw new Error("Live investigation can start only from a newly created mission.");

  await setMissionStatus(missionId, "INVESTIGATING");
  await appendMissionEvent({ missionId, eventType: "AGENT_STARTED", actor: "Investigator", correlationId: session.sessionId, tool: `mcp:${getTrueForgeRuntimeConfig().githubMcpName}`, result: "Read-only Investigator turn started. GitHub writes and sandbox execution are disabled." });
  try {
    const client = new TrueForgeClient(getTrueForgeRuntimeConfig());
    const response = await client.createTurnStream({
      sessionId: session.sessionId,
      previousTurnId: "none",
      input: [{ type: "user.message", content: `Investigate this engineering incident in repository ${bundle.mission.repository}: ${bundle.mission.incident} First invoke the GitHub MCP tool get_file_contents with owner "Aayushashsahu", repo "sentinelforge", and path "README.md". Do not return a response until that tool result is available. Then inspect CI workflow files only if needed, and return the required JSON.` }],
    });
    const streamEvents = await readTrueForgeSse(response);
    return await ingestCompletedInvestigation({ missionId, sessionId: session.sessionId, streamEvents });
  } catch (error) {
    await setMissionStatus(missionId, "FAILED");
    await appendMissionEvent({ missionId, eventType: "MISSION_FAILED", actor: "Investigator", correlationId: session.sessionId, result: error instanceof Error ? error.message : "Live investigation failed." });
    throw error;
  }
}

export async function reconcileLiveInvestigation(missionId: string) {
  const session = await getTrueForgeSessionByMission(missionId);
  const bundle = await getMissionBundle(missionId);
  if (!session || !bundle) throw new Error("Live TrueForge mission was not found.");
  if (bundle.mission.status !== "INVESTIGATING") throw new Error("Only an in-progress live investigation can be reconciled.");
  try {
    const payload = await new TrueForgeClient(getTrueForgeRuntimeConfig()).listSessionEvents(session.sessionId);
    return await ingestCompletedInvestigation({ missionId, sessionId: session.sessionId, streamEvents: mapTrueForgeSessionHistory(payload) });
  } catch (error) {
    await setMissionStatus(missionId, "FAILED");
    await appendMissionEvent({ missionId, eventType: "MISSION_FAILED", actor: "Investigator", correlationId: session.sessionId, result: error instanceof Error ? error.message : "Live investigation reconciliation failed." });
    throw error;
  }
}

export async function runLiveSandboxProbe(missionId: string) {
  const bundle = await getMissionBundle(missionId);
  if (!bundle) throw new Error("Mission was not found.");
  const config = getTrueForgeRuntimeConfig();
  const client = new TrueForgeClient(config);
  const resolvedModel = await client.resolveModelName(config.model);
  try {
    const session = await client.createInlineSession(buildSandboxProbeSpec(resolvedModel));
    await linkTrueForgeSession({ missionId, sessionId: session.id, baseUrl: config.baseUrl, model: resolvedModel, status: "SANDBOX_PROBE" });
    await appendMissionEvent({ missionId, eventType: "TRUEFORGE_SANDBOX_PROBE_SESSION_CREATED", actor: "TrueForge", correlationId: session.id, result: "Dedicated bounded sandbox capability probe session created. GitHub MCP is not attached.", payload: { sandbox: "enabled", command: "printf sentinel-forge-sandbox-ok" } });
    const response = await client.createTurnStream({ sessionId: session.id, previousTurnId: "none", input: [{ type: "user.message", content: "Use the sandbox now to run exactly: printf sentinel-forge-sandbox-ok" }] });
    const events = await readTrueForgeSse(response);
    const turnId = findFirstString(events.map(event => event.data), ["turn_id", "turnId"]);
    if (!turnId) throw new Error("TrueForge sandbox probe streamed no identifiable turn ID.");
    await recordTrueForgeTurn({ missionId, trueforgeSessionId: session.id, turnId, status: "COMPLETED" });
    const eventTypes = events.map(event => sanitizeStreamMetadata(event).remoteType ?? event.event);
    const sandboxObserved = eventTypes.some(type => type.toLowerCase().includes("sandbox"));
    const result = await addSandboxRun({ missionId, status: sandboxObserved ? "PASS" : "UNKNOWN", runner: "trueforge-sandbox", command: "printf sentinel-forge-sandbox-ok", stdout: sandboxObserved ? "TrueForge emitted a sandbox lifecycle event for the harmless probe command." : `No sandbox lifecycle event was observed. Event types: ${eventTypes.join(", ")}`, stderr: "", exitCode: sandboxObserved ? 0 : 2, durationMs: 0, timedOut: false });
    await appendMissionEvent({ missionId, eventType: sandboxObserved ? "SANDBOX_VERIFICATION_COMPLETED" : "SANDBOX_UNAVAILABLE", actor: "TrueForge", correlationId: turnId, result: sandboxObserved ? "TrueForge sandbox capability was observed for the harmless probe." : "TrueForge completed the probe turn without a sandbox lifecycle event; sandbox capability remains unavailable or unverified.", payload: { eventTypes, sandboxRunId: result.id } });
    return getMissionBundle(missionId);
  } catch (error) {
    const detail = sanitizeLiveProviderError(error);
    const result = await addSandboxRun({ missionId, status: "UNKNOWN", runner: "trueforge-sandbox", command: "printf sentinel-forge-sandbox-ok", stdout: "", stderr: detail, exitCode: 2, durationMs: 0, timedOut: false });
    await appendMissionEvent({ missionId, eventType: "SANDBOX_UNAVAILABLE", actor: "TrueForge", result: detail, payload: { sandboxRunId: result.id } });
    return getMissionBundle(missionId);
  }
}

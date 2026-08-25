import type { Risk } from "../../shared/sentinelforge";
import { buildReadOnlyInvestigatorSpec, parseInvestigatorResult } from "./agents/investigator";
import { buildReadOnlyRepairEngineerSpec, parseRepairEngineerOutcome } from "./agents/repairEngineer";
import { buildSandboxProbeSpec } from "./agents/sandboxProbe";
import { APPROVAL_PROBE_TOOL_NAME, buildApprovalProbeMessage, buildApprovalProbeSpec } from "./agents/approvalProbe";
import { parseTrueForgeProviderApprovalPauseEvent } from "./liveContracts";
import { addEvidence, addSandboxRun, appendMissionEvent, appendMissionEvents, createMission, getMissionBundle, getTrueForgeSessionByMission, getTrueForgeTurnByMission, linkTrueForgeSession, recordTrueForgeTurn, recoverPlanningMissionAfterRepairParsingFailure, setMissionPlanningArtifacts, setMissionStatus } from "./repository";
import { getTrueForgeRuntimeConfig, TrueForgeClient } from "./trueforge/client";
import { readTrueForgeSse, TrueForgeSseAbortedError, type TrueForgeStreamEvent } from "./trueforge/stream";

const LIVE_TURN_TIMEOUT_MS = 75_000;

class LiveTurnPendingError extends Error {
  constructor() { super("TrueForge turn is still running after the bounded stream timeout; mission remains pending reconciliation."); }
}

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

export function buildIncidentInvestigationMessage(input: { repository: string; incident: string }): string {
  const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(input.repository.trim());
  if (!match) throw new Error("Live investigation requires a GitHub repository in owner/repository form.");
  const [, owner, repo] = match;
  const paths = repo === "sentinelforge"
    ? ["README.md", "server/sentinelforge/workflow.ts", "package.json"]
    : ["package.json", "release-manifest.json", "test.js", ".github/workflows/test.yml"];
  return [
    `Investigate this engineering incident in repository ${owner}/${repo}: ${input.incident}`,
    `Use sentinelforge-tools get_file to inspect, in order, ${paths.join(", ")} with owner "${owner}", repo "${repo}", and ref "main".`,
    "Use get_repository and get_workflow_run only when their direct evidence is needed.",
    "Do not return a response until ordinary MCP text contains actual non-empty file bodies. Do not treat SHA, URL, filename, metadata, or an error string as file content.",
    "Return the required JSON only after identifying evidence-backed root cause and recommended next step.",
  ].join(" ");
}

export function buildRepairEngineerMessage(input: { repository: string; incident: string; rootCause: string | null }): string {
  const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(input.repository.trim());
  if (!match) throw new Error("Live repair planning requires a GitHub repository in owner/repository form.");
  const [, owner, repo] = match;
  return [
    `Produce a proposal only for repository ${owner}/${repo}. The mission incident is: ${input.incident}`,
    `The prior Investigator finding is: ${input.rootCause ?? "No root cause was persisted."}`,
    `Use only the exact owner "${owner}" and repo "${repo}"; do not substitute, autocomplete, or search for a different repository name.`,
    "Use sentinelforge-tools read-only calls before proposing a patch. If file contents remain unavailable, include that exact limitation in evidence_limitations.",
    "For the release-manifest mismatch fixture, propose only the smallest release-manifest version alignment diff when the available incident evidence supports it.",
    "Do not apply the patch, run a sandbox, create a branch, commit, pull request, or any GitHub write. Return the required JSON proposal only.",
  ].join(" ");
}

export function findTrueForgeApprovalProbePause(events: readonly TrueForgeStreamEvent[]) {
  for (const event of events) {
    const pause = parseTrueForgeProviderApprovalPauseEvent(event.data);
    if (pause) return pause;
  }
  return null;
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

export function selectSemanticStreamEventsForAudit(events: readonly TrueForgeStreamEvent[]): TrueForgeStreamEvent[] {
  return events.filter(event => sanitizeStreamMetadata(event).remoteType !== "model.message.delta");
}

export function buildStreamAuditInputs(input: { missionId: string; turnId: string; events: readonly TrueForgeStreamEvent[] }) {
  return selectSemanticStreamEventsForAudit(input.events).map(event => ({
    missionId: input.missionId,
    eventType: "TRUEFORGE_STREAM_EVENT",
    actor: "TrueForge",
    correlationId: input.turnId,
    result: `Observed TrueForge stream event: ${event.event}.`,
    payload: sanitizeStreamMetadata(event),
  }));
}

export function containsMcpToolEvent(events: readonly TrueForgeStreamEvent[], mcpName: string): boolean {
  return events.some(event => {
    const metadata = sanitizeStreamMetadata(event);
    return metadata.toolCalls.some(tool => tool.provider === "mcp" && tool.server === mcpName && Boolean(tool.name));
  });
}

function containsNamedMcpToolEvent(events: readonly TrueForgeStreamEvent[], mcpName: string, toolName: string): boolean {
  return events.some(event => {
    const metadata = sanitizeStreamMetadata(event);
    return metadata.toolCalls.some(tool => tool.provider === "mcp" && tool.server === mcpName && tool.name === toolName);
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

function hasTerminalTurn(events: readonly TrueForgeStreamEvent[]): boolean {
  return events.some(event => event.event === "turn.done" || (event.data !== null && typeof event.data === "object" && !Array.isArray(event.data) && (event.data as Record<string, unknown>).type === "turn.done"));
}

async function readBoundedTurn(input: { client: TrueForgeClient; sessionId: string; message: string }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LIVE_TURN_TIMEOUT_MS);
  try {
    const response = await input.client.createTurnStream({ sessionId: input.sessionId, previousTurnId: "none", input: [{ type: "user.message", content: input.message }], signal: controller.signal });
    return await readTrueForgeSse(response, controller.signal);
  } catch (error) {
    if (!(error instanceof TrueForgeSseAbortedError) && !controller.signal.aborted) throw error;
    const history = mapTrueForgeSessionHistory(await input.client.listSessionEvents(input.sessionId));
    if (hasTerminalTurn(history)) return history;
    throw new LiveTurnPendingError();
  } finally {
    clearTimeout(timeout);
  }
}

async function ingestCompletedInvestigation(input: { missionId: string; sessionId: string; streamEvents: TrueForgeStreamEvent[] }) {
  const turnId = findFirstString(input.streamEvents.map(event => event.data), ["turn_id", "turnId"]);
  if (!turnId) throw new Error("TrueForge streamed no identifiable turn ID.");
  const existingTurn = await getTrueForgeTurnByMission(input.missionId);
  const threadId = findFirstString(input.streamEvents, ["thread_id", "threadId"]);
  if (!existingTurn) {
    await recordTrueForgeTurn({ missionId: input.missionId, trueforgeSessionId: input.sessionId, turnId, status: "COMPLETED", ...(threadId ? { threadId } : {}) });
    const semanticEvents = selectSemanticStreamEventsForAudit(input.streamEvents);
    await appendMissionEvent({ missionId: input.missionId, eventType: "TURN_CREATED", actor: "TrueForge", correlationId: turnId, result: "TrueForge Investigator turn completed and its event stream was captured.", payload: { streamEventCount: input.streamEvents.length, persistedSemanticEventCount: semanticEvents.length } });
    await appendMissionEvents(buildStreamAuditInputs({ missionId: input.missionId, turnId, events: input.streamEvents }));
  }
  if (!containsMcpToolEvent(input.streamEvents, getTrueForgeRuntimeConfig().toolsMcpName)) throw new Error("Investigator stream contained no actual sentinelforge-tools MCP call; refusing to treat model text as evidence-backed.");
  const result = parseInvestigatorResult(input.streamEvents.map(event => event.data));
  const observedEvidence = await Promise.all(result.evidence.map(item => addEvidence({ missionId: input.missionId, kind: "OBSERVED", title: "GitHub MCP observation", content: item.detail, source: item.source })));
  const inference = await addEvidence({ missionId: input.missionId, kind: "INFERENCE", title: "Investigator root-cause inference", content: result.root_cause, source: "trueforge/investigator" });
  await appendMissionEvent({ missionId: input.missionId, eventType: "MCP_CALL_COMPLETED", actor: "Investigator", correlationId: turnId, tool: `mcp:${getTrueForgeRuntimeConfig().toolsMcpName}`, result: "Read-only sentinelforge-tools evidence was returned by the Investigator.", evidenceRefs: observedEvidence.map(item => item.id) });
  await appendMissionEvent({ missionId: input.missionId, eventType: "ROOT_CAUSE_IDENTIFIED", actor: "Investigator", correlationId: turnId, result: result.root_cause, payload: { confidence: result.confidence, recommendedNextStep: result.recommended_next_step }, evidenceRefs: [...observedEvidence.map(item => item.id), inference.id] });
  await setMissionStatus(input.missionId, "PLANNING_FIX", { rootCause: result.root_cause });
  return getMissionBundle(input.missionId);
}

export async function createLiveMission(input: { title: string; repository: string; incident: string; risk: Risk }) {
  const config = getTrueForgeRuntimeConfig();
  if (!config.model) throw new Error("TRUEFORGE_MODEL is not configured.");
  if (!config.toolsMcpName) throw new Error("TRUEFORGE_SENTINELFORGE_TOOLS_MCP_NAME is not configured.");

  const mission = await createMission({ ...input, mode: "LIVE" });
  const client = new TrueForgeClient(config);
  try {
    const resolvedModel = await client.resolveModelName(config.model);
    const session = await client.createInlineSession(buildReadOnlyInvestigatorSpec({ model: resolvedModel, toolsMcpName: config.toolsMcpName }));
    await linkTrueForgeSession({ missionId: mission.id, sessionId: session.id, baseUrl: config.baseUrl, model: resolvedModel, status: "CREATED" });
    await appendMissionEvent({ missionId: mission.id, eventType: "TRUEFORGE_SESSION_CREATED", actor: "TrueForge", correlationId: session.id, result: "Live TrueForge session created with the read-only sentinelforge-tools MCP policy.", payload: { model: resolvedModel, mcpServer: config.toolsMcpName, sandbox: "disabled" } });
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
  await appendMissionEvent({ missionId, eventType: "AGENT_STARTED", actor: "Investigator", correlationId: session.sessionId, tool: `mcp:${getTrueForgeRuntimeConfig().toolsMcpName}`, result: "Read-only Investigator turn started. GitHub writes and sandbox execution are disabled." });
  try {
    const client = new TrueForgeClient(getTrueForgeRuntimeConfig());
    const streamEvents = await readBoundedTurn({ client, sessionId: session.sessionId, message: buildIncidentInvestigationMessage({ repository: bundle.mission.repository, incident: bundle.mission.incident }) });
    return await ingestCompletedInvestigation({ missionId, sessionId: session.sessionId, streamEvents });
  } catch (error) {
    if (error instanceof LiveTurnPendingError) {
      await appendMissionEvent({ missionId, eventType: "TRUEFORGE_TURN_PENDING", actor: "Investigator", correlationId: session.sessionId, result: error.message });
      return getMissionBundle(missionId);
    }
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

export async function runLiveRepairPlan(missionId: string) {
  const bundle = await getMissionBundle(missionId);
  if (!bundle) throw new Error("Mission was not found.");
  if (bundle.mission.status !== "PLANNING_FIX") throw new Error("Live Repair Engineer can start only from a planning-stage mission.");
  const config = getTrueForgeRuntimeConfig();
  const client = new TrueForgeClient(config);
  const resolvedModel = await client.resolveModelName(config.model);
  const session = await client.createInlineSession(buildReadOnlyRepairEngineerSpec({ model: resolvedModel, toolsMcpName: config.toolsMcpName }));
  await linkTrueForgeSession({ missionId, sessionId: session.id, baseUrl: config.baseUrl, model: resolvedModel, status: "REPAIR_PLANNING" });
  await appendMissionEvent({ missionId, eventType: "TRUEFORGE_REPAIR_SESSION_CREATED", actor: "TrueForge", correlationId: session.id, result: "Separate read-only Repair Engineer session created. No GitHub write or sandbox capability is attached.", payload: { model: resolvedModel, mcpServer: config.toolsMcpName, sandbox: "disabled" } });
  try {
    const events = await readBoundedTurn({ client, sessionId: session.id, message: buildRepairEngineerMessage({ repository: bundle.mission.repository, incident: bundle.mission.incident, rootCause: bundle.mission.rootCause }) });
    const turnId = findFirstString(events.map(event => event.data), ["turn_id", "turnId"]);
    if (!turnId) throw new Error("TrueForge Repair Engineer streamed no identifiable turn ID.");
    const threadId = findFirstString(events, ["thread_id", "threadId"]);
    await recordTrueForgeTurn({ missionId, trueforgeSessionId: session.id, turnId, status: "COMPLETED", ...(threadId ? { threadId } : {}) });
    if (!containsMcpToolEvent(events, config.toolsMcpName)) throw new Error("Repair Engineer stream contained no actual sentinelforge-tools MCP call; refusing to persist a proposal.");
    const outcome = parseRepairEngineerOutcome(events.map(event => event.data));
    if (outcome.kind === "LIMITATION") {
      const limitations = await Promise.all(outcome.limitations.map(detail => addEvidence({ missionId, kind: "REPAIR_LIMITATION", title: "Read-only Repair Engineer limitation", content: detail, source: "trueforge/repair-engineer" })));
      await appendMissionEvent({ missionId, eventType: "REPAIR_LIMITED", actor: "Repair Engineer", correlationId: turnId, tool: `mcp:${config.toolsMcpName}`, result: "Repair Engineer could not create a patch because read-only evidence was incomplete. The mission remains in planning and no external action is permitted.", payload: { summary: outcome.summary }, evidenceRefs: limitations.map(item => item.id) });
      return getMissionBundle(missionId);
    }
    const repair = outcome.proposal;
    const patchEvidence = await addEvidence({ missionId, kind: "PATCH_PROPOSAL", title: "Read-only Repair Engineer proposal", content: repair.patch, source: "trueforge/repair-engineer" });
    const limitationEvidence = await Promise.all(repair.evidence_limitations.map(detail => addEvidence({ missionId, kind: "REPAIR_LIMITATION", title: "Repair evidence limitation", content: detail, source: "trueforge/repair-engineer" })));
    await setMissionPlanningArtifacts(missionId, { repairSummary: repair.summary, patch: repair.patch });
    await appendMissionEvent({ missionId, eventType: "REPAIR_PROPOSED", actor: "Repair Engineer", correlationId: turnId, tool: `mcp:${config.toolsMcpName}`, result: "A read-only patch proposal was persisted. It has not been applied, sandbox-verified, approved, or sent to GitHub.", payload: { filesChanged: repair.files_changed, expectedEffect: repair.expected_effect, risk: repair.risk, evidenceLimitations: repair.evidence_limitations }, evidenceRefs: [patchEvidence.id, ...limitationEvidence.map(item => item.id)] });
    return getMissionBundle(missionId);
  } catch (error) {
    await setMissionStatus(missionId, "FAILED");
    await appendMissionEvent({ missionId, eventType: "MISSION_FAILED", actor: "Repair Engineer", correlationId: session.id, result: error instanceof Error ? error.message : "Live Repair Engineer failed." });
    throw error;
  }
}

export async function recoverCompletedLiveRepairPlan(missionId: string) {
  const bundle = await getMissionBundle(missionId);
  if (!bundle) throw new Error("Mission was not found.");
  if (bundle.events.some(event => event.eventType === "REPAIR_PROPOSED")) return bundle;
  if (bundle.mission.status !== "FAILED") throw new Error("Only a failed Repair Engineer parsing attempt may be recovered.");
  const repairSessions = bundle.trueforgeSessions.filter(session => session.status === "REPAIR_PLANNING");
  if (repairSessions.length !== 1) throw new Error("Repair Engineer recovery requires exactly one persisted repair-planning session.");
  const session = repairSessions[0];
  const events = mapTrueForgeSessionHistory(await new TrueForgeClient(getTrueForgeRuntimeConfig()).listSessionEvents(session.sessionId));
  if (!containsMcpToolEvent(events, getTrueForgeRuntimeConfig().toolsMcpName)) throw new Error("Repair Engineer history contained no sentinelforge-tools MCP call; refusing recovery.");
  const outcome = parseRepairEngineerOutcome(events.map(event => event.data));
  if (outcome.kind !== "PROPOSAL") throw new Error("Repair Engineer history contains an evidence limitation, not a recoverable patch proposal.");
  const turn = bundle.trueforgeTurns.find(item => item.trueforgeSessionId === session.sessionId);
  if (!turn) throw new Error("Repair Engineer recovery requires the completed persisted turn record.");
  const repair = outcome.proposal;
  const patchEvidence = await addEvidence({ missionId, kind: "PATCH_PROPOSAL", title: "Recovered read-only Repair Engineer proposal", content: repair.patch, source: "trueforge/repair-engineer" });
  const limitationEvidence = await Promise.all(repair.evidence_limitations.map(detail => addEvidence({ missionId, kind: "REPAIR_LIMITATION", title: "Repair evidence limitation", content: detail, source: "trueforge/repair-engineer" })));
  await recoverPlanningMissionAfterRepairParsingFailure(missionId, { repairSummary: repair.summary, patch: repair.patch });
  await appendMissionEvent({ missionId, eventType: "REPAIR_PROPOSAL_RECOVERED", actor: "Repair Engineer", correlationId: turn.turnId, tool: `mcp:${getTrueForgeRuntimeConfig().toolsMcpName}`, result: "A completed read-only Repair Engineer turn was recovered from remote session history after safe structured-output normalization. The proposal remains un-applied, unverified, unapproved, and has not been sent to GitHub.", payload: { filesChanged: repair.files_changed, expectedEffect: repair.expected_effect, risk: repair.risk, evidenceLimitations: repair.evidence_limitations }, evidenceRefs: [patchEvidence.id, ...limitationEvidence.map(item => item.id)] });
  return getMissionBundle(missionId);
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
    const events = await readBoundedTurn({ client, sessionId: session.id, message: "Use the sandbox now to run exactly: printf sentinel-forge-sandbox-ok" });
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

export async function runLiveApprovalProbe() {
  const config = getTrueForgeRuntimeConfig();
  const mission = await createMission({
    title: "TrueForge approval mechanism probe",
    repository: "Aayushashsahu/sentinelforge-incident-fixture",
    incident: "Capture one genuine provider approval pause for the harmless approval_probe tool without continuation or execution.",
    risk: "LOW",
    mode: "LIVE",
  });
  const client = new TrueForgeClient(config);
  try {
    const resolvedModel = await client.resolveModelName(config.model);
    const session = await client.createInlineSession(buildApprovalProbeSpec({ model: resolvedModel, toolsMcpName: config.toolsMcpName }));
    await linkTrueForgeSession({ missionId: mission.id, sessionId: session.id, baseUrl: config.baseUrl, model: resolvedModel, status: "APPROVAL_PROBE" });
    await appendMissionEvent({ missionId: mission.id, eventType: "TRUEFORGE_APPROVAL_PROBE_SESSION_CREATED", actor: "TrueForge", correlationId: session.id, tool: `mcp:${config.toolsMcpName}/${APPROVAL_PROBE_TOOL_NAME}`, result: "A dedicated one-tool approval-probe session was created. The probe is non-mutating; sandboxing and all other tools are disabled.", payload: { mcpServer: config.toolsMcpName, tool: APPROVAL_PROBE_TOOL_NAME, sandbox: "disabled", continuation: "forbidden" } });
    const events = await readBoundedTurn({ client, sessionId: session.id, message: buildApprovalProbeMessage() });
    const pause = findTrueForgeApprovalProbePause(events);
    const turnId = findFirstString(events.map(event => event.data), ["turn_id", "turnId"]);
    if (!pause || !turnId || !containsNamedMcpToolEvent(events, config.toolsMcpName, APPROVAL_PROBE_TOOL_NAME)) {
      throw new Error("TrueForge approval probe did not stream the required approval event, turn identity, and approval_probe tool call.");
    }
    const toolCall = pause.tool_calls[0]!;
    await recordTrueForgeTurn({ missionId: mission.id, trueforgeSessionId: session.id, turnId, status: "WAITING_APPROVAL", threadId: pause.thread_id, requiredActionId: pause.id, toolCallId: toolCall.id });
    await appendMissionEvents(buildStreamAuditInputs({ missionId: mission.id, turnId, events }));
    const providerEvent = await addEvidence({ missionId: mission.id, kind: "OBSERVED", title: "TrueForge approval-required provider event", content: "The live runtime emitted tool.approval_required for the non-mutating approval_probe before any continuation or underlying tool execution.", source: "trueforge/approval-probe" });
    await appendMissionEvent({ missionId: mission.id, eventType: "TRUEFORGE_TOOL_APPROVAL_REQUIRED", actor: "TrueForge", correlationId: toolCall.id, tool: `mcp:${config.toolsMcpName}/${APPROVAL_PROBE_TOOL_NAME}`, result: "A genuine TrueForge approval-required event was persisted. The turn is paused; no approval, continuation, sandbox action, GitHub action, or underlying probe execution was sent.", payload: { eventId: pause.id, createdAt: pause.created_at, threadId: pause.thread_id, toolCallId: toolCall.id, sourceEventId: toolCall.source_event_id, eventType: pause.type }, evidenceRefs: [providerEvent.id] });
    return getMissionBundle(mission.id);
  } catch (error) {
    await setMissionStatus(mission.id, "FAILED");
    await appendMissionEvent({ missionId: mission.id, eventType: "APPROVAL_PROBE_FAILED", actor: "TrueForge", result: sanitizeLiveProviderError(error) });
    throw error;
  }
}

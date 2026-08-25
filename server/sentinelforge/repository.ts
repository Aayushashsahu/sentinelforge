import { and, asc, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { approvalRequests, evidence, externalActions, missionEvents, missions, sandboxRuns, trueforgeSessions, trueforgeTurns, type Mission } from "../../drizzle/schema";
import type { MissionStatus, Risk } from "../../shared/sentinelforge";
import { getDb } from "../db";
import { assertAllowedMissionTransition } from "./transitions";
import { createImmutableAuditEvent, nextAuditSequence } from "./audit";

const now = () => Date.now();
const id = (prefix: string) => `${prefix}_${nanoid(14)}`;

export async function appendMissionEvent(input: { missionId: string; eventType: string; actor: string; tool?: string; correlationId?: string; result: string; payload?: unknown; evidenceRefs?: string[] }) {
  const db = await getDb(); if (!db) throw new Error("Database is unavailable.");
  const [latest] = await db.select({ sequence: missionEvents.sequence }).from(missionEvents).where(eq(missionEvents.missionId, input.missionId)).orderBy(desc(missionEvents.sequence)).limit(1);
  const event = createImmutableAuditEvent({ id: id("evt"), missionId: input.missionId, sequence: nextAuditSequence(latest ? [latest.sequence] : []), eventType: input.eventType, actor: input.actor, tool: input.tool ?? null, correlationId: input.correlationId ?? null, result: input.result, payload: input.payload === undefined ? null : JSON.stringify(input.payload), evidenceRefs: JSON.stringify(input.evidenceRefs ?? []), createdAt: now() });
  await db.insert(missionEvents).values(event); return event;
}
export async function appendMissionEvents(inputs: readonly { missionId: string; eventType: string; actor: string; tool?: string; correlationId?: string; result: string; payload?: unknown; evidenceRefs?: string[] }[]) {
  if (inputs.length === 0) return [];
  const db = await getDb(); if (!db) throw new Error("Database is unavailable.");
  const missionId = inputs[0].missionId;
  if (inputs.some(input => input.missionId !== missionId)) throw new Error("A batch of mission audit events must belong to one mission.");
  const [latest] = await db.select({ sequence: missionEvents.sequence }).from(missionEvents).where(eq(missionEvents.missionId, missionId)).orderBy(desc(missionEvents.sequence)).limit(1);
  const startSequence = nextAuditSequence(latest ? [latest.sequence] : []);
  const createdAt = now();
  const events = inputs.map((input, index) => createImmutableAuditEvent({ id: id("evt"), missionId, sequence: startSequence + index, eventType: input.eventType, actor: input.actor, tool: input.tool ?? null, correlationId: input.correlationId ?? null, result: input.result, payload: input.payload === undefined ? null : JSON.stringify(input.payload), evidenceRefs: JSON.stringify(input.evidenceRefs ?? []), createdAt }));
  await db.insert(missionEvents).values(events);
  return events;
}
export async function addEvidence(input: { missionId: string; kind: string; title: string; content: string; source: string }) { const db = await getDb(); if (!db) throw new Error("Database is unavailable."); const item = { id: id("evd"), ...input, createdAt: now() }; await db.insert(evidence).values(item); return item; }
export async function createMission(input: { title: string; repository: string; incident: string; risk: Risk; mode?: "LIVE" | "FIXTURE" }) {
  const db = await getDb(); if (!db) throw new Error("Database is unavailable."); const createdAt = now(); const mission = { id: id("SF"), title: input.title, repository: input.repository, incident: input.incident, status: "CREATED" as const, risk: input.risk, rootCause: null, repairSummary: null, patch: null, createdAt, updatedAt: createdAt }; await db.insert(missions).values(mission); await appendMissionEvent({ missionId: mission.id, eventType: "MISSION_CREATED", actor: "operator", result: "Mission persisted and ready for deterministic investigation." }); return mission;
}
export async function setMissionStatus(missionId: string, status: MissionStatus, updates: Partial<Pick<Mission, "rootCause" | "repairSummary" | "patch">> = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [mission] = await db.select({ status: missions.status }).from(missions).where(eq(missions.id, missionId)).limit(1);
  if (!mission) throw new Error("Mission was not found.");
  assertAllowedMissionTransition(mission.status, status);
  await db.update(missions).set({ status, updatedAt: now(), ...updates }).where(eq(missions.id, missionId));
}

export async function setMissionPlanningArtifacts(missionId: string, updates: Pick<Partial<Mission>, "repairSummary" | "patch">) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db.update(missions).set({ ...updates, updatedAt: now() }).where(eq(missions.id, missionId));
}

export async function recoverPlanningMissionAfterRepairParsingFailure(missionId: string, updates: Pick<Partial<Mission>, "repairSummary" | "patch">) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [mission] = await db.select({ status: missions.status }).from(missions).where(eq(missions.id, missionId)).limit(1);
  if (!mission || mission.status !== "FAILED") throw new Error("Only a failed Repair Engineer parsing attempt may be recovered to planning.");
  const [failure] = await db.select({ id: missionEvents.id }).from(missionEvents).where(and(eq(missionEvents.missionId, missionId), eq(missionEvents.eventType, "MISSION_FAILED"), eq(missionEvents.actor, "Repair Engineer"))).limit(1);
  if (!failure) throw new Error("Repair Engineer parsing failure audit evidence is required before recovery.");
  await db.update(missions).set({ status: "PLANNING_FIX", ...updates, updatedAt: now() }).where(eq(missions.id, missionId));
}
export async function getMissionBundle(missionId: string) {
  const db = await getDb(); if (!db) throw new Error("Database is unavailable."); const [mission] = await db.select().from(missions).where(eq(missions.id, missionId)).limit(1); if (!mission) return null;
  const [events, missionEvidence, runs, approvals, actions, trueforgeSessionRecords, trueforgeTurnRecords] = await Promise.all([db.select().from(missionEvents).where(eq(missionEvents.missionId, missionId)).orderBy(asc(missionEvents.sequence)), db.select().from(evidence).where(eq(evidence.missionId, missionId)).orderBy(asc(evidence.createdAt)), db.select().from(sandboxRuns).where(eq(sandboxRuns.missionId, missionId)).orderBy(desc(sandboxRuns.createdAt)), db.select().from(approvalRequests).where(eq(approvalRequests.missionId, missionId)).orderBy(desc(approvalRequests.createdAt)), db.select().from(externalActions).where(eq(externalActions.missionId, missionId)).orderBy(desc(externalActions.createdAt)), db.select().from(trueforgeSessions).where(eq(trueforgeSessions.missionId, missionId)).orderBy(desc(trueforgeSessions.createdAt)), db.select().from(trueforgeTurns).where(eq(trueforgeTurns.missionId, missionId)).orderBy(desc(trueforgeTurns.createdAt))]);
  const publicTrueForgeSessions = trueforgeSessionRecords.map(({ baseUrl: _baseUrl, ...session }) => session);
  return { mission, events, evidence: missionEvidence, runs, approvals, actions, trueforgeSessions: publicTrueForgeSessions, trueforgeTurns: trueforgeTurnRecords };
}
export async function listMissionBundles() { const db = await getDb(); if (!db) throw new Error("Database is unavailable."); const list = await db.select().from(missions).orderBy(desc(missions.updatedAt)); return Promise.all(list.map(mission => getMissionBundle(mission.id))); }
export async function getApprovalWithMission(requestId: string) { const db = await getDb(); if (!db) throw new Error("Database is unavailable."); const [approval] = await db.select().from(approvalRequests).where(eq(approvalRequests.id, requestId)).limit(1); if (!approval) return null; const [mission] = await db.select().from(missions).where(eq(missions.id, approval.missionId)).limit(1); return mission ? { approval, mission } : null; }
export async function decideApproval(requestId: string, status: "APPROVED" | "REJECTED") { const db = await getDb(); if (!db) throw new Error("Database is unavailable."); await db.update(approvalRequests).set({ status, decidedAt: now(), decidedBy: "operator" }).where(and(eq(approvalRequests.id, requestId), eq(approvalRequests.status, "PENDING"))); }
export async function addSandboxRun(input: { missionId: string; status: "PASS" | "FAIL" | "UNKNOWN" | "TIMEOUT"; runner: string; command: string; stdout: string; stderr: string; exitCode: number; durationMs: number; timedOut: boolean }) { const db = await getDb(); if (!db) throw new Error("Database is unavailable."); const run = { id: id("run"), ...input, timedOut: input.timedOut ? 1 : 0, createdAt: now() }; await db.insert(sandboxRuns).values(run); return run; }
export async function addApprovalRequest(input: { missionId: string; actionType: string; risk: Risk; justification: string }) { const db = await getDb(); if (!db) throw new Error("Database is unavailable."); const createdAt = now(); const request = { id: id("apr"), ...input, status: "PENDING" as const, decidedAt: null, decidedBy: null, createdAt, expiresAt: createdAt + 3600000 }; await db.insert(approvalRequests).values(request); return request; }
export async function countExternalActions(missionId: string) { const db = await getDb(); if (!db) throw new Error("Database is unavailable."); return (await db.select({ id: externalActions.id }).from(externalActions).where(eq(externalActions.missionId, missionId))).length; }
export async function createSimulatedExternalAction(missionId: string) { const db = await getDb(); if (!db) throw new Error("Database is unavailable."); const action = { id: id("act"), missionId, actionType: "SIMULATED_GITHUB_PULL_REQUEST", status: "SIMULATED", target: "sentinelforge-demo/broken-ci-fixture", idempotencyKey: `approval:${missionId}`, result: "Simulation only: pull request was recorded but no GitHub API call, branch, commit, or PR was created.", createdAt: now(), executedAt: now() }; await db.insert(externalActions).values(action); return action; }

export async function linkTrueForgeSession(input: { missionId: string; sessionId: string; baseUrl: string; model: string; status: string }) {
  const db = await getDb(); if (!db) throw new Error("Database is unavailable.");
  const createdAt = now(); const record = { id: id("tfs"), ...input, createdAt, updatedAt: createdAt };
  await db.insert(trueforgeSessions).values(record);
  return record;
}

export async function recordTrueForgeTurn(input: { missionId: string; trueforgeSessionId: string; turnId: string; status: string; threadId?: string; requiredActionId?: string; toolCallId?: string }) {
  const db = await getDb(); if (!db) throw new Error("Database is unavailable.");
  const createdAt = now(); const record = { id: id("tft"), ...input, threadId: input.threadId ?? null, requiredActionId: input.requiredActionId ?? null, toolCallId: input.toolCallId ?? null, streamCursor: 0, createdAt, updatedAt: createdAt };
  await db.insert(trueforgeTurns).values(record);
  return record;
}

export async function updateTrueForgeTurn(input: { turnId: string; status: string; threadId?: string; requiredActionId?: string; toolCallId?: string; streamCursor?: number }) {
  const db = await getDb(); if (!db) throw new Error("Database is unavailable.");
  await db.update(trueforgeTurns).set({ status: input.status, ...(input.threadId !== undefined ? { threadId: input.threadId } : {}), ...(input.requiredActionId !== undefined ? { requiredActionId: input.requiredActionId } : {}), ...(input.toolCallId !== undefined ? { toolCallId: input.toolCallId } : {}), ...(input.streamCursor !== undefined ? { streamCursor: input.streamCursor } : {}), updatedAt: now() }).where(eq(trueforgeTurns.turnId, input.turnId));
}

export async function getTrueForgeSessionByMission(missionId: string) {
  const db = await getDb(); if (!db) throw new Error("Database is unavailable.");
  const [record] = await db.select().from(trueforgeSessions).where(eq(trueforgeSessions.missionId, missionId)).limit(1);
  return record ?? null;
}

export async function getTrueForgeTurnByMission(missionId: string) {
  const db = await getDb(); if (!db) throw new Error("Database is unavailable.");
  const [record] = await db.select().from(trueforgeTurns).where(eq(trueforgeTurns.missionId, missionId)).orderBy(desc(trueforgeTurns.createdAt)).limit(1);
  return record ?? null;
}

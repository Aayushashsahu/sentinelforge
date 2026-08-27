import type { MissionStatus, Risk } from "../../shared/sentinelforge";
import { isValidRepairFingerprint, type TrueForgeApprovalRequired } from "./liveContracts";
import { FIXTURE_GITHUB_PR_GATE_TOOL_NAME } from "./agents/fixtureProofApproval";
import { FIXTURE_PROOF_REPOSITORY, type FixtureProofAction } from "./fixtureGithubProof";

type ApprovalRecord = { id: string };
type MissionRecord = { id: string; status: MissionStatus };
type TurnRecord = { turnId: string; trueforgeSessionId?: string };

export type TrueForgeApprovalPersistencePort<TBundle = unknown> = {
  getMission(missionId: string): Promise<MissionRecord | null>;
  getLatestTrueForgeTurn(missionId: string): Promise<TurnRecord | null>;
  addApprovalRequest(input: { missionId: string; actionType: string; risk: Risk; justification: string }): Promise<ApprovalRecord>;
  updateTrueForgeTurn(input: { turnId: string; status: string; threadId: string; requiredActionId?: string; toolCallId: string }): Promise<void>;
  setMissionStatus(missionId: string, status: MissionStatus): Promise<void>;
  appendMissionEvent(input: { missionId: string; eventType: string; actor: string; tool?: string; correlationId?: string; result: string; payload?: unknown; evidenceRefs?: string[] }): Promise<unknown>;
  notifyOwner(input: { title: string; content: string }): Promise<boolean>;
  getMissionBundle(missionId: string): Promise<TBundle>;
  getFixtureProofAction?(actionId: string): Promise<FixtureProofAction | null>;
};

export async function persistTrueForgeApprovalRequired<TBundle>(port: TrueForgeApprovalPersistencePort<TBundle>, input: { missionId: string; event: TrueForgeApprovalRequired; risk: Risk; repairFingerprint: string; verificationEvidenceRefs: string[] }): Promise<TBundle> {
  const mission = await port.getMission(input.missionId);
  if (!mission) throw new Error("Mission was not found.");
  if (mission.status !== "VERIFYING") throw new Error("TrueForge approval-required event refused: mission must be in VERIFYING after real verification passes.");
  if (!isValidRepairFingerprint(input.repairFingerprint)) throw new Error("TrueForge approval-required event refused: repair fingerprint is invalid.");
  const turn = await port.getLatestTrueForgeTurn(input.missionId);
  if (!turn) throw new Error("TrueForge approval-required event refused: no correlated turn exists.");

  const approval = await port.addApprovalRequest({
    missionId: mission.id,
    actionType: `TRUEFORGE_PENDING:${input.event.tool_name}`,
    risk: input.risk,
    justification: `TrueForge requested human approval for ${input.event.tool_name}. Repair fingerprint: ${input.repairFingerprint}. No continuation or GitHub action has occurred.`,
  });
  await port.updateTrueForgeTurn({ turnId: turn.turnId, status: "WAITING_APPROVAL", threadId: input.event.thread_id, ...(input.event.required_action_id ? { requiredActionId: input.event.required_action_id } : {}), toolCallId: input.event.tool_call_id });
  await port.setMissionStatus(mission.id, "WAITING_APPROVAL");
  await port.appendMissionEvent({
    missionId: mission.id,
    eventType: "TRUEFORGE_TOOL_APPROVAL_REQUIRED",
    actor: "TrueForge",
    tool: input.event.tool_name,
    correlationId: input.event.tool_call_id,
    result: "A real TrueForge approval-required event was persisted. The mission is paused; no continuation or external action has occurred.",
    payload: { threadId: input.event.thread_id, requiredActionId: input.event.required_action_id ?? null, repairFingerprint: input.repairFingerprint },
    evidenceRefs: [approval.id, ...input.verificationEvidenceRefs],
  });
  const delivered = await port.notifyOwner({ title: "SentinelForge TrueForge approval required", content: `${mission.id} is paused on a real TrueForge tool approval. Risk: ${input.risk}. No continuation or GitHub action has occurred.` });
  await port.appendMissionEvent({ missionId: mission.id, eventType: "OWNER_NOTIFIED", actor: "SentinelForge", tool: "owner-notification", correlationId: input.event.tool_call_id, result: delivered ? "Owner notification delivered for the paused TrueForge action." : "Owner notification unavailable; the TrueForge action remains safely paused." });
  return port.getMissionBundle(mission.id);
}

export async function persistTrueForgeRepairProposalApprovalRequired<TBundle>(port: TrueForgeApprovalPersistencePort<TBundle>, input: { missionId: string; event: TrueForgeApprovalRequired; risk: Risk; repairFingerprint: string; proposalEvidenceRefs: string[] }): Promise<TBundle> {
  const mission = await port.getMission(input.missionId);
  if (!mission) throw new Error("Mission was not found.");
  if (mission.status !== "PLANNING_FIX") throw new Error("TrueForge repair approval-required event refused: mission must be in PLANNING_FIX with a persisted read-only proposal.");
  if (!isValidRepairFingerprint(input.repairFingerprint)) throw new Error("TrueForge repair approval-required event refused: repair fingerprint is invalid.");
  const turn = await port.getLatestTrueForgeTurn(input.missionId);
  if (!turn) throw new Error("TrueForge repair approval-required event refused: no correlated turn exists.");
  const approval = await port.addApprovalRequest({
    missionId: mission.id,
    actionType: `TRUEFORGE_REPAIR_PROPOSAL_GATE:${input.event.tool_name}`,
    risk: input.risk,
    justification: `TrueForge requested human approval for the non-mutating repair proposal gate ${input.event.tool_name}. Repair fingerprint: ${input.repairFingerprint}. No continuation or GitHub action has occurred.`,
  });
  await port.updateTrueForgeTurn({ turnId: turn.turnId, status: "WAITING_APPROVAL", threadId: input.event.thread_id, ...(input.event.required_action_id ? { requiredActionId: input.event.required_action_id } : {}), toolCallId: input.event.tool_call_id });
  await port.setMissionStatus(mission.id, "WAITING_APPROVAL");
  await port.appendMissionEvent({
    missionId: mission.id,
    eventType: "TRUEFORGE_REPAIR_PROPOSAL_APPROVAL_REQUIRED",
    actor: "TrueForge",
    tool: input.event.tool_name,
    correlationId: input.event.tool_call_id,
    result: "A real TrueForge repair-proposal approval-required event was persisted. The mission is paused; no continuation or external action has occurred.",
    payload: { threadId: input.event.thread_id, requiredActionId: input.event.required_action_id ?? null, repairFingerprint: input.repairFingerprint },
    evidenceRefs: [approval.id, ...input.proposalEvidenceRefs],
  });
  const delivered = await port.notifyOwner({ title: "SentinelForge repair proposal approval required", content: `${mission.id} is paused on a real TrueForge repair-proposal approval. Risk: ${input.risk}. No continuation or GitHub action has occurred.` });
  await port.appendMissionEvent({ missionId: mission.id, eventType: "OWNER_NOTIFIED", actor: "SentinelForge", tool: "owner-notification", correlationId: input.event.tool_call_id, result: delivered ? "Owner notification delivered for the paused TrueForge repair proposal." : "Owner notification unavailable; the TrueForge repair proposal remains safely paused." });
  return port.getMissionBundle(mission.id);
}

export async function persistTrueForgeFixtureProofApprovalRequired<TBundle>(port: TrueForgeApprovalPersistencePort<TBundle>, input: { missionId: string; event: TrueForgeApprovalRequired; risk: Risk; repairFingerprint: string; proofActionId: string; proposalEvidenceRefs: string[] }): Promise<TBundle> {
  const mission = await port.getMission(input.missionId);
  if (!mission) throw new Error("Mission was not found.");
  if (mission.status !== "PLANNING_FIX") throw new Error("Fixture proof approval-required event refused: mission must be in PLANNING_FIX with a persisted exact fixture proof action.");
  if (input.event.tool_name !== FIXTURE_GITHUB_PR_GATE_TOOL_NAME) throw new Error("Fixture proof approval-required event refused: provider tool is not the fixture GitHub PR gate.");
  if (!isValidRepairFingerprint(input.repairFingerprint) || !/^act_[A-Za-z0-9_-]{1,28}$/.test(input.proofActionId) || !port.getFixtureProofAction) throw new Error("Fixture proof approval-required event refused: fingerprint, staged action identifier, or action lookup is invalid.");
  const action = await port.getFixtureProofAction(input.proofActionId);
  if (!action || action.missionId !== mission.id || action.status !== "AWAITING_APPROVAL" || action.intent.repository !== FIXTURE_PROOF_REPOSITORY || action.intent.proposalFingerprint !== input.repairFingerprint) throw new Error("Fixture proof approval-required event refused: persisted staged action does not match mission, status, target, or fingerprint.");
  const turn = await port.getLatestTrueForgeTurn(input.missionId);
  if (!turn) throw new Error("Fixture proof approval-required event refused: no correlated turn exists.");
  const evidence = action.readEvidence;
  const serverEvidence = evidence?.serverEvidence;
  if (!evidence?.packageEvidenceVerified || !evidence.manifestEvidenceVerified || !serverEvidence || serverEvidence.source !== "SERVER_ORCHESTRATED" || serverEvidence.package?.path !== "package.json" || serverEvidence.package.version !== action.intent.afterVersion || serverEvidence.manifest?.path !== action.intent.filePath || serverEvidence.manifest.version !== action.intent.beforeVersion || !evidence.correlation || evidence.correlation.trueforgeSessionId !== turn.trueforgeSessionId || evidence.correlation.turnId !== turn.turnId || evidence.correlation.threadId !== input.event.thread_id || evidence.correlation.gateToolCallId !== input.event.tool_call_id) throw new Error("Fixture proof approval-required event refused: both canonical server-orchestrated reads and exact session, turn, thread, and gate correlation are required.");
  const approval = await port.addApprovalRequest({
    missionId: mission.id,
    actionType: `TRUEFORGE_FIXTURE_GITHUB_PR_GATE:${input.event.tool_name}`,
    risk: input.risk,
    justification: `TrueForge requested human approval for staged fixture proof action ${input.proofActionId}. Repair fingerprint: ${input.repairFingerprint}. The exact persisted intent is one branch, one release-manifest.json repair, and one open unmerged PR; no continuation or GitHub action has occurred.`,
  });
  await port.updateTrueForgeTurn({ turnId: turn.turnId, status: "WAITING_APPROVAL", threadId: input.event.thread_id, ...(input.event.required_action_id ? { requiredActionId: input.event.required_action_id } : {}), toolCallId: input.event.tool_call_id });
  await port.setMissionStatus(mission.id, "WAITING_APPROVAL");
  await port.appendMissionEvent({ missionId: mission.id, eventType: "TRUEFORGE_FIXTURE_GITHUB_PROOF_APPROVAL_REQUIRED", actor: "TrueForge", tool: input.event.tool_name, correlationId: input.event.tool_call_id, result: "A genuine TrueForge fixture-proof approval-required event was persisted. The exact action remains paused; no continuation or GitHub mutation has occurred.", payload: { proofActionId: input.proofActionId, threadId: input.event.thread_id, requiredActionId: input.event.required_action_id ?? null, repairFingerprint: input.repairFingerprint }, evidenceRefs: [approval.id, ...input.proposalEvidenceRefs] });
  const delivered = await port.notifyOwner({ title: "SentinelForge fixture proof approval required", content: `${mission.id} is paused on one exact fixture-only GitHub proof. No continuation or GitHub mutation has occurred.` });
  await port.appendMissionEvent({ missionId: mission.id, eventType: "OWNER_NOTIFIED", actor: "SentinelForge", tool: "owner-notification", correlationId: input.event.tool_call_id, result: delivered ? "Owner notification delivered for the paused fixture proof." : "Owner notification unavailable; the fixture proof remains safely paused." });
  return port.getMissionBundle(mission.id);
}

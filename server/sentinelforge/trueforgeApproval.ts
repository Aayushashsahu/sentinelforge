import type { MissionStatus, Risk } from "../../shared/sentinelforge";
import { isValidRepairFingerprint, type TrueForgeApprovalRequired } from "./liveContracts";

type ApprovalRecord = { id: string };
type MissionRecord = { id: string; status: MissionStatus };
type TurnRecord = { turnId: string };

export type TrueForgeApprovalPersistencePort<TBundle = unknown> = {
  getMission(missionId: string): Promise<MissionRecord | null>;
  getLatestTrueForgeTurn(missionId: string): Promise<TurnRecord | null>;
  addApprovalRequest(input: { missionId: string; actionType: string; risk: Risk; justification: string }): Promise<ApprovalRecord>;
  updateTrueForgeTurn(input: { turnId: string; status: string; threadId: string; requiredActionId?: string; toolCallId: string }): Promise<void>;
  setMissionStatus(missionId: string, status: MissionStatus): Promise<void>;
  appendMissionEvent(input: { missionId: string; eventType: string; actor: string; tool?: string; correlationId?: string; result: string; payload?: unknown; evidenceRefs?: string[] }): Promise<unknown>;
  notifyOwner(input: { title: string; content: string }): Promise<boolean>;
  getMissionBundle(missionId: string): Promise<TBundle>;
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

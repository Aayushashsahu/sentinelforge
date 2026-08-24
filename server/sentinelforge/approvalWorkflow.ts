import type { ApprovalStatus, MissionStatus } from "../../shared/sentinelforge";
import { canCreateExternalAction, mayDecideApproval, nextMissionStatusForDecision } from "./approval";

export type PersistedApproval = { id: string; status: ApprovalStatus; expiresAt: number };
export type PersistedMission = { id: string; status: MissionStatus };

export type ApprovalWorkflowPort<TBundle = unknown> = {
  getApprovalWithMission(requestId: string): Promise<{ approval: PersistedApproval; mission: PersistedMission } | null>;
  decideApproval(requestId: string, status: "APPROVED" | "REJECTED"): Promise<void>;
  setMissionStatus(missionId: string, status: MissionStatus): Promise<void>;
  appendMissionEvent(input: { missionId: string; eventType: string; actor: string; tool?: string; result: string; evidenceRefs?: string[] }): Promise<unknown>;
  countExternalActions(missionId: string): Promise<number>;
  createSimulatedExternalAction(missionId: string): Promise<{ id: string; result: string }>;
  getMissionBundle(missionId: string): Promise<TBundle>;
};

export async function resolvePersistedApproval<TBundle>(port: ApprovalWorkflowPort<TBundle>, requestId: string, approve: boolean): Promise<TBundle> {
  const record = await port.getApprovalWithMission(requestId);
  if (!record) throw new Error("Approval request was not found.");
  const { approval, mission } = record;
  if (!mayDecideApproval(mission.status, approval.status, approval.expiresAt)) {
    throw new Error("Approval is stale, already decided, expired, or not valid for the current mission state.");
  }
  const decision = approve ? "APPROVED" : "REJECTED";
  await port.decideApproval(requestId, decision);
  const nextStatus = nextMissionStatusForDecision(approve);
  await port.setMissionStatus(mission.id, nextStatus);
  if (!approve) {
    await port.appendMissionEvent({ missionId: mission.id, eventType: "APPROVAL_REJECTED", actor: "operator", result: "Approval declined. No external action was created and the mission stopped safely." });
    return port.getMissionBundle(mission.id);
  }
  await port.appendMissionEvent({ missionId: mission.id, eventType: "MISSION_RESUMED", actor: "TrueForge adapter", result: "Persisted approval accepted; resuming only the approved simulated action." });
  const actionCount = await port.countExternalActions(mission.id);
  if (!canCreateExternalAction(actionCount, decision, nextStatus)) throw new Error("External action was refused by the idempotency and approval gate.");
  const action = await port.createSimulatedExternalAction(mission.id);
  await port.appendMissionEvent({ missionId: mission.id, eventType: "SIMULATED_ACTION_COMPLETED", actor: "Simulated GitHub MCP adapter", tool: "github-mcp/simulated", result: action.result, evidenceRefs: [action.id] });
  await port.setMissionStatus(mission.id, "COMPLETED");
  await port.appendMissionEvent({ missionId: mission.id, eventType: "MISSION_COMPLETED", actor: "SentinelForge", result: "Mission completed with a simulated, approval-gated external action. No GitHub write occurred." });
  return port.getMissionBundle(mission.id);
}

import type { ApprovalStatus, MissionStatus } from "../../shared/sentinelforge";

export function mayDecideApproval(missionStatus: MissionStatus, approvalStatus: ApprovalStatus, expiresAt: number, now = Date.now()): boolean {
  return missionStatus === "WAITING_APPROVAL" && approvalStatus === "PENDING" && expiresAt > now;
}

export function nextMissionStatusForDecision(approved: boolean): MissionStatus { return approved ? "EXECUTING" : "REJECTED"; }
export function canCreateExternalAction(existingActionCount: number, approvalStatus: ApprovalStatus, missionStatus: MissionStatus): boolean { return existingActionCount === 0 && approvalStatus === "APPROVED" && missionStatus === "EXECUTING"; }

import type { MissionStatus } from "../../shared/sentinelforge";

const allowedTransitions: Record<MissionStatus, MissionStatus[]> = {
  CREATED: ["INVESTIGATING", "FAILED"],
  INVESTIGATING: ["PLANNING_FIX", "FAILED"],
  PLANNING_FIX: ["VERIFYING", "FAILED"],
  VERIFYING: ["WAITING_APPROVAL", "FAILED"],
  WAITING_APPROVAL: ["EXECUTING", "REJECTED"],
  EXECUTING: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  FAILED: [],
  REJECTED: [],
};

export function isAllowedMissionTransition(current: MissionStatus, next: MissionStatus): boolean {
  return allowedTransitions[current].includes(next);
}

export function assertAllowedMissionTransition(current: MissionStatus, next: MissionStatus): void {
  if (!isAllowedMissionTransition(current, next)) {
    throw new Error(`Mission transition refused: ${current} → ${next}`);
  }
}

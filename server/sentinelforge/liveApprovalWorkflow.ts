import { notifyOwner } from "../_core/notification";
import { isValidRepairFingerprint, parseTrueForgeApprovalRequiredEvent, parseTrueForgeProviderApprovalPauseEvent } from "./liveContracts";
import { addApprovalRequest, appendMissionEvent, getMissionBundle, getTrueForgeTurnByMission, setMissionStatus, updateTrueForgeTurn } from "./repository";
import { persistTrueForgeApprovalRequired } from "./trueforgeApproval";

export function mapTrueForgeProviderApprovalPause(input: { providerEvent: unknown; toolName: string }) {
  const pause = parseTrueForgeProviderApprovalPauseEvent(input.providerEvent);
  const toolName = input.toolName.trim();
  if (!pause || !toolName || toolName.length > 110 || toolName !== input.toolName) {
    throw new Error("TrueForge approval persistence refused: provider pause or correlated tool name is invalid.");
  }
  return {
    type: "tool.approval_required" as const,
    thread_id: pause.thread_id,
    tool_call_id: pause.tool_calls[0]!.id,
    required_action_id: pause.id,
    tool_name: toolName,
  };
}

export function persistLiveTrueForgeProviderApprovalRequired(input: { missionId: string; providerEvent: unknown; toolName: string; repairFingerprint: string; verificationEvidenceRefs: string[] }) {
  return persistLiveTrueForgeApprovalRequired({
    missionId: input.missionId,
    streamEvent: mapTrueForgeProviderApprovalPause({ providerEvent: input.providerEvent, toolName: input.toolName }),
    repairFingerprint: input.repairFingerprint,
    verificationEvidenceRefs: input.verificationEvidenceRefs,
  });
}

export async function persistLiveTrueForgeApprovalRequired(input: { missionId: string; streamEvent: unknown; repairFingerprint: string; verificationEvidenceRefs: string[] }) {
  const event = parseTrueForgeApprovalRequiredEvent(input.streamEvent);
  if (!event) throw new Error("TrueForge approval persistence refused: event is not a valid tool.approval_required payload.");
  if (!isValidRepairFingerprint(input.repairFingerprint)) throw new Error("TrueForge approval persistence refused: repair fingerprint is invalid.");
  return persistTrueForgeApprovalRequired({
    getMission: async missionId => {
      const bundle = await getMissionBundle(missionId);
      return bundle ? { id: bundle.mission.id, status: bundle.mission.status } : null;
    },
    getLatestTrueForgeTurn: async missionId => {
      const turn = await getTrueForgeTurnByMission(missionId);
      return turn ? { turnId: turn.turnId } : null;
    },
    addApprovalRequest,
    updateTrueForgeTurn,
    setMissionStatus,
    appendMissionEvent,
    notifyOwner,
    getMissionBundle,
  }, {
    missionId: input.missionId,
    event,
    risk: (await getMissionBundle(input.missionId))?.mission.risk ?? "HIGH",
    repairFingerprint: input.repairFingerprint,
    verificationEvidenceRefs: input.verificationEvidenceRefs,
  });
}

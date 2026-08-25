import { notifyOwner } from "../_core/notification";
import { parseTrueForgeApprovalRequiredEvent } from "./liveContracts";
import { addApprovalRequest, appendMissionEvent, getMissionBundle, getTrueForgeTurnByMission, setMissionStatus, updateTrueForgeTurn } from "./repository";
import { persistTrueForgeApprovalRequired } from "./trueforgeApproval";

export async function persistLiveTrueForgeApprovalRequired(input: { missionId: string; streamEvent: unknown; repairFingerprint: string; verificationEvidenceRefs: string[] }) {
  const event = parseTrueForgeApprovalRequiredEvent(input.streamEvent);
  if (!event) throw new Error("TrueForge approval persistence refused: event is not a valid tool.approval_required payload.");
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

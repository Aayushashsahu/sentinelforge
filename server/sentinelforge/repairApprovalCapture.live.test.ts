import { describe, expect, it } from "vitest";
import { runLiveRepairProposalApprovalCapture } from "./liveWorkflow";
import { getMissionBundle, recoverPlanningMissionAfterRepairParsingFailure } from "./repository";

const enabled = process.env.RUN_LIVE_REPAIR_APPROVAL_CAPTURE === "1";

describe.skipIf(!enabled)("live repair proposal approval capture", () => {
  it("creates one provider pause for the persisted release-manifest proposal and stops before continuation", async () => {
    const before = await getMissionBundle("SF_xF37FKFqr1NvtA");
    if (before?.mission.status === "FAILED" && before.mission.repairSummary && before.mission.patch) {
      await recoverPlanningMissionAfterRepairParsingFailure(before.mission.id, { repairSummary: before.mission.repairSummary, patch: before.mission.patch });
    }
    const bundle = await runLiveRepairProposalApprovalCapture("SF_xF37FKFqr1NvtA");
    expect(bundle?.mission.status).toBe("WAITING_APPROVAL");
    expect(bundle?.approvals.some(approval => approval.actionType === "TRUEFORGE_REPAIR_PROPOSAL_GATE:repair_proposal_gate" && approval.status === "PENDING")).toBe(true);
    expect(bundle?.trueforgeTurns.some(turn => turn.status === "WAITING_APPROVAL" && Boolean(turn.requiredActionId) && Boolean(turn.toolCallId))).toBe(true);
    expect(bundle?.actions).toHaveLength(0);
    expect(bundle?.continuations).toHaveLength(0);
  }, 90_000);
});

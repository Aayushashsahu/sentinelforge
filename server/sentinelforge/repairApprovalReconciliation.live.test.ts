import { describe, expect, it } from "vitest";
import { reconcileExistingLiveRepairProposalApproval } from "./liveWorkflow";

const enabled = process.env.RUN_LIVE_REPAIR_APPROVAL_RECONCILIATION === "1";
const missionId = "SF_xF37FKFqr1NvtA";
const sessionId = "01m0y6f72dphv6jq0r0xj6gk2a";

describe.skipIf(!enabled)("existing repair approval reconciliation", () => {
  it("persists one provider checkpoint and leaves a second reconciliation as a no-op", async () => {
    const first = await reconcileExistingLiveRepairProposalApproval({ missionId, sessionId });
    expect(first.mission.status).toBe("WAITING_APPROVAL");
    expect(first.trueforgeTurns.filter(turn => turn.trueforgeSessionId === sessionId)).toHaveLength(1);
    expect(first.approvals.filter(approval => approval.actionType === "TRUEFORGE_REPAIR_PROPOSAL_GATE:repair_proposal_gate")).toHaveLength(1);
    const second = await reconcileExistingLiveRepairProposalApproval({ missionId, sessionId });
    expect(second.mission.status).toBe("WAITING_APPROVAL");
    expect(second.trueforgeTurns.filter(turn => turn.trueforgeSessionId === sessionId)).toHaveLength(1);
    expect(second.approvals.filter(approval => approval.actionType === "TRUEFORGE_REPAIR_PROPOSAL_GATE:repair_proposal_gate")).toHaveLength(1);
  }, 90_000);
});

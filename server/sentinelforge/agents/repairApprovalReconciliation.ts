import type { TrueForgeApprovalRequired } from "../liveContracts";
import type { TrueForgeStreamEvent } from "../trueforge/stream";
import { validateRepairApprovalCaptureSequence } from "./repairApprovalSequence";

type ReconciliationBundle = {
  mission: { id: string; status: string };
  approvals: Array<{ id: string; actionType: string }>;
  evidence: Array<{ id: string; kind: string; source: string }>;
  events: Array<{ eventType: string; correlationId: string | null }>;
  trueforgeTurns: Array<{ turnId: string; trueforgeSessionId: string }>;
};

export type RepairApprovalReconciliationPort<TBundle extends ReconciliationBundle> = {
  getBundle(missionId: string): Promise<TBundle>;
  recordTurn(input: { missionId: string; sessionId: string; turnId: string; threadId: string; requiredActionId: string; toolCallId: string }): Promise<void>;
  appendStreamAudit(input: { missionId: string; turnId: string; events: readonly TrueForgeStreamEvent[] }): Promise<void>;
  addProviderEvidence(input: { missionId: string }): Promise<{ id: string }>;
  persistApproval(input: { event: TrueForgeApprovalRequired; evidenceRefs: string[] }): Promise<TBundle>;
  finalizeInterruptedCheckpoint(input: { approvalRequestId: string; turnId: string; toolCallId: string }): Promise<TBundle>;
};

function hasTerminalTurn(events: readonly TrueForgeStreamEvent[]): boolean {
  return events.some(event => event.event === "turn.done" || (event.data && typeof event.data === "object" && !Array.isArray(event.data) && (event.data as Record<string, unknown>).type === "turn.done"));
}

export async function reconcileRepairApprovalHistory<TBundle extends ReconciliationBundle>(port: RepairApprovalReconciliationPort<TBundle>, input: { missionId: string; sessionId: string; events: readonly TrueForgeStreamEvent[]; toolsMcpName: string }): Promise<TBundle> {
  if (input.events.length === 0) throw new Error("TrueForge repair approval reconciliation requires non-empty remote history.");
  const { pause, turnId } = validateRepairApprovalCaptureSequence(input.events, input.toolsMcpName);
  if (!hasTerminalTurn(input.events) && !pause) throw new Error("TrueForge repair approval reconciliation requires a terminal turn or an approval pause.");

  const bundle = await port.getBundle(input.missionId);
  const toolCall = pause.tool_calls[0];
  if (!toolCall) throw new Error("TrueForge repair approval reconciliation requires one valid provider tool-call correlation.");
  const actionType = "TRUEFORGE_REPAIR_PROPOSAL_GATE:repair_proposal_gate";
  const existingApproval = bundle.approvals.find(approval => approval.actionType === actionType);
  const existingTurn = bundle.trueforgeTurns.find(turn => turn.turnId === turnId && turn.trueforgeSessionId === input.sessionId);
  if (existingApproval && existingTurn && bundle.mission.status === "WAITING_APPROVAL") return bundle;
  if (existingApproval && existingTurn && bundle.mission.status === "PLANNING_FIX") {
    return port.finalizeInterruptedCheckpoint({ approvalRequestId: existingApproval.id, turnId, toolCallId: toolCall.id });
  }
  if (existingApproval) throw new Error("TrueForge repair approval reconciliation found an approval request without a matching durable waiting checkpoint.");
  if (bundle.mission.status !== "PLANNING_FIX") throw new Error("TrueForge repair approval reconciliation requires a planning-stage mission without a prior approval request.");

  const approvalEvent: TrueForgeApprovalRequired = {
    type: "tool.approval_required",
    thread_id: pause.thread_id,
    tool_call_id: toolCall.id,
    required_action_id: pause.id,
    tool_name: "repair_proposal_gate",
  };
  if (!existingTurn) {
    await port.recordTurn({ missionId: input.missionId, sessionId: input.sessionId, turnId, threadId: pause.thread_id, requiredActionId: pause.id, toolCallId: toolCall.id });
  }
  if (!bundle.events.some(event => event.eventType === "TRUEFORGE_STREAM_EVENT" && event.correlationId === turnId)) {
    await port.appendStreamAudit({ missionId: input.missionId, turnId, events: input.events });
  }
  const existingProviderEvidence = bundle.evidence.find(item => item.kind === "OBSERVED" && item.source === "trueforge/repair-proposal-approval");
  const providerEvidence = existingProviderEvidence ?? await port.addProviderEvidence({ missionId: input.missionId });
  const evidenceRefs = [providerEvidence.id, ...bundle.evidence.filter(item => item.kind === "PATCH_PROPOSAL").map(item => item.id)];
  return port.persistApproval({ event: approvalEvent, evidenceRefs });
}

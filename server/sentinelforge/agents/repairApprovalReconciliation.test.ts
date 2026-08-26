import { describe, expect, it, vi } from "vitest";
import { reconcileRepairApprovalHistory } from "./repairApprovalReconciliation";
import { orderTrueForgeSessionHistoryChronologically } from "../liveWorkflow";

const tools = "sentinelforge-tools";
const turn = { event: "turn.created", data: { type: "turn.created", turn_id: "turn_1" } } as const;
const call = (name: string, path?: string) => ({ event: "model.message", data: { type: "model.message", tool_calls: [{ function: { name, arguments: JSON.stringify(path ? { path } : {}) }, tool_info: { server_name: tools } }] } });
const pause = { event: "tool.approval_required", data: { type: "tool.approval_required", id: "action_1", created_at: "2026-08-26T00:00:00.000Z", thread_id: "main", tool_calls: [{ id: "call_1", source_event_id: "event_1" }] } } as const;
const done = { event: "turn.done", data: { type: "turn.done" } } as const;
const complete = [turn, call("get_file", "package.json"), call("get_file", "release-manifest.json"), call("repair_proposal_gate"), pause, done];

function makePort(bundle = { mission: { id: "SF_1", status: "PLANNING_FIX" }, approvals: [], evidence: [{ id: "patch_1", kind: "PATCH_PROPOSAL", source: "repair" }], events: [], trueforgeTurns: [] }) {
  const result = { mission: { id: "SF_1", status: "WAITING_APPROVAL" }, approvals: [{ id: "apr_1", actionType: "TRUEFORGE_REPAIR_PROPOSAL_GATE:repair_proposal_gate" }], evidence: bundle.evidence, events: bundle.events, trueforgeTurns: [{ turnId: "turn_1", trueforgeSessionId: "session_1" }] };
  return { getBundle: vi.fn().mockResolvedValue(bundle), recordTurn: vi.fn().mockResolvedValue(undefined), appendStreamAudit: vi.fn().mockResolvedValue(undefined), addProviderEvidence: vi.fn().mockResolvedValue({ id: "provider_1" }), persistApproval: vi.fn().mockResolvedValue(result), finalizeInterruptedCheckpoint: vi.fn().mockResolvedValue(result), result };
}

describe("repair approval remote-history reconciliation", () => {
  it("reconciles terminal history into one durable approval checkpoint", async () => {
    const port = makePort();
    await expect(reconcileRepairApprovalHistory(port, { missionId: "SF_1", sessionId: "session_1", events: complete, toolsMcpName: tools })).resolves.toBe(port.result);
    expect(port.recordTurn).toHaveBeenCalledOnce();
    expect(port.persistApproval).toHaveBeenCalledWith(expect.objectContaining({ event: expect.objectContaining({ type: "tool.approval_required" }), evidenceRefs: ["provider_1", "patch_1"] }));
  });
  it("reconciles an approval pause even when the remote history has no turn.done yet", async () => {
    const port = makePort();
    await expect(reconcileRepairApprovalHistory(port, { missionId: "SF_1", sessionId: "session_1", events: complete.slice(0, -1), toolsMcpName: tools })).resolves.toBe(port.result);
  });
  it("fails closed for unavailable, malformed, or approval-less remote history", async () => {
    const port = makePort();
    await expect(reconcileRepairApprovalHistory(port, { missionId: "SF_1", sessionId: "session_1", events: [], toolsMcpName: tools })).rejects.toThrow(/non-empty/);
    await expect(reconcileRepairApprovalHistory(port, { missionId: "SF_1", sessionId: "session_1", events: complete.slice(0, -2).concat(done), toolsMcpName: tools })).rejects.toThrow(/approval_required/);
    expect(port.recordTurn).not.toHaveBeenCalled();
  });
  it("does not duplicate a fully persisted waiting checkpoint on replay", async () => {
    const bundle = { mission: { id: "SF_1", status: "WAITING_APPROVAL" }, approvals: [{ id: "apr_1", actionType: "TRUEFORGE_REPAIR_PROPOSAL_GATE:repair_proposal_gate" }], evidence: [{ id: "provider_1", kind: "OBSERVED", source: "trueforge/repair-proposal-approval" }], events: [{ eventType: "TRUEFORGE_STREAM_EVENT", correlationId: "turn_1" }], trueforgeTurns: [{ turnId: "turn_1", trueforgeSessionId: "session_1" }] };
    const port = makePort(bundle);
    await expect(reconcileRepairApprovalHistory(port, { missionId: "SF_1", sessionId: "session_1", events: complete, toolsMcpName: tools })).resolves.toBe(bundle);
    expect(port.recordTurn).not.toHaveBeenCalled();
    expect(port.addProviderEvidence).not.toHaveBeenCalled();
    expect(port.appendStreamAudit).not.toHaveBeenCalled();
    expect(port.persistApproval).not.toHaveBeenCalled();
  });
  it("fails closed when a prior approval lacks its matching waiting turn", async () => {
    const port = makePort({ mission: { id: "SF_1", status: "PLANNING_FIX" }, approvals: [{ id: "apr_1", actionType: "TRUEFORGE_REPAIR_PROPOSAL_GATE:repair_proposal_gate" }], evidence: [], events: [], trueforgeTurns: [] });
    await expect(reconcileRepairApprovalHistory(port, { missionId: "SF_1", sessionId: "session_1", events: complete, toolsMcpName: tools })).rejects.toThrow(/without a matching/);
  });
  it("completes an interrupted local checkpoint without creating another approval request", async () => {
    const bundle = { mission: { id: "SF_1", status: "PLANNING_FIX" }, approvals: [{ id: "apr_1", actionType: "TRUEFORGE_REPAIR_PROPOSAL_GATE:repair_proposal_gate" }], evidence: [], events: [], trueforgeTurns: [{ turnId: "turn_1", trueforgeSessionId: "session_1" }] };
    const port = makePort(bundle);
    await expect(reconcileRepairApprovalHistory(port, { missionId: "SF_1", sessionId: "session_1", events: complete, toolsMcpName: tools })).resolves.toBe(port.result);
    expect(port.finalizeInterruptedCheckpoint).toHaveBeenCalledWith({ approvalRequestId: "apr_1", turnId: "turn_1", toolCallId: "call_1" });
    expect(port.persistApproval).not.toHaveBeenCalled();
  });
  it("uses chronological provider history when the remote API returns terminal events first", () => {
    expect(orderTrueForgeSessionHistoryChronologically([...complete].reverse()).map(event => event.event)).toEqual(complete.map(event => event.event));
  });
});

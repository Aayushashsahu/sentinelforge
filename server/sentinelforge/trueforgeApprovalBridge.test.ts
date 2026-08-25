import { describe, expect, it, vi } from "vitest";
import { decideTrueForgeApprovalBridge, resumeStagedTrueForgeApprovalBridge, type ApprovalBridgeRecord, type StoredApprovalContinuation, type TrueForgeApprovalBridgePort } from "./trueforgeApprovalBridge";

const record: ApprovalBridgeRecord = { approvalRequestId: "apr_1", missionId: "SF_1", approvalStatus: "PENDING", expiresAt: Date.now() + 60_000, missionStatus: "WAITING_APPROVAL", trueforgeSessionId: "session_1", turnId: "turn_1", threadId: "thread_1", toolCallId: "call_1", requiredActionId: "action_1" };

function makePort(overrides: Partial<TrueForgeApprovalBridgePort> = {}) {
  let stored: StoredApprovalContinuation | null = null;
  const port: TrueForgeApprovalBridgePort = {
    getApprovalBridgeRecord: vi.fn(async () => record),
    getContinuationByApprovalRequest: vi.fn(async () => stored),
    createContinuation: vi.fn(async input => stored = { id: "cont_1", ...input }),
    decideApprovalIfPending: vi.fn(async () => true),
    setMissionStatus: vi.fn(async () => undefined),
    appendMissionEvent: vi.fn(async () => undefined),
    claimContinuationForSend: vi.fn(async () => true),
    getContinuationById: vi.fn(async () => stored),
    markContinuationSent: vi.fn(async () => { if (stored) stored = { ...stored, status: "SENT" }; }),
    markContinuationFailed: vi.fn(async () => { if (stored) stored = { ...stored, status: "FAILED" }; }),
    sendContinuation: vi.fn(async () => undefined),
    ...overrides,
  };
  return { port, getStored: () => stored };
}

describe("TrueForge approval bridge", () => {
  it("stages an exact allow continuation without remotely resuming it", async () => {
    const { port } = makePort();
    const continuation = await decideTrueForgeApprovalBridge(port, { requestId: "apr_1", approve: true });
    expect(continuation).toMatchObject({ decision: "APPROVED", status: "PENDING_SEND", trueforgeSessionId: "session_1", turnId: "turn_1", payload: { type: "user.tool_approval", thread_id: "thread_1", tool_call_id: "call_1", approval: { status: "allow" } } });
    expect(port.sendContinuation).not.toHaveBeenCalled();
  });

  it("stages a deny continuation and never permits it to resume", async () => {
    const { port } = makePort();
    const continuation = await decideTrueForgeApprovalBridge(port, { requestId: "apr_1", approve: false, denialReason: "outside scope" });
    expect(continuation).toMatchObject({ decision: "REJECTED", status: "NOT_SENT", payload: { approval: { status: "deny", reason: "outside scope" } } });
    await expect(resumeStagedTrueForgeApprovalBridge(port, continuation.id)).rejects.toThrow(/rejected approvals/);
    expect(port.sendContinuation).not.toHaveBeenCalled();
  });

  it("returns the same durable continuation for a duplicate identical approval", async () => {
    const { port } = makePort();
    const first = await decideTrueForgeApprovalBridge(port, { requestId: "apr_1", approve: true });
    const duplicate = await decideTrueForgeApprovalBridge(port, { requestId: "apr_1", approve: true });
    expect(duplicate).toBe(first);
    expect(port.createContinuation).toHaveBeenCalledTimes(1);
  });

  it("fails closed when a concurrent durable record has a different decision", async () => {
    const { port } = makePort({
      createContinuation: vi.fn(async input => ({ id: "cont_1", ...input, decision: "REJECTED" as const, status: "NOT_SENT" as const })),
    });
    await expect(decideTrueForgeApprovalBridge(port, { requestId: "apr_1", approve: true })).rejects.toThrow(/different durable decision/);
    expect(port.sendContinuation).not.toHaveBeenCalled();
  });

  it("refuses stale approvals before staging a continuation", async () => {
    const { port } = makePort({ getApprovalBridgeRecord: vi.fn(async () => ({ ...record, expiresAt: Date.now() - 1 })) });
    await expect(decideTrueForgeApprovalBridge(port, { requestId: "apr_1", approve: true })).rejects.toThrow(/stale/);
    expect(port.createContinuation).not.toHaveBeenCalled();
  });

  it("records a failed explicit resume attempt without creating a duplicate send", async () => {
    const { port } = makePort({ sendContinuation: vi.fn(async () => { throw new Error("runtime unavailable"); }) });
    const continuation = await decideTrueForgeApprovalBridge(port, { requestId: "apr_1", approve: true });
    await expect(resumeStagedTrueForgeApprovalBridge(port, continuation.id)).rejects.toThrow(/runtime unavailable/);
    expect(port.markContinuationFailed).toHaveBeenCalledWith(continuation.id, "runtime unavailable");
    expect(port.sendContinuation).toHaveBeenCalledTimes(1);
  });
});

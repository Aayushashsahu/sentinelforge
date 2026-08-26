import { buildTrueForgeApprovalContinuation } from "./liveContracts";

export type ApprovalBridgeDecision = "APPROVED" | "REJECTED";
export type ApprovalContinuationStatus = "PENDING_SEND" | "SENDING" | "SENT" | "FAILED" | "NOT_SENT";

export type ApprovalBridgeRecord = {
  approvalRequestId: string;
  missionId: string;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  expiresAt: number;
  missionStatus: "WAITING_APPROVAL" | "EXECUTING" | "REJECTED" | string;
  trueforgeSessionId: string;
  turnId: string;
  threadId: string;
  toolCallId: string;
  requiredActionId: string;
};

export type StoredApprovalContinuation = {
  id: string;
  approvalRequestId: string;
  missionId: string;
  decision: ApprovalBridgeDecision;
  status: ApprovalContinuationStatus;
  idempotencyKey: string;
  trueforgeSessionId: string;
  turnId: string;
  threadId: string;
  toolCallId: string;
  payload: { type: "user.tool_approval"; thread_id: string; tool_call_id: string; approval: { status: "allow" } | { status: "deny"; reason?: string } };
};

export type TrueForgeApprovalBridgePort = {
  getApprovalBridgeRecord(requestId: string): Promise<ApprovalBridgeRecord | null>;
  getContinuationByApprovalRequest(requestId: string): Promise<StoredApprovalContinuation | null>;
  createContinuation(input: Omit<StoredApprovalContinuation, "id">): Promise<StoredApprovalContinuation>;
  decideApprovalIfPending(requestId: string, decision: ApprovalBridgeDecision): Promise<boolean>;
  setMissionStatus(missionId: string, status: "EXECUTING" | "REJECTED"): Promise<void>;
  appendMissionEvent(input: { missionId: string; eventType: string; actor: string; correlationId?: string; result: string; payload?: unknown }): Promise<void>;
  claimContinuationForSend(continuationId: string): Promise<boolean>;
  getContinuationById(continuationId: string): Promise<StoredApprovalContinuation | null>;
  markContinuationSent(continuationId: string): Promise<void>;
  markContinuationFailed(continuationId: string, error: string): Promise<void>;
  sendContinuation(input: { trueforgeSessionId: string; previousTurnId: string; payload: StoredApprovalContinuation["payload"] }): Promise<void>;
};

function sanitizeBridgeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "TrueForge continuation failed.";
  return message.replace(/https?:\/\/[^\s,\])]+/g, "[REDACTED_URL]").slice(0, 1_000);
}

function continuationIdempotencyKey(record: ApprovalBridgeRecord, decision: ApprovalBridgeDecision): string {
  return `trueforge-approval:${record.approvalRequestId}:${record.requiredActionId}:${decision.toLowerCase()}`;
}

export async function decideTrueForgeApprovalBridge(port: TrueForgeApprovalBridgePort, input: { requestId: string; approve: boolean; denialReason?: string; now?: number }): Promise<StoredApprovalContinuation> {
  const record = await port.getApprovalBridgeRecord(input.requestId);
  if (!record) throw new Error("TrueForge approval bridge request was not found.");
  const decision: ApprovalBridgeDecision = input.approve ? "APPROVED" : "REJECTED";
  const existing = await port.getContinuationByApprovalRequest(record.approvalRequestId);
  if (existing) {
    if (existing.decision !== decision) throw new Error("TrueForge approval bridge refused: a different durable decision already exists.");
    if (decision === "APPROVED" && record.approvalStatus === "APPROVED" && record.missionStatus === "WAITING_APPROVAL") {
      await port.setMissionStatus(record.missionId, "EXECUTING");
      await port.appendMissionEvent({ missionId: record.missionId, eventType: "TRUEFORGE_APPROVAL_ACCEPTED", actor: "operator", correlationId: record.toolCallId, result: "Previously staged approval was recovered as ready for its explicitly authorized continuation. No remote continuation has been sent.", payload: { continuationId: existing.id, idempotencyKey: existing.idempotencyKey } });
    }
    return existing;
  }
  if (record.missionStatus !== "WAITING_APPROVAL" || record.approvalStatus !== "PENDING" || record.expiresAt <= (input.now ?? Date.now())) {
    throw new Error("TrueForge approval bridge refused: approval is stale, already decided, expired, or mission is not waiting.");
  }
  const payload = buildTrueForgeApprovalContinuation({
    threadId: record.threadId,
    toolCallId: record.toolCallId,
    approve: input.approve,
    ...(input.approve ? {} : { denialReason: input.denialReason ?? "Operator rejected the requested TrueForge tool action." }),
  });
  const continuation = await port.createContinuation({
    approvalRequestId: record.approvalRequestId,
    missionId: record.missionId,
    decision,
    status: input.approve ? "PENDING_SEND" : "NOT_SENT",
    idempotencyKey: continuationIdempotencyKey(record, decision),
    trueforgeSessionId: record.trueforgeSessionId,
    turnId: record.turnId,
    threadId: record.threadId,
    toolCallId: record.toolCallId,
    payload,
  });
  if (continuation.decision !== decision) {
    throw new Error("TrueForge approval bridge refused: a different durable decision already exists.");
  }
  if (!(await port.decideApprovalIfPending(record.approvalRequestId, decision))) {
    throw new Error("TrueForge approval bridge refused: approval changed while the continuation was being staged.");
  }
  if (input.approve) {
    await port.setMissionStatus(record.missionId, "EXECUTING");
    await port.appendMissionEvent({ missionId: record.missionId, eventType: "TRUEFORGE_APPROVAL_ACCEPTED", actor: "operator", correlationId: record.toolCallId, result: "Approval accepted and an exact continuation payload was staged. No remote continuation has been sent.", payload: { continuationId: continuation.id, idempotencyKey: continuation.idempotencyKey } });
  } else {
    await port.setMissionStatus(record.missionId, "REJECTED");
    await port.appendMissionEvent({ missionId: record.missionId, eventType: "TRUEFORGE_APPROVAL_REJECTED", actor: "operator", correlationId: record.toolCallId, result: "Approval rejected. A deny continuation payload was persisted but no remote continuation or underlying tool execution was sent.", payload: { continuationId: continuation.id } });
  }
  return continuation;
}

export async function resumeStagedTrueForgeApprovalBridge(port: TrueForgeApprovalBridgePort, continuationId: string): Promise<StoredApprovalContinuation> {
  const continuation = await port.getContinuationById(continuationId);
  if (!continuation) throw new Error("TrueForge continuation was not found.");
  if (continuation.decision !== "APPROVED") throw new Error("TrueForge continuation refused: rejected approvals are never resumed.");
  if (continuation.status === "SENT") return continuation;
  if (continuation.status !== "PENDING_SEND") throw new Error("TrueForge continuation refused: it is not pending an explicit send.");
  if (!(await port.claimContinuationForSend(continuation.id))) {
    const current = await port.getContinuationById(continuation.id);
    if (current?.status === "SENT") return current;
    throw new Error("TrueForge continuation refused: another attempt is already in progress or the continuation state changed.");
  }
  try {
    await port.sendContinuation({ trueforgeSessionId: continuation.trueforgeSessionId, previousTurnId: continuation.turnId, payload: continuation.payload });
    await port.markContinuationSent(continuation.id);
    await port.appendMissionEvent({ missionId: continuation.missionId, eventType: "TRUEFORGE_CONTINUATION_SENT", actor: "SentinelForge", correlationId: continuation.toolCallId, result: "An explicitly authorized TrueForge approval continuation was submitted." });
  } catch (error) {
    const detail = sanitizeBridgeError(error);
    await port.markContinuationFailed(continuation.id, detail);
    await port.appendMissionEvent({ missionId: continuation.missionId, eventType: "TRUEFORGE_CONTINUATION_FAILED", actor: "SentinelForge", correlationId: continuation.toolCallId, result: detail });
    throw error;
  }
  return (await port.getContinuationById(continuation.id)) ?? { ...continuation, status: "SENT" };
}

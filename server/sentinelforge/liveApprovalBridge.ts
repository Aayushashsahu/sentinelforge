import { appendMissionEvent, claimApprovalContinuationForSend, createApprovalContinuation, decideApprovalIfPending, getApprovalContinuationByApprovalRequest, getApprovalContinuationById, getTrueForgeApprovalBridgeRecord, markApprovalContinuationFailed, markApprovalContinuationSent, setMissionStatus } from "./repository";
import { getTrueForgeRuntimeConfig, TrueForgeClient } from "./trueforge/client";
import { readTrueForgeSse } from "./trueforge/stream";
import { decideTrueForgeApprovalBridge, resumeStagedTrueForgeApprovalBridge, type StoredApprovalContinuation, type TrueForgeApprovalBridgePort } from "./trueforgeApprovalBridge";

async function sendTrueForgeApprovalContinuation(input: { trueforgeSessionId: string; previousTurnId: string; payload: StoredApprovalContinuation["payload"] }): Promise<void> {
  const client = new TrueForgeClient(getTrueForgeRuntimeConfig());
  const response = await client.createTurnStream({ sessionId: input.trueforgeSessionId, previousTurnId: input.previousTurnId, input: [input.payload] });
  await readTrueForgeSse(response);
}

const bridgePort: TrueForgeApprovalBridgePort = {
  getApprovalBridgeRecord: getTrueForgeApprovalBridgeRecord,
  getContinuationByApprovalRequest: getApprovalContinuationByApprovalRequest,
  createContinuation: createApprovalContinuation,
  decideApprovalIfPending,
  setMissionStatus,
  appendMissionEvent: async input => { await appendMissionEvent(input); },
  claimContinuationForSend: claimApprovalContinuationForSend,
  getContinuationById: getApprovalContinuationById,
  markContinuationSent: markApprovalContinuationSent,
  markContinuationFailed: markApprovalContinuationFailed,
  sendContinuation: sendTrueForgeApprovalContinuation,
};

export function stageLiveTrueForgeApprovalDecision(input: { requestId: string; approve: boolean; denialReason?: string }) {
  return decideTrueForgeApprovalBridge(bridgePort, input);
}

/**
 * This sender deliberately has no public procedure. Calling it performs a real provider continuation and therefore
 * requires an independent future authorization after the staged approval is reviewed.
 */
export function resumeLiveTrueForgeApprovalDecision(continuationId: string) {
  return resumeStagedTrueForgeApprovalBridge(bridgePort, continuationId);
}

import { buildFixtureProofApprovalMessage, buildFixtureProofApprovalSpec, FIXTURE_GITHUB_PR_GATE_TOOL_NAME } from "./agents/fixtureProofApproval";
import { validateFixtureProofApprovalCaptureSequence } from "./agents/fixtureProofApprovalSequence";
import { bindFixtureProofApprovalCheckpoint, bindFixtureProofReadEvidenceCorrelation } from "./liveFixtureProof";
import { buildStreamAuditInputs, readBoundedTurn } from "./liveWorkflow";
import { mapTrueForgeProviderApprovalPause } from "./liveApprovalWorkflow";
import { addApprovalRequest, addEvidence, appendMissionEvent, appendMissionEvents, claimFixtureProofExternalActionForExecution, getFixtureProofExternalAction, getMissionBundle, getTrueForgeTurnByMission, linkTrueForgeSession, recordTrueForgeTurn, replaceFixtureProofExternalAction, setMissionStatus, updateFixtureProofExternalAction, updateTrueForgeTurn } from "./repository";
import { persistTrueForgeFixtureProofApprovalRequired } from "./trueforgeApproval";
import { fixtureProofFingerprint } from "./fixtureGithubProof";
import { acquireFixtureProofServerEvidence } from "./fixtureProofServerEvidence";
import { buildFixtureProviderHistoryAuditInputs, normalizeFixtureProviderHistory } from "./fixtureProviderHistoryNormalization";
import { getTrueForgeRuntimeConfig, TrueForgeClient } from "./trueforge/client";
import { notifyOwner } from "../_core/notification";

export const FIXTURE_PROOF_PROVIDER_EVIDENCE_SOURCE = "PROVIDER";
export const FIXTURE_PROOF_PROVIDER_APPROVAL_TITLE = "TrueForge provider fixture-gate approval-required event";
export const FIXTURE_PROOF_PROVIDER_APPROVAL_CONTENT = "Server-orchestrated fixture evidence had already verified package.json version 1.4.0 and release-manifest.json version 1.3.0. The provider then invoked fixture_github_pr_gate and emitted a genuine tool.approval_required event. No provider MCP file read, fabricated tool event, continuation, or GitHub write occurred.";

export async function runLiveFixtureProofApprovalCapture(input: { missionId: string; actionId: string }) {
  const bundle = await getMissionBundle(input.missionId);
  const action = await getFixtureProofExternalAction(input.actionId);
  if (!bundle || !action || bundle.mission.status !== "PLANNING_FIX" || action.status !== "AWAITING_APPROVAL") throw new Error("Fixture proof approval capture requires one persisted planning mission and its awaiting-approval staged action.");
  const config = getTrueForgeRuntimeConfig();
  const client = new TrueForgeClient(config);
  const expectedFingerprint = fixtureProofFingerprint({ summary: bundle.mission.repairSummary, patch: bundle.mission.patch ?? "" });
  if (action.intent.proposalFingerprint !== expectedFingerprint) throw new Error("Fixture proof approval capture refused: staged action fingerprint does not match the persisted proposal.");
  await acquireFixtureProofServerEvidence({
    missionId: input.missionId,
    actionId: input.actionId,
    port: {
      getMissionBundle,
      getAction: getFixtureProofExternalAction,
      replaceAction: replaceFixtureProofExternalAction,
      appendAudit: async audit => { await appendMissionEvent({ missionId: audit.missionId, eventType: audit.eventType, actor: "SentinelForge", correlationId: audit.correlationId, result: audit.result, payload: audit.payload }); },
    },
  });
  const resolvedModel = await client.resolveModelName(config.model);
  const session = await client.createInlineSession(buildFixtureProofApprovalSpec({ model: resolvedModel, toolsMcpName: config.toolsMcpName }));
  await linkTrueForgeSession({ missionId: input.missionId, sessionId: session.id, baseUrl: config.baseUrl, model: resolvedModel, status: "FIXTURE_PROOF_APPROVAL_CAPTURE" });
  await appendMissionEvent({ missionId: input.missionId, eventType: "TRUEFORGE_FIXTURE_PROOF_APPROVAL_SESSION_CREATED", actor: "TrueForge", correlationId: session.id, tool: `mcp:${config.toolsMcpName}/${FIXTURE_GITHUB_PR_GATE_TOOL_NAME}`, result: "A fixture-proof approval-capture session was created with only the non-mutating provider fixture gate. Mandatory package and manifest evidence remains server-orchestrated; sandbox and GitHub writes are disabled.", payload: { actionId: action.id, mcpServer: config.toolsMcpName, providerTool: FIXTURE_GITHUB_PR_GATE_TOOL_NAME, serverEvidenceRequired: true, sandbox: "disabled", continuation: "forbidden" } });
  const rawEvents = await readBoundedTurn({ client, sessionId: session.id, message: buildFixtureProofApprovalMessage({ missionId: input.missionId, actionId: action.id }) });
  const normalizedEvents = normalizeFixtureProviderHistory({ events: rawEvents, sessionId: session.id });
  const { pause, turnId, gateToolCallId, threadId, rawGateCallCount, canonicalGateCallCount, rawApprovalPauseCount, canonicalApprovalPauseCount } = validateFixtureProofApprovalCaptureSequence(normalizedEvents, config.toolsMcpName, await getFixtureProofExternalAction(input.actionId) ?? action, session.id);
  const approvalEvent = mapTrueForgeProviderApprovalPause({ providerEvent: pause, toolName: FIXTURE_GITHUB_PR_GATE_TOOL_NAME });
  const serverEvidencedAction = await getFixtureProofExternalAction(action.id);
  if (!serverEvidencedAction) throw new Error("Fixture proof approval capture refused: server-side read evidence action is unavailable.");
  const evidencedAction = bindFixtureProofReadEvidenceCorrelation({ action: serverEvidencedAction, trueforgeSessionId: session.id, turnId, threadId, gateToolCallId });
  await replaceFixtureProofExternalAction(evidencedAction);
  await recordTrueForgeTurn({ missionId: input.missionId, trueforgeSessionId: session.id, turnId, status: "WAITING_APPROVAL", threadId: pause.thread_id, requiredActionId: pause.id, toolCallId: pause.tool_calls[0]!.id });
  await appendMissionEvents(buildFixtureProviderHistoryAuditInputs({ missionId: input.missionId, turnId, rawEvents, normalizedEvents }));
  await appendMissionEvent({ missionId: input.missionId, eventType: "FIXTURE_PROOF_CANONICAL_PROVIDER_HISTORY", actor: "SentinelForge", correlationId: action.id, result: "Raw provider history was normalized using documented session-event envelope turn context and capture-session context before strict approval validation. Thread, tool-call, required-action, and source-event correlation remained raw provider data.", payload: { sessionId: session.id, turnId, threadId, gateToolCallId, requiredActionId: pause.id, rawGateCallCount, canonicalGateCallCount, rawApprovalPauseCount, canonicalApprovalPauseCount } });
  const providerEvidence = await addEvidence({ missionId: input.missionId, kind: "OBSERVED", title: FIXTURE_PROOF_PROVIDER_APPROVAL_TITLE, content: FIXTURE_PROOF_PROVIDER_APPROVAL_CONTENT, source: FIXTURE_PROOF_PROVIDER_EVIDENCE_SOURCE });
  const persisted = await persistTrueForgeFixtureProofApprovalRequired({
    getMission: async id => { const current = await getMissionBundle(id); return current ? { id: current.mission.id, status: current.mission.status } : null; },
    getLatestTrueForgeTurn: async id => { const turn = await getTrueForgeTurnByMission(id); return turn ? { turnId: turn.turnId, trueforgeSessionId: turn.trueforgeSessionId } : null; },
    addApprovalRequest,
    updateTrueForgeTurn,
    setMissionStatus,
    appendMissionEvent,
    notifyOwner,
    getMissionBundle,
    getFixtureProofAction: getFixtureProofExternalAction,
  }, { missionId: input.missionId, event: approvalEvent, risk: bundle.mission.risk, repairFingerprint: expectedFingerprint, proofActionId: action.id, proposalEvidenceRefs: [providerEvidence.id] });
  if (!persisted) throw new Error("Fixture proof approval capture persisted no mission bundle.");
  const approval = persisted.approvals.find(item => item.actionType === `TRUEFORGE_FIXTURE_GITHUB_PR_GATE:${FIXTURE_GITHUB_PR_GATE_TOOL_NAME}` && item.status === "PENDING");
  if (!approval) throw new Error("Fixture proof approval capture persisted no pending approval request.");
  await bindFixtureProofApprovalCheckpoint({
    action: evidencedAction,
    approval: { approvalRequestId: approval.id, trueforgeSessionId: session.id, turnId, threadId: approvalEvent.thread_id, toolCallId: approvalEvent.tool_call_id, requiredActionId: approvalEvent.required_action_id ?? pause.id },
    port: { getMissionBundle, getAction: getFixtureProofExternalAction, claimActionForExecution: claimFixtureProofExternalActionForExecution, updateAction: updateFixtureProofExternalAction, stageAction: async value => value, replaceAction: replaceFixtureProofExternalAction, appendAudit: async audit => { await appendMissionEvent({ missionId: audit.missionId, eventType: audit.eventType, actor: "SentinelForge", correlationId: audit.correlationId, result: audit.result, payload: audit.payload }); } },
  });
  return getMissionBundle(input.missionId);
}

import { buildFixtureProofApprovalMessage, buildFixtureProofApprovalSpec, FIXTURE_GITHUB_PR_GATE_TOOL_NAME } from "./agents/fixtureProofApproval";
import { validateFixtureProofApprovalCaptureSequence } from "./agents/fixtureProofApprovalSequence";
import { bindFixtureProofApprovalCheckpoint, bindFixtureProofReadEvidenceCorrelation } from "./liveFixtureProof";
import { buildStreamAuditInputs, readBoundedTurn } from "./liveWorkflow";
import { mapTrueForgeProviderApprovalPause } from "./liveApprovalWorkflow";
import { addApprovalRequest, addEvidence, appendMissionEvent, appendMissionEvents, claimFixtureProofExternalActionForExecution, getFixtureProofExternalAction, getMissionBundle, getTrueForgeTurnByMission, linkTrueForgeSession, recordTrueForgeTurn, replaceFixtureProofExternalAction, setMissionStatus, updateFixtureProofExternalAction, updateTrueForgeTurn } from "./repository";
import { persistTrueForgeFixtureProofApprovalRequired } from "./trueforgeApproval";
import { fixtureProofFingerprint } from "./fixtureGithubProof";
import { getTrueForgeRuntimeConfig, TrueForgeClient } from "./trueforge/client";
import { notifyOwner } from "../_core/notification";

export async function runLiveFixtureProofApprovalCapture(input: { missionId: string; actionId: string }) {
  const bundle = await getMissionBundle(input.missionId);
  const action = await getFixtureProofExternalAction(input.actionId);
  if (!bundle || !action || bundle.mission.status !== "PLANNING_FIX" || action.status !== "AWAITING_APPROVAL") throw new Error("Fixture proof approval capture requires one persisted planning mission and its awaiting-approval staged action.");
  const config = getTrueForgeRuntimeConfig();
  const client = new TrueForgeClient(config);
  const expectedFingerprint = fixtureProofFingerprint({ summary: bundle.mission.repairSummary, patch: bundle.mission.patch ?? "" });
  if (action.intent.proposalFingerprint !== expectedFingerprint) throw new Error("Fixture proof approval capture refused: staged action fingerprint does not match the persisted proposal.");
  const resolvedModel = await client.resolveModelName(config.model);
  const session = await client.createInlineSession(buildFixtureProofApprovalSpec({ model: resolvedModel, toolsMcpName: config.toolsMcpName }));
  await linkTrueForgeSession({ missionId: input.missionId, sessionId: session.id, baseUrl: config.baseUrl, model: resolvedModel, status: "FIXTURE_PROOF_APPROVAL_CAPTURE" });
  await appendMissionEvent({ missionId: input.missionId, eventType: "TRUEFORGE_FIXTURE_PROOF_APPROVAL_SESSION_CREATED", actor: "TrueForge", correlationId: session.id, tool: `mcp:${config.toolsMcpName}/${FIXTURE_GITHUB_PR_GATE_TOOL_NAME}`, result: "A fixture-proof approval-capture session was created with only read tools and the non-mutating approval gate. Sandbox and GitHub writes are disabled.", payload: { actionId: action.id, mcpServer: config.toolsMcpName, sandbox: "disabled", continuation: "forbidden" } });
  const events = await readBoundedTurn({ client, sessionId: session.id, message: buildFixtureProofApprovalMessage({ missionId: input.missionId, actionId: action.id }) });
  const { pause, turnId, packageToolCallId, manifestToolCallId, gateToolCallId, threadId } = validateFixtureProofApprovalCaptureSequence(events, config.toolsMcpName, action);
  const approvalEvent = mapTrueForgeProviderApprovalPause({ providerEvent: pause, toolName: FIXTURE_GITHUB_PR_GATE_TOOL_NAME });
  const serverEvidencedAction = await getFixtureProofExternalAction(action.id);
  if (!serverEvidencedAction) throw new Error("Fixture proof approval capture refused: server-side read evidence action is unavailable.");
  const evidencedAction = bindFixtureProofReadEvidenceCorrelation({ action: serverEvidencedAction, trueforgeSessionId: session.id, turnId, threadId, packageToolCallId, manifestToolCallId, gateToolCallId });
  await replaceFixtureProofExternalAction(evidencedAction);
  await recordTrueForgeTurn({ missionId: input.missionId, trueforgeSessionId: session.id, turnId, status: "WAITING_APPROVAL", threadId: pause.thread_id, requiredActionId: pause.id, toolCallId: pause.tool_calls[0]!.id });
  await appendMissionEvents(buildStreamAuditInputs({ missionId: input.missionId, turnId, events }));
  const providerEvidence = await addEvidence({ missionId: input.missionId, kind: "OBSERVED", title: "TrueForge fixture-proof approval-required provider event", content: "The runtime emitted fixture_github_pr_gate tool.approval_required after the required package.json and release-manifest.json read calls. No continuation or GitHub write occurred.", source: "trueforge/fixture-proof-approval" });
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

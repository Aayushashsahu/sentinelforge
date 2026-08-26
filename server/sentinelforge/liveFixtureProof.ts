import { nanoid } from "nanoid";
import { executeApprovedFixtureProof, fixtureProofFingerprint, readFixtureProofPreflight, type FixtureProofAction, type FixtureProofGitHubPort, type FixtureProofPersistencePort, buildFixtureProofIntent } from "./fixtureGithubProof";

type FixtureProofStagePort = FixtureProofPersistencePort & {
  getMissionBundle(missionId: string): Promise<{ mission: { id: string; status: string; repository: string; repairSummary: string | null; patch: string | null }; actions: Array<{ actionType: string }> } | null>;
  stageAction(action: FixtureProofAction): Promise<FixtureProofAction>;
  replaceAction(action: FixtureProofAction): Promise<void>;
};

export async function stageLiveFixtureProofAction(input: { missionId: string; github: FixtureProofGitHubPort; port: FixtureProofStagePort }): Promise<FixtureProofAction> {
  const bundle = await input.port.getMissionBundle(input.missionId);
  if (!bundle) throw new Error("Fixture proof refused: mission was not found.");
  if (bundle.mission.repository !== "Aayushashsahu/sentinelforge-incident-fixture") throw new Error("Fixture proof refused: mission repository is not the participant-designated fixture repository.");
  if (bundle.mission.status !== "PLANNING_FIX") throw new Error("Fixture proof refused: only a persisted planning-stage proposal may be staged for approval.");
  if (!bundle.mission.patch?.includes("release-manifest.json") || !bundle.mission.patch.includes('"1.3.0"') || !bundle.mission.patch.includes('"1.4.0"')) throw new Error("Fixture proof refused: mission does not contain the exact evidenced release-manifest repair proposal.");
  if (bundle.actions.some(action => action.actionType === "FIXTURE_GITHUB_PULL_REQUEST_PROOF")) throw new Error("Fixture proof refused: the mission already has a fixture proof action record.");
  const proposalFingerprint = fixtureProofFingerprint({ summary: bundle.mission.repairSummary, patch: bundle.mission.patch });
  const intent = buildFixtureProofIntent({ missionId: bundle.mission.id, proposalFingerprint });
  const preflight = await readFixtureProofPreflight(input.github, intent);
  const action: FixtureProofAction = {
    id: `act_${nanoid(14)}`,
    missionId: bundle.mission.id,
    status: "AWAITING_APPROVAL",
    intent,
    preflight,
    approval: { approvalRequestId: null, trueforgeSessionId: null, turnId: null, threadId: null, toolCallId: null, requiredActionId: null, continuationId: null, continuationStatus: "NOT_SENT" },
    remote: {},
  };
  const staged = await input.port.stageAction(action);
  await input.port.appendAudit({ missionId: action.missionId, eventType: "FIXTURE_GITHUB_PROOF_STAGED", correlationId: action.id, result: "A fixture-only GitHub proof action was persisted with exact target, file, content SHA, base SHA, branch, and idempotency data. No provider approval, continuation, or GitHub mutation has occurred.", payload: { actionId: action.id, target: intent.repository, base: intent.baseBranch, file: intent.filePath, branchName: intent.branchName, proposalFingerprint: intent.proposalFingerprint } });
  return staged;
}

export async function bindFixtureProofApprovalCheckpoint(input: { action: FixtureProofAction; approval: { approvalRequestId: string; trueforgeSessionId: string; turnId: string; threadId: string; toolCallId: string; requiredActionId: string }; port: FixtureProofStagePort }): Promise<FixtureProofAction> {
  if (input.action.status !== "AWAITING_APPROVAL") throw new Error("Fixture proof refused: action was not awaiting a genuine approval checkpoint.");
  const action = { ...input.action, status: "WAITING_APPROVAL" as const, approval: { ...input.approval, continuationId: null, continuationStatus: "NOT_SENT" as const } };
  await input.port.replaceAction(action);
  await input.port.appendAudit({ missionId: action.missionId, eventType: "FIXTURE_GITHUB_PROOF_WAITING_APPROVAL", correlationId: action.id, result: "The exact fixture proof action is bound to a genuine provider approval checkpoint and remains paused with no continuation or GitHub mutation.", payload: { actionId: action.id, approvalRequestId: action.approval.approvalRequestId, turnId: action.approval.turnId, threadId: action.approval.threadId, toolCallId: action.approval.toolCallId, requiredActionId: action.approval.requiredActionId } });
  return action;
}

export async function bindSentFixtureProofContinuation(input: { action: FixtureProofAction; continuation: { id: string; status: "SENT"; approvalRequestId: string; trueforgeSessionId: string; turnId: string; threadId: string; toolCallId: string }; port: FixtureProofStagePort }): Promise<FixtureProofAction> {
  if (input.action.status !== "WAITING_APPROVAL") throw new Error("Fixture proof refused: action is not paused for approval.");
  const approval = input.action.approval;
  if (approval.approvalRequestId !== input.continuation.approvalRequestId || approval.trueforgeSessionId !== input.continuation.trueforgeSessionId || approval.turnId !== input.continuation.turnId || approval.threadId !== input.continuation.threadId || approval.toolCallId !== input.continuation.toolCallId) throw new Error("Fixture proof refused: continuation correlation differs from the persisted approval checkpoint.");
  const action = { ...input.action, status: "STAGED" as const, approval: { ...approval, continuationId: input.continuation.id, continuationStatus: "SENT" as const } };
  await input.port.replaceAction(action);
  await input.port.appendAudit({ missionId: action.missionId, eventType: "FIXTURE_GITHUB_PROOF_CONTINUATION_SENT", correlationId: action.id, result: "The exact persisted same-turn approval continuation is sent; the staged fixture proof is now eligible for its one bounded execution attempt.", payload: { actionId: action.id, continuationId: input.continuation.id } });
  return action;
}

export async function executeLiveFixtureProof(input: { actionId: string; github: FixtureProofGitHubPort; port: FixtureProofStagePort }): Promise<FixtureProofAction> {
  return executeApprovedFixtureProof({ github: input.github, persistence: input.port, actionId: input.actionId });
}

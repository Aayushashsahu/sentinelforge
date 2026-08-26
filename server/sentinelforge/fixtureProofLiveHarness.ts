import { GitHubFixtureWriteApi } from "./githubFixtureWrite";
import { GitHubWriteCapabilityPolicy, type GitHubObservedWriteCapabilityEvidence } from "./githubWriteCapability";
import { executeLiveFixtureProof, bindSentFixtureProofContinuation, stageLiveFixtureProofAction } from "./liveFixtureProof";
import { runLiveFixtureProofApprovalCapture } from "./liveFixtureProofCapture";
import { createLiveMission, investigateLiveMission, runLiveRepairPlan } from "./liveWorkflow";
import { resumeLiveTrueForgeApprovalDecision, stageLiveTrueForgeApprovalDecision } from "./liveApprovalBridge";
import { appendMissionEvent, claimFixtureProofExternalActionForExecution, getFixtureProofExternalAction, getMissionBundle, replaceFixtureProofExternalAction, stageFixtureProofExternalAction, updateFixtureProofExternalAction } from "./repository";

export const LIVE_FIXTURE_PROOF_OWNER = "Aayushashsahu";
export const LIVE_FIXTURE_PROOF_REPO = "sentinelforge-incident-fixture";
const liveTarget = `${LIVE_FIXTURE_PROOF_OWNER}/${LIVE_FIXTURE_PROOF_REPO}`;

type Environment = Record<string, string | undefined>;
export type LiveFixtureProofHarnessConfig = { token: string; owner: typeof LIVE_FIXTURE_PROOF_OWNER; repo: typeof LIVE_FIXTURE_PROOF_REPO; writeCapabilityEvidence: GitHubObservedWriteCapabilityEvidence[] };

export function parseLiveFixtureProofHarnessConfig(env: Environment): LiveFixtureProofHarnessConfig {
  const token = env.GITHUB_SCRATCH_PR_TOKEN?.trim();
  if (!token) throw new Error("Live fixture proof requires GITHUB_SCRATCH_PR_TOKEN from the explicit secure environment.");
  if (env.GITHUB_SCRATCH_OWNER !== LIVE_FIXTURE_PROOF_OWNER) throw new Error("Live fixture proof refused: GITHUB_SCRATCH_OWNER is not the exact fixture allowlist owner.");
  if (env.GITHUB_SCRATCH_REPO !== LIVE_FIXTURE_PROOF_REPO) throw new Error("Live fixture proof refused: GITHUB_SCRATCH_REPO is not the exact fixture allowlist repository.");
  const rawEvidence = env.GITHUB_SCRATCH_WRITE_CAPABILITY_EVIDENCE?.trim();
  if (!rawEvidence) throw new Error("Live fixture proof refused: no independently established write-capability evidence was supplied.");
  let writeCapabilityEvidence: unknown;
  try { writeCapabilityEvidence = JSON.parse(rawEvidence); } catch { throw new Error("Live fixture proof refused: write-capability evidence is not valid JSON."); }
  if (!Array.isArray(writeCapabilityEvidence)) throw new Error("Live fixture proof refused: write-capability evidence must be an array of response-shaped observations.");
  return { token, owner: LIVE_FIXTURE_PROOF_OWNER, repo: LIVE_FIXTURE_PROOF_REPO, writeCapabilityEvidence: writeCapabilityEvidence as GitHubObservedWriteCapabilityEvidence[] };
}

function fixturePort() {
  return {
    getMissionBundle,
    getAction: getFixtureProofExternalAction,
    claimActionForExecution: claimFixtureProofExternalActionForExecution,
    updateAction: updateFixtureProofExternalAction,
    stageAction: stageFixtureProofExternalAction,
    replaceAction: replaceFixtureProofExternalAction,
    appendAudit: async (audit: { missionId: string; eventType: string; correlationId: string; result: string; payload: Record<string, unknown> }) => { await appendMissionEvent({ missionId: audit.missionId, eventType: audit.eventType, actor: "SentinelForge", correlationId: audit.correlationId, result: audit.result, payload: audit.payload }); },
  };
}

export async function runLiveFixtureProofHarness(config: LiveFixtureProofHarnessConfig) {
  const github = new GitHubFixtureWriteApi(config.token, fetch, new GitHubWriteCapabilityPolicy(config.writeCapabilityEvidence));
  const created = await createLiveMission({ title: "Opt-in fixture GitHub proof", repository: liveTarget, incident: "Authoritative package version 1.4.0 differs from release-manifest version 1.3.0.", risk: "LOW" });
  if (!created) throw new Error("Live fixture proof refused: mission creation returned no persisted mission.");
  const investigated = await investigateLiveMission(created.mission.id);
  if (!investigated || investigated.mission.status !== "PLANNING_FIX") throw new Error("Live fixture proof refused: Investigator did not persist a planning-stage fixture mission.");
  const proposed = await runLiveRepairPlan(created.mission.id);
  if (!proposed?.mission.patch || proposed.mission.status !== "PLANNING_FIX") throw new Error("Live fixture proof refused: Repair Engineer did not persist an exact un-applied proposal.");
  const action = await stageLiveFixtureProofAction({ missionId: created.mission.id, github, port: fixturePort() });
  const paused = await runLiveFixtureProofApprovalCapture({ missionId: created.mission.id, actionId: action.id });
  const pausedAction = await getFixtureProofExternalAction(action.id);
  const approval = paused?.approvals.find(item => item.id === pausedAction?.approval.approvalRequestId && item.status === "PENDING");
  if (!approval) throw new Error("Live fixture proof refused: fixture approval checkpoint is missing or not pending.");
  const stagedContinuation = await stageLiveTrueForgeApprovalDecision({ requestId: approval.id, approve: true });
  const sentContinuation = await resumeLiveTrueForgeApprovalDecision(stagedContinuation.id);
  const waitingAction = await getFixtureProofExternalAction(action.id);
  if (!waitingAction || sentContinuation.status !== "SENT") throw new Error("Live fixture proof refused: approved continuation was not sent or action was not persisted.");
  const executable = await bindSentFixtureProofContinuation({ action: waitingAction, continuation: { id: sentContinuation.id, status: "SENT", approvalRequestId: sentContinuation.approvalRequestId, trueforgeSessionId: sentContinuation.trueforgeSessionId, turnId: sentContinuation.turnId, threadId: sentContinuation.threadId, toolCallId: sentContinuation.toolCallId }, port: fixturePort() });
  const completed = await executeLiveFixtureProof({ actionId: executable.id, github, port: fixturePort() });
  if (completed.status !== "PR_CREATED" || !completed.remote.branchSha || !completed.remote.commitSha || !completed.remote.pullRequestNumber || !completed.remote.pullRequestUrl) throw new Error("Live fixture proof did not verify exactly one branch, commit, and open pull request.");
  return { missionId: created.mission.id, action: completed };
}

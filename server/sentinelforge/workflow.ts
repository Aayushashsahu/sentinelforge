import { notifyOwner } from "../_core/notification";
import { fixtureIncident, investigatorResult, repairProposal, runFixtureVerification } from "./fixture";
import { addApprovalRequest, addEvidence, addSandboxRun, appendMissionEvent, countExternalActions, createMission, createSimulatedExternalAction, decideApproval, getApprovalWithMission, getMissionBundle, setMissionStatus } from "./repository";
import { resolvePersistedApproval } from "./approvalWorkflow";

export async function launchDeterministicFixtureMission() {
  const mission = await createMission({ ...fixtureIncident, risk: "LOW" });
  await setMissionStatus(mission.id, "INVESTIGATING");
  await appendMissionEvent({ missionId: mission.id, eventType: "INVESTIGATION_STARTED", actor: "TrueForge adapter", tool: "fixture-investigator", result: "Investigator received a deterministic CI incident and bounded fixture evidence." });
  const investigationEvidence = await addEvidence({ missionId: mission.id, kind: "INVESTIGATION", title: "Version drift detected", content: investigatorResult.finding, source: "fixtures/broken-repo" });
  await addEvidence({ missionId: mission.id, kind: "ROOT_CAUSE", title: "Root cause", content: investigatorResult.rootCause, source: "fixture-investigator" });
  await appendMissionEvent({ missionId: mission.id, eventType: "ROOT_CAUSE_IDENTIFIED", actor: "Investigator", result: investigatorResult.rootCause, evidenceRefs: [investigationEvidence.id] });
  await setMissionStatus(mission.id, "PLANNING_FIX");
  const patchEvidence = await addEvidence({ missionId: mission.id, kind: "PATCH", title: "Minimal repair proposal", content: repairProposal.patch, source: "fixture-repair-engineer" });
  await appendMissionEvent({ missionId: mission.id, eventType: "REPAIR_PROPOSED", actor: "Repair Engineer", result: repairProposal.summary, evidenceRefs: [patchEvidence.id] });
  await setMissionStatus(mission.id, "VERIFYING", { rootCause: investigatorResult.rootCause, repairSummary: repairProposal.summary, patch: repairProposal.patch });
  await appendMissionEvent({ missionId: mission.id, eventType: "VERIFICATION_STARTED", actor: "TrueForge adapter", tool: "fixture-isolation", result: "Starting deterministic no-shell verification with a 90ms hard timeout." });
  const verification = await runFixtureVerification();
  const sandboxRun = await addSandboxRun({ missionId: mission.id, status: verification.result.status, runner: "fixture-isolation/no-shell", command: "release-check :: package.version === manifest.version", stdout: verification.stdout, stderr: verification.stderr, exitCode: verification.exitCode, durationMs: verification.durationMs, timedOut: verification.timedOut });
  const verificationEvidence = await addEvidence({ missionId: mission.id, kind: "VERIFICATION", title: `Verification ${verification.result.status}`, content: verification.stdout || verification.stderr, source: "fixture-isolation" });
  if (verification.result.status !== "PASS") { await setMissionStatus(mission.id, "FAILED"); await appendMissionEvent({ missionId: mission.id, eventType: "VERIFICATION_FAILED", actor: "Verifier", tool: "fixture-isolation", result: verification.stderr || "Verification failed closed.", evidenceRefs: [verificationEvidence.id, sandboxRun.id] }); return getMissionBundle(mission.id); }
  await appendMissionEvent({ missionId: mission.id, eventType: "VERIFICATION_PASSED", actor: "Verifier", tool: "fixture-isolation", result: "Release-check passed. The repair is eligible for review, not for autonomous action.", evidenceRefs: [verificationEvidence.id, sandboxRun.id] });
  const approval = await addApprovalRequest({ missionId: mission.id, actionType: "SIMULATED_GITHUB_PULL_REQUEST", risk: "LOW", justification: "Create a simulated pull request record for the verified one-file manifest patch." });
  await setMissionStatus(mission.id, "WAITING_APPROVAL");
  await appendMissionEvent({ missionId: mission.id, eventType: "APPROVAL_REQUIRED", actor: "SentinelForge", result: "Human approval is required before the simulated external action. No write has occurred.", evidenceRefs: [approval.id, verificationEvidence.id] });
  const notificationDelivered = await notifyOwner({ title: "SentinelForge approval required", content: `${mission.id} is waiting for approval. Risk: LOW. Verification: PASS. Action: simulated pull request.` });
  await appendMissionEvent({ missionId: mission.id, eventType: "OWNER_NOTIFIED", actor: "SentinelForge", tool: "owner-notification", result: notificationDelivered ? "Owner notification delivered." : "Owner notification unavailable; the mission remains safely waiting for approval." });
  return getMissionBundle(mission.id);
}

export async function resolveApproval(requestId: string, approve: boolean) {
  return resolvePersistedApproval({ getApprovalWithMission, decideApproval, setMissionStatus, appendMissionEvent, countExternalActions, createSimulatedExternalAction, getMissionBundle }, requestId, approve);
}

import { notifyOwner } from "../_core/notification";
import { getDeterministicScenario, runDeterministicScenarioVerification, type DeterministicScenarioId } from "./scenarios";
import { addApprovalRequest, addEvidence, addSandboxRun, appendMissionEvent, countExternalActions, createMission, createSimulatedExternalAction, decideApproval, getApprovalWithMission, getMissionBundle, setMissionStatus } from "./repository";
import { resolvePersistedApproval } from "./approvalWorkflow";

export async function launchDeterministicFixtureMission(scenarioId: DeterministicScenarioId = "release_manifest_version_drift") {
  const scenario = getDeterministicScenario(scenarioId);
  const { investigatorResult, repairProposal } = scenario;
  const mission = await createMission({ ...scenario.incident, risk: repairProposal.risk });
  await setMissionStatus(mission.id, "INVESTIGATING");
  await appendMissionEvent({ missionId: mission.id, eventType: "INVESTIGATION_STARTED", actor: "Deterministic fixture adapter", tool: "fixture-investigator", result: `Investigator received the ${scenario.label.toLowerCase()} incident and bounded fixture evidence.` });
  const observationEvidence = await Promise.all(scenario.evidence.map(item => addEvidence({ missionId: mission.id, kind: "OBSERVED", title: `${item.file} observation`, content: item.observation, source: `fixtures/${scenario.id}/${item.file}` })));
  const investigationEvidence = await addEvidence({ missionId: mission.id, kind: "INVESTIGATION", title: "Investigation finding", content: investigatorResult.finding, source: `fixture-investigator/${scenario.id}` });
  await addEvidence({ missionId: mission.id, kind: "ROOT_CAUSE", title: "Root cause", content: investigatorResult.rootCause, source: `fixture-investigator/${scenario.id}` });
  await appendMissionEvent({ missionId: mission.id, eventType: "ROOT_CAUSE_IDENTIFIED", actor: "Investigator", result: investigatorResult.rootCause, evidenceRefs: [investigationEvidence.id, ...observationEvidence.map(item => item.id)] });
  await setMissionStatus(mission.id, "PLANNING_FIX");
  const patchEvidence = await addEvidence({ missionId: mission.id, kind: "PATCH", title: "Minimal repair proposal", content: repairProposal.patch, source: `fixture-repair-engineer/${scenario.id}` });
  const fingerprintEvidence = await addEvidence({ missionId: mission.id, kind: "REPAIR_FINGERPRINT", title: "Repair fingerprint", content: scenario.repairFingerprint, source: `fixture-repair-engineer/${scenario.id}` });
  await appendMissionEvent({ missionId: mission.id, eventType: "REPAIR_PROPOSED", actor: "Repair Engineer", result: repairProposal.summary, evidenceRefs: [patchEvidence.id, fingerprintEvidence.id] });
  await setMissionStatus(mission.id, "VERIFYING", { rootCause: investigatorResult.rootCause, repairSummary: repairProposal.summary, patch: repairProposal.patch });
  await appendMissionEvent({ missionId: mission.id, eventType: "VERIFICATION_STARTED", actor: "Deterministic fixture adapter", tool: "fixture-isolation", result: "Starting deterministic no-shell verification with a 90ms hard timeout." });
  const verification = await runDeterministicScenarioVerification(scenario.id);
  const sandboxRun = await addSandboxRun({ missionId: mission.id, status: verification.result.status, runner: "fixture-isolation/no-shell", command: scenario.verification.command, stdout: verification.stdout, stderr: verification.stderr, exitCode: verification.exitCode, durationMs: verification.durationMs, timedOut: verification.timedOut });
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

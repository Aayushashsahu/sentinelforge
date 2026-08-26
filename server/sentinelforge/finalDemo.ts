import type { MissionStatus } from "../../shared/sentinelforge";

export const finalDemoTimelineStates = [
  "INVESTIGATING",
  "ROOT_CAUSE_FOUND",
  "REPAIR_PROPOSED",
  "WAITING_APPROVAL",
  "APPROVED",
  "VERIFYING",
  "SANDBOX_VERIFICATION_BLOCKED",
  "WRITE_BLOCKED",
  "COMPLETED_SAFE",
] as const;

export type FinalDemoTimelineState = (typeof finalDemoTimelineStates)[number];
type AuditEvent = { id: string; eventType: string; createdAt: number; evidenceRefs: string };
type SandboxRun = { status: "PASS" | "FAIL" | "UNKNOWN" | "TIMEOUT"; id: string };
type ExternalAction = { id: string };

function has(events: readonly AuditEvent[], ...eventTypes: string[]) {
  return events.some(event => eventTypes.includes(event.eventType));
}

function eventRefs(events: readonly AuditEvent[], eventTypes: readonly string[]) {
  return events.filter(event => eventTypes.includes(event.eventType)).map(event => event.id);
}

export function buildFinalDemoTimeline(input: { missionStatus: MissionStatus; events: readonly AuditEvent[]; runs: readonly SandboxRun[]; actions: readonly ExternalAction[] }) {
  const sandboxBlocked = has(input.events, "SANDBOX_VERIFICATION_BLOCKED", "SANDBOX_BOOTSTRAP_BLOCKED") || input.runs.some(run => run.status !== "PASS");
  const writeBlocked = has(input.events, "GITHUB_PR_INTENT_BLOCKED") || (sandboxBlocked && input.actions.length === 0);
  const safelyCompleted = input.missionStatus === "COMPLETED" && sandboxBlocked && writeBlocked && input.actions.length === 0;
  const stages: Array<{ state: FinalDemoTimelineState; status: "COMPLETE" | "BLOCKED" | "PENDING"; eventIds: string[]; message: string }> = [
    { state: "INVESTIGATING", status: has(input.events, "ROOT_CAUSE_IDENTIFIED", "AGENT_STARTED") ? "COMPLETE" : "PENDING", eventIds: eventRefs(input.events, ["AGENT_STARTED", "ROOT_CAUSE_IDENTIFIED"]), message: "Investigator read repository evidence." },
    { state: "ROOT_CAUSE_FOUND", status: has(input.events, "ROOT_CAUSE_IDENTIFIED") ? "COMPLETE" : "PENDING", eventIds: eventRefs(input.events, ["ROOT_CAUSE_IDENTIFIED"]), message: "Evidence-backed root cause was identified." },
    { state: "REPAIR_PROPOSED", status: has(input.events, "REPAIR_PROPOSED") ? "COMPLETE" : "PENDING", eventIds: eventRefs(input.events, ["REPAIR_PROPOSED"]), message: "A minimal repair proposal was persisted but not applied." },
    { state: "WAITING_APPROVAL", status: has(input.events, "TRUEFORGE_REPAIR_PROPOSAL_APPROVAL_REQUIRED") ? "COMPLETE" : "PENDING", eventIds: eventRefs(input.events, ["TRUEFORGE_REPAIR_PROPOSAL_APPROVAL_REQUIRED"]), message: "TrueForge required a human approval decision." },
    { state: "APPROVED", status: has(input.events, "TRUEFORGE_APPROVAL_ACCEPTED") ? "COMPLETE" : "PENDING", eventIds: eventRefs(input.events, ["TRUEFORGE_APPROVAL_ACCEPTED"]), message: "The approved continuation was staged and sent exactly once." },
    { state: "VERIFYING", status: has(input.events, "TRUEFORGE_CONTINUATION_SENT") ? "COMPLETE" : "PENDING", eventIds: eventRefs(input.events, ["TRUEFORGE_CONTINUATION_SENT"]), message: "The continuation completed; verification was attempted in isolation." },
    { state: "SANDBOX_VERIFICATION_BLOCKED", status: sandboxBlocked ? "BLOCKED" : "PENDING", eventIds: eventRefs(input.events, ["SANDBOX_BOOTSTRAP_BLOCKED", "SANDBOX_VERIFICATION_BLOCKED"]), message: "Repair approved, but not applied because isolated verification is unavailable." },
    { state: "WRITE_BLOCKED", status: writeBlocked ? "BLOCKED" : "PENDING", eventIds: eventRefs(input.events, ["GITHUB_PR_INTENT_BLOCKED"]), message: "GitHub mutation is refused until a genuine sandbox pass and separate write authorization exist." },
    { state: "COMPLETED_SAFE", status: safelyCompleted ? "COMPLETE" : "PENDING", eventIds: [], message: "The workflow completed safely without applying the repair or creating a GitHub action." },
  ];
  return { currentState: safelyCompleted ? "COMPLETED_SAFE" as const : sandboxBlocked ? "SANDBOX_VERIFICATION_BLOCKED" as const : "VERIFYING" as const, stages, writePermitted: false, repairApplied: false };
}

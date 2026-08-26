import { assertCanonicalFixtureProofPatch, fixtureProofFingerprint, FIXTURE_PROOF_AFTER_VERSION, FIXTURE_PROOF_BASE_BRANCH, FIXTURE_PROOF_BEFORE_VERSION, FIXTURE_PROOF_FILE, FIXTURE_PROOF_REPOSITORY, type FixtureProofAction } from "../fixtureGithubProof";

export type SafetyInspectionStatus = "ALLOWED_FOR_NEXT_STAGE" | "BLOCKED";
export type SafetyInspectionPort = {
  getMissionBundle(missionId: string): Promise<{
    mission: { id: string; status: string; repository: string; repairSummary: string | null; patch: string | null };
    approvals: Array<{ id: string; status: string; expiresAt: number; actionType: string }>;
    trueforgeTurns: Array<{ turnId: string; status: string; threadId: string | null; toolCallId: string | null; requiredActionId: string | null }>;
    runs: Array<{ status: string }>;
  } | null>;
  getFixtureProofAction(actionId: string): Promise<FixtureProofAction | null>;
};

export type ApprovalProbeResult = {
  status: SafetyInspectionStatus;
  reasons: string[];
  missionState: string | null;
  actionState: string | null;
  approvalState: string | null;
  correlationMatch: boolean;
  fingerprintMatch: boolean;
  belongsToRequestedAction: boolean;
  usable: boolean;
};

export type RepairProposalGateResult = {
  status: SafetyInspectionStatus;
  reasons: string[];
  missionState: string | null;
  actionState: string | null;
  target: { repository: string; baseBranch: string; files: string[]; operation: string } | null;
  fingerprintMatch: boolean;
  idempotencyMatch: boolean;
  sandboxState: "NOT_REQUIRED" | "PASSED" | "BLOCKED" | "UNKNOWN";
  approvalState: string | null;
  writeCapabilityState: "NOT_REQUIRED" | "UNVERIFIED";
};

type ObjectInput = Record<string, unknown>;
const fingerprintPattern = /^[a-f0-9]{64}$/;

function nonBlank(input: ObjectInput, key: string): string | null {
  const value = input[key];
  return typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= 256 ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function blockedApproval(reasons: string[]): ApprovalProbeResult {
  return { status: "BLOCKED", reasons, missionState: null, actionState: null, approvalState: null, correlationMatch: false, fingerprintMatch: false, belongsToRequestedAction: false, usable: false };
}

function latestTurn(bundle: NonNullable<Awaited<ReturnType<SafetyInspectionPort["getMissionBundle"]>>>) {
  return bundle.trueforgeTurns.find(turn => turn.status === "WAITING_APPROVAL") ?? bundle.trueforgeTurns[0] ?? null;
}

export async function inspectApprovalProbe(input: ObjectInput, port: SafetyInspectionPort): Promise<ApprovalProbeResult> {
  const missionId = nonBlank(input, "mission_id");
  const actionId = nonBlank(input, "action_id");
  const requiredActionId = nonBlank(input, "required_action_id");
  if (!missionId) return blockedApproval(["MALFORMED_INPUT"]);
  const bundle = await port.getMissionBundle(missionId);
  if (!bundle) return blockedApproval(["MISSION_NOT_FOUND"]);

  const action = actionId ? await port.getFixtureProofAction(actionId) : null;
  const turn = latestTurn(bundle);
  const reasons: string[] = [];
  if (actionId && (!action || action.missionId !== missionId)) reasons.push("ACTION_NOT_FOUND");
  if (requiredActionId && turn?.requiredActionId !== requiredActionId) reasons.push("REQUIRED_ACTION_MISMATCH");
  const requestedThread = nonBlank(input, "thread_id");
  const requestedToolCall = nonBlank(input, "tool_call_id");
  const correlationMatch = Boolean(turn && (!requestedThread || requestedThread === turn.threadId) && (!requestedToolCall || requestedToolCall === turn.toolCallId) && (!requiredActionId || requiredActionId === turn.requiredActionId));
  if (!correlationMatch) reasons.push("CORRELATION_MISMATCH");
  const requestedFingerprint = nonBlank(input, "proposal_fingerprint");
  const fingerprintMatch = Boolean(action && requestedFingerprint && fingerprintPattern.test(requestedFingerprint) && action.intent.proposalFingerprint === requestedFingerprint);
  if (requestedFingerprint && !fingerprintMatch) reasons.push("FINGERPRINT_MISMATCH");
  const approvalId = action?.approval.approvalRequestId ?? null;
  const approval = approvalId ? bundle.approvals.find(item => item.id === approvalId) ?? null : bundle.approvals.find(item => item.status === "PENDING") ?? null;
  if (!approval) reasons.push("APPROVAL_NOT_PRESENT");
  const belongsToRequestedAction = Boolean(action && approval && action.missionId === missionId && action.approval.approvalRequestId === approval.id);
  if (approval && !belongsToRequestedAction) reasons.push("APPROVAL_ACTION_MISMATCH");
  if (approval && approval.expiresAt <= Date.now()) reasons.push("APPROVAL_STALE");
  const usable = Boolean(approval && approval.status === "PENDING" && approval.expiresAt > Date.now() && bundle.mission.status === "WAITING_APPROVAL" && correlationMatch && belongsToRequestedAction && (!requestedFingerprint || fingerprintMatch));
  if (approval && approval.status !== "PENDING") reasons.push("APPROVAL_NOT_PENDING");
  if (bundle.mission.status !== "WAITING_APPROVAL") reasons.push("MISSION_NOT_WAITING_APPROVAL");
  return { status: reasons.length === 0 ? "ALLOWED_FOR_NEXT_STAGE" : "BLOCKED", reasons, missionState: bundle.mission.status, actionState: action?.status ?? null, approvalState: approval?.status ?? null, correlationMatch, fingerprintMatch: requestedFingerprint ? fingerprintMatch : true, belongsToRequestedAction, usable };
}

function blockedGate(reasons: string[]): RepairProposalGateResult {
  return { status: "BLOCKED", reasons, missionState: null, actionState: null, target: null, fingerprintMatch: false, idempotencyMatch: false, sandboxState: "UNKNOWN", approvalState: null, writeCapabilityState: "UNVERIFIED" };
}

export async function inspectRepairProposalGate(input: ObjectInput, port: SafetyInspectionPort): Promise<RepairProposalGateResult> {
  const missionId = nonBlank(input, "mission_id");
  const actionId = nonBlank(input, "action_id");
  const fingerprint = nonBlank(input, "proposal_fingerprint");
  const stage = input.stage === "EXTERNAL_EXECUTION" ? "EXTERNAL_EXECUTION" : input.stage === "APPROVAL_CAPTURE" ? "APPROVAL_CAPTURE" : null;
  if (!missionId || !fingerprint || !fingerprintPattern.test(fingerprint) || !stage || (stage === "EXTERNAL_EXECUTION" && !actionId)) return blockedGate(["MALFORMED_INPUT"]);
  const [bundle, action] = await Promise.all([port.getMissionBundle(missionId), actionId ? port.getFixtureProofAction(actionId) : Promise.resolve(null)]);
  if (!bundle) return blockedGate(["MISSION_NOT_FOUND"]);
  const reasons: string[] = [];
  if (actionId && (!action || action.missionId !== missionId)) reasons.push("ACTION_NOT_FOUND");
  const persistedPatch = bundle.mission.patch;
  const expectedFingerprint = action?.intent.proposalFingerprint ?? (persistedPatch ? fixtureProofFingerprint({ summary: bundle.mission.repairSummary, patch: persistedPatch }) : null);
  const fingerprintMatch = expectedFingerprint === fingerprint;
  if (!fingerprintMatch) reasons.push("FINGERPRINT_MISMATCH");
  const target = action ? { repository: action.intent.repository, baseBranch: action.intent.baseBranch, files: [action.intent.filePath], operation: `${action.intent.beforeVersion}->${action.intent.afterVersion}` } : { repository: bundle.mission.repository, baseBranch: FIXTURE_PROOF_BASE_BRANCH, files: [FIXTURE_PROOF_FILE], operation: `${FIXTURE_PROOF_BEFORE_VERSION}->${FIXTURE_PROOF_AFTER_VERSION}` };
  if (target.repository !== FIXTURE_PROOF_REPOSITORY || target.baseBranch !== FIXTURE_PROOF_BASE_BRANCH || target.files.length !== 1 || target.files[0] !== FIXTURE_PROOF_FILE || target.operation !== `${FIXTURE_PROOF_BEFORE_VERSION}->${FIXTURE_PROOF_AFTER_VERSION}`) reasons.push("TARGET_NOT_ALLOWLISTED");
  try { if (bundle.mission.patch) assertCanonicalFixtureProofPatch(bundle.mission.patch); else reasons.push("PROPOSAL_NOT_PRESENT"); } catch { reasons.push("PROPOSAL_SEMANTICS_INVALID"); }
  const idempotencyMatch = action ? action.intent.idempotencyKey === `fixture-github-pr:${missionId}:${fingerprint}` : stage === "APPROVAL_CAPTURE";
  if (action && !idempotencyMatch) reasons.push("IDEMPOTENCY_MISMATCH");
  const approval = action?.approval.approvalRequestId ? bundle.approvals.find(item => item.id === action.approval.approvalRequestId) ?? null : null;
  const sandboxState = bundle.runs.some(run => run.status === "PASS") ? "PASSED" : bundle.runs.length > 0 ? "BLOCKED" : "UNKNOWN";
  const writeCapabilityState = stage === "APPROVAL_CAPTURE" ? "NOT_REQUIRED" : "UNVERIFIED";
  if (stage === "EXTERNAL_EXECUTION") {
    if (sandboxState !== "PASSED") reasons.push("SANDBOX_VERIFICATION_BLOCKED");
    if (!approval || approval.status !== "APPROVED") reasons.push("APPROVAL_NOT_PRESENT");
    reasons.push("WRITE_CAPABILITY_UNVERIFIED");
  }
  return { status: reasons.length === 0 ? "ALLOWED_FOR_NEXT_STAGE" : "BLOCKED", reasons, missionState: bundle.mission.status, actionState: action?.status ?? null, target, fingerprintMatch, idempotencyMatch, sandboxState, approvalState: approval?.status ?? null, writeCapabilityState };
}

export function parseSafetyInput(text: unknown): ObjectInput {
  return text && typeof text === "object" && !Array.isArray(text) ? text as ObjectInput : {};
}

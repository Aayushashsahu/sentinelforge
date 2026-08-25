import { createHash } from "node:crypto";
import { z } from "zod";
import type { ApprovalStatus, MissionStatus, Risk } from "../../shared/sentinelforge";

export const liveRepairProposalSchema = z.object({
  summary: z.string().min(1).max(4_000),
  patch: z.string().min(1).max(100_000),
  files_changed: z.array(z.string().min(1).max(500)).min(1).max(25),
  expected_effect: z.string().min(1).max(4_000),
  risk: z.enum(["LOW", "MEDIUM", "HIGH"]),
}).strict();

export const liveVerificationResultSchema = z.object({
  status: z.literal("PASS"),
  verifier: z.literal("trueforge-sandbox"),
  tests_run: z.array(z.string().min(1)).min(1),
  evidence_refs: z.array(z.string().min(1)).min(1),
  repair_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

const approvalRequiredEventSchema = z.object({
  type: z.literal("tool.approval_required"),
  thread_id: z.string().min(1),
  tool_call_id: z.string().min(1),
  required_action_id: z.string().min(1).optional(),
  tool_name: z.string().min(1),
}).passthrough();

export type LiveRepairProposal = z.infer<typeof liveRepairProposalSchema>;
export type LiveVerificationResult = z.infer<typeof liveVerificationResultSchema>;
export type TrueForgeApprovalRequired = z.infer<typeof approvalRequiredEventSchema>;

export function createRepairFingerprint(proposal: LiveRepairProposal): string {
  const stable = JSON.stringify({ summary: proposal.summary, patch: proposal.patch, files_changed: [...proposal.files_changed].sort(), expected_effect: proposal.expected_effect, risk: proposal.risk });
  return createHash("sha256").update(stable).digest("hex");
}

export function parseTrueForgeApprovalRequiredEvent(input: unknown): TrueForgeApprovalRequired | null {
  if (!input || typeof input !== "object") return null;
  const record = input as { data?: unknown; type?: unknown };
  const candidate = record.data && typeof record.data === "object" ? record.data : input;
  const parsed = approvalRequiredEventSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function buildTrueForgeApprovalContinuation(input: { threadId: string; toolCallId: string; approve: boolean; denialReason?: string }) {
  if (!input.threadId || !input.toolCallId) throw new Error("TrueForge approval continuation requires both thread and tool-call identifiers.");
  return {
    type: "user.tool_approval" as const,
    thread_id: input.threadId,
    tool_call_id: input.toolCallId,
    approval: input.approve ? { status: "allow" as const } : { status: "deny" as const, ...(input.denialReason ? { reason: input.denialReason } : {}) },
  };
}

export type LiveExecutionGateInput = {
  missionStatus: MissionStatus;
  approvalStatus: ApprovalStatus;
  verificationStatus: "PASS" | "FAIL" | "UNKNOWN" | "TIMEOUT";
  approvedFingerprint: string | null;
  currentFingerprint: string;
  requiredActionId: string | null;
  toolCallId: string | null;
  existingActionCount: number;
  risk: Risk;
};

export function assertLiveGitHubPrExecutionAllowed(input: LiveExecutionGateInput): void {
  if (input.missionStatus !== "WAITING_APPROVAL") throw new Error("GitHub action refused: mission is not waiting for approval.");
  if (input.approvalStatus !== "APPROVED") throw new Error("GitHub action refused: persisted approval is not approved.");
  if (input.verificationStatus !== "PASS") throw new Error("GitHub action refused: real verification did not pass.");
  if (!input.approvedFingerprint || input.approvedFingerprint !== input.currentFingerprint) throw new Error("GitHub action refused: repair proposal changed after approval.");
  if (!input.requiredActionId || !input.toolCallId) throw new Error("GitHub action refused: no correlated TrueForge approval-required action exists.");
  if (input.existingActionCount !== 0) throw new Error("GitHub action refused: an idempotent action record already exists.");
}

export function buildIdempotentGitHubPullRequestIntent(input: { missionId: string; repository: string; proposal: LiveRepairProposal; fingerprint: string }) {
  const proposal = liveRepairProposalSchema.parse(input.proposal);
  if (!/^[a-f0-9]{64}$/.test(input.fingerprint)) throw new Error("A valid repair fingerprint is required for a GitHub PR intent.");
  return {
    actionType: "GITHUB_PULL_REQUEST" as const,
    target: input.repository,
    idempotencyKey: `trueforge-pr:${input.missionId}:${input.fingerprint}`,
    branchName: `sentinelforge/${input.missionId.toLowerCase()}`,
    title: proposal.summary,
    body: proposal.expected_effect,
    filesChanged: proposal.files_changed,
  };
}

export function getLiveExecutionContractStatus() {
  return {
    repairProposal: "CONTRACT_READY_NO_LIVE_REPAIR_ARTIFACT",
    verifier: "REQUIRES_REAL_SANDBOX_PASS",
    approvalPersistence: "CONTRACT_READY_REQUIRES_REAL_TOOL_APPROVAL_EVENT",
    approvalResume: "CONTRACT_READY_REQUIRES_REAL_THREAD_AND_TOOL_CALL",
    githubWrite: "GUARDED_NO_REMOTE_WRITE_IMPLEMENTED",
    sandbox: "BLOCKED_BY_PROVIDER_BOOTSTRAP",
  } as const;
}

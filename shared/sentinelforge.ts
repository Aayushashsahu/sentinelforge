export const missionStatuses = ["CREATED", "INVESTIGATING", "PLANNING_FIX", "VERIFYING", "WAITING_APPROVAL", "EXECUTING", "COMPLETED", "FAILED", "REJECTED"] as const;
export type MissionStatus = (typeof missionStatuses)[number];
export const risks = ["LOW", "MEDIUM", "HIGH"] as const;
export type Risk = (typeof risks)[number];
export const approvalStatuses = ["PENDING", "APPROVED", "REJECTED", "EXPIRED"] as const;
export type ApprovalStatus = (typeof approvalStatuses)[number];

export type InvestigationResult = { finding: string; rootCause: string; confidence: number; evidence: string[] };
export type RepairProposal = { summary: string; filesChanged: string[]; patch: string; expectedEffect: string; risk: Risk };
export type VerificationResult = { status: "PASS" | "FAIL" | "UNKNOWN" | "TIMEOUT"; testsRun: string[]; testsPassed: number; testsFailed: number; evidence: string[] };
export type TrueForgeReadiness = { capability: string; status: "READY_TO_CONNECT" | "NOT_CONNECTED" | "SIMULATED"; detail: string };

export const trueForgeReadiness: TrueForgeReadiness[] = [
  { capability: "Typed adapter boundary", status: "READY_TO_CONNECT", detail: "Mission orchestration is isolated behind a typed boundary; no provider calls are scattered through the UI." },
  { capability: "GitHub MCP", status: "NOT_CONNECTED", detail: "Live GitHub MCP access is intentionally not claimed in this demo. External actions remain simulated." },
  { capability: "Specialist subagents", status: "SIMULATED", detail: "The deterministic fixture exposes Investigator, Repair Engineer, and Verifier stages with structured outputs." },
  { capability: "Sandbox runtime", status: "SIMULATED", detail: "The current verifier is an isolated, no-shell fixture adapter with a hard timeout. Connect a TrueForge sandbox before running generated code." },
  { capability: "Approval continuation", status: "READY_TO_CONNECT", detail: "Approval decisions, idempotency, state validation, and resume semantics are persisted and tested." },
];

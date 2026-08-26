export const missionStatuses = ["CREATED", "INVESTIGATING", "PLANNING_FIX", "VERIFYING", "WAITING_APPROVAL", "EXECUTING", "COMPLETED", "FAILED", "REJECTED"] as const;
export type MissionStatus = (typeof missionStatuses)[number];
export const risks = ["LOW", "MEDIUM", "HIGH"] as const;
export type Risk = (typeof risks)[number];
export const approvalStatuses = ["PENDING", "APPROVED", "REJECTED", "EXPIRED"] as const;
export type ApprovalStatus = (typeof approvalStatuses)[number];

export type InvestigationResult = { finding: string; rootCause: string; confidence: number; evidence: string[] };
export type RepairProposal = { summary: string; filesChanged: string[]; patch: string; expectedEffect: string; risk: Risk };
export type VerificationResult = { status: "PASS" | "FAIL" | "UNKNOWN" | "TIMEOUT"; testsRun: string[]; testsPassed: number; testsFailed: number; evidence: string[] };
export type TrueForgeReadiness = { capability: string; status: "REAL" | "READY_TO_CONNECT" | "BLOCKED" | "GUARDED"; detail: string };

export const trueForgeReadiness: TrueForgeReadiness[] = [
  { capability: "TrueForge and NVIDIA NIM", status: "REAL", detail: "The live provider created the verified approval checkpoint and accepted the exactly-once continuation." },
  { capability: "First-party sentinelforge-tools MCP", status: "REAL", detail: "The Investigator and Repair Engineer received ordinary text evidence through the allowlisted read-only MCP server." },
  { capability: "Approval continuation", status: "REAL", detail: "Session, turn, thread, tool-call, and required-action correlation are persisted across the live provider continuation." },
  { capability: "Sandbox runtime", status: "BLOCKED", detail: "A real isolated exec request reached the provider, but pydantic bootstrap failed through the proxy before verification could run." },
  { capability: "GitHub execution", status: "GUARDED", detail: "The deterministic branch/commit/PR intent is blocked until a real sandbox pass, matching fingerprint, separate write authorization, and write-scoped credential exist." },
];

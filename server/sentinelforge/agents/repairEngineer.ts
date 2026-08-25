import { z } from "zod";
import type { TrueForgeInlineAgentSpec } from "../trueforge/client";

export const repairEngineerResultSchema = z.object({
  summary: z.string().min(1),
  patch: z.string().min(1),
  files_changed: z.array(z.string().min(1)).min(1).max(10),
  expected_effect: z.string().min(1),
  risk: z.enum(["LOW", "MEDIUM", "HIGH"]),
  evidence_limitations: z.array(z.string()).default([]),
});

export const repairEngineerLimitationSchema = z.object({
  summary: z.string().min(1),
  patch: z.null(),
  files_changed: z.array(z.string()).max(0),
  expected_effect: z.null(),
  risk: z.string().min(1),
  evidence_limitations: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
}).transform(value => ({
  kind: "LIMITATION" as const,
  summary: value.summary,
  limitations: Array.isArray(value.evidence_limitations) ? value.evidence_limitations : [value.evidence_limitations],
}));

export type RepairEngineerResult = z.infer<typeof repairEngineerResultSchema>;
export type RepairEngineerOutcome = { kind: "PROPOSAL"; proposal: RepairEngineerResult } | z.infer<typeof repairEngineerLimitationSchema>;

export function buildReadOnlyRepairEngineerSpec(input: { model: string; toolsMcpName: string }): TrueForgeInlineAgentSpec {
  return {
    model: { name: input.model },
    instructions: [
      "You are SentinelForge Repair Engineer.",
      "Use only sentinelforge-tools read-only MCP tools to inspect the named repository and reason about the smallest repair proposal.",
      "Never execute shell commands, use sandbox execution, create a branch, commit, pull request, release, workflow change, or any GitHub write.",
      "If direct file contents are unavailable, state that limitation explicitly and do not claim verification passed.",
      "Return only JSON with summary, patch, files_changed, expected_effect, risk, and evidence_limitations.",
      "A patch is a proposal only; it must not be applied or represented as a repository mutation.",
    ].join(" "),
    mcp_servers: [{ name: input.toolsMcpName, enable_tools: ["get_repository", "get_file", "get_issue", "get_workflow_run"], require_approval_for_tools: ["@write", "@destructive"], preload: true }],
    config: {
      iteration_limit: 10,
      sandbox: { enabled: false, file_downloads: false },
      dynamic_sub_agents: { enabled: false },
      ask_user_questions: { enabled: false },
    },
  };
}

function collectStrings(value: unknown, output: string[]): void {
  if (typeof value === "string") { output.push(value); return; }
  if (Array.isArray(value)) { value.forEach(item => collectStrings(item, output)); return; }
  if (value && typeof value === "object") Object.values(value).forEach(item => collectStrings(item, output));
}

export function parseRepairEngineerResult(events: readonly unknown[]): RepairEngineerResult {
  const candidates: string[] = [];
  events.forEach(event => collectStrings(event, candidates));
  for (const candidate of candidates) {
    try {
      const parsed = repairEngineerResultSchema.safeParse(JSON.parse(candidate));
      if (parsed.success) return parsed.data;
    } catch {
      // Stream events routinely contain non-JSON tool payloads.
    }
  }
  throw new Error("TrueForge Repair Engineer output was malformed or did not contain the required structured proposal.");
}

export function parseRepairEngineerOutcome(events: readonly unknown[]): RepairEngineerOutcome {
  const candidates: string[] = [];
  events.forEach(event => collectStrings(event, candidates));
  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate);
      const proposal = repairEngineerResultSchema.safeParse(value);
      if (proposal.success) return { kind: "PROPOSAL", proposal: proposal.data };
      const limitation = repairEngineerLimitationSchema.safeParse(value);
      if (limitation.success) return limitation.data;
    } catch {
      // Stream events routinely contain non-JSON tool payloads.
    }
  }
  throw new Error("TrueForge Repair Engineer output was malformed and did not contain a structured proposal or explicit evidence limitation.");
}

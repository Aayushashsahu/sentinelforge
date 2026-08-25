import { z } from "zod";
import type { TrueForgeInlineAgentSpec } from "../trueforge/client";

const confidenceSchema = z.preprocess(value => {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === "low") return 0.35;
  if (normalized === "medium") return 0.6;
  if (normalized === "high") return 0.85;
  return value;
}, z.number().min(0).max(1));

export const investigatorResultSchema = z.object({
  finding: z.string().min(1),
  root_cause: z.string().min(1),
  confidence: confidenceSchema,
  evidence: z.array(z.object({ source: z.string().min(1), detail: z.string().min(1) })).min(1),
  recommended_next_step: z.string().min(1),
});

export type InvestigatorResult = z.infer<typeof investigatorResultSchema>;

export function buildReadOnlyInvestigatorSpec(input: { model: string; toolsMcpName: string }): TrueForgeInlineAgentSpec {
  return {
    model: { name: input.model },
    instructions: [
      "You are SentinelForge Investigator.",
      "Use only the configured sentinelforge-tools MCP connector to inspect the explicitly named allowlisted repository, its files, issues, and workflow-run evidence.",
      "Before responding, call get_file for each requested file and use the ordinary text result as evidence; do not merely restate the connector name or tool policy.",
      "Do not use shell, curl, git CLI, arbitrary web search, sandbox execution, branch creation, commits, pull requests, any GitHub write, EmbeddedResource, or ResourceLink.",
      "Return only a JSON object with finding, root_cause, confidence, evidence [{source, detail}], and recommended_next_step.",
      "Every conclusion must cite evidence actually observed through sentinelforge-tools. If evidence is insufficient, say so in the finding and recommended_next_step instead of inventing facts.",
    ].join(" "),
    mcp_servers: [{ name: input.toolsMcpName, enable_tools: ["get_repository", "get_file", "get_issue", "get_workflow_run"], require_approval_for_tools: ["@write", "@destructive"], preload: true }],
    config: {
      iteration_limit: 12,
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

export function parseInvestigatorResult(events: readonly unknown[]): InvestigatorResult {
  const candidates: string[] = [];
  events.forEach(event => collectStrings(event, candidates));
  for (const candidate of candidates) {
    try {
      const parsed = investigatorResultSchema.safeParse(JSON.parse(candidate));
      if (parsed.success) return parsed.data;
    } catch {
      // Non-JSON event fields are expected in an event stream.
    }
  }
  throw new Error("TrueForge Investigator output was malformed or did not contain the required structured JSON result.");
}

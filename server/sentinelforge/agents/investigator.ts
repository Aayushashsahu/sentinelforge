import { z } from "zod";
import type { TrueForgeInlineAgentSpec } from "../trueforge/client";

export const investigatorResultSchema = z.object({
  finding: z.string().min(1),
  root_cause: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.object({ source: z.string().min(1), detail: z.string().min(1) })).min(1),
  recommended_next_step: z.string().min(1),
});

export type InvestigatorResult = z.infer<typeof investigatorResultSchema>;

export function buildReadOnlyInvestigatorSpec(input: { model: string; githubMcpName: string }): TrueForgeInlineAgentSpec {
  return {
    model: { name: input.model },
    instructions: [
      "You are SentinelForge Investigator.",
      "Use only the configured GitHub MCP connector to inspect repository metadata, files, commits, issues, pull requests, and CI/workflow information.",
      "Before responding, you must call at least one read-only GitHub MCP tool to inspect the named repository; do not merely restate the connector name or tool policy.",
      "Do not use shell, curl, git CLI, arbitrary web search, sandbox execution, branch creation, commits, pull requests, or any GitHub write.",
      "Return only a JSON object with finding, root_cause, confidence, evidence [{source, detail}], and recommended_next_step.",
      "Every conclusion must cite evidence actually observed through the GitHub MCP connector. If evidence is insufficient, say so in the finding and recommended_next_step instead of inventing facts.",
    ].join(" "),
    mcp_servers: [{ name: input.githubMcpName, enable_tools: ["@read-only"], require_approval_for_tools: ["@write", "@destructive"], preload: true }],
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

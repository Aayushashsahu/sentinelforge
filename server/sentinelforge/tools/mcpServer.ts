import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { ENV } from "../../_core/env";
import { SENTINELFORGE_ALLOWED_REPOSITORIES } from "./githubRead";
import { GitHubReadApi } from "./githubRead";
import { getFixtureProofExternalAction, getMissionBundle } from "../repository";
import { inspectApprovalProbe, inspectRepairProposalGate, parseSafetyInput, type SafetyInspectionPort } from "./safetyInspection";

export type McpTextResponse = { content: [{ type: "text"; text: string }]; isError?: true };

export const SENTINELFORGE_TOOLS = ["get_repository", "get_file", "get_issue", "get_workflow_run", "approval_probe", "repair_proposal_gate", "fixture_github_pr_gate"] as const;

export function getSentinelForgeToolsStatus() {
  return {
    name: "sentinelforge-tools",
    endpointPath: "/api/mcp/sentinelforge-tools",
    transport: "STREAMABLE_HTTP" as const,
    allowedRepositories: [...SENTINELFORGE_ALLOWED_REPOSITORIES],
    tools: [...SENTINELFORGE_TOOLS],
    githubReadConfigured: Boolean(ENV.githubReadToken),
    writeActionsEnabled: false,
    sandboxEnabled: false,
  };
}

function textResponse(text: string): McpTextResponse {
  return { content: [{ type: "text", text }] };
}

function errorResponse(error: unknown): McpTextResponse {
  const message = error instanceof Error ? error.message : "Read-only tool request failed.";
  return { content: [{ type: "text", text: message }], isError: true };
}

function stringArgument(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${key} must be a non-empty string.`);
  return value.trim();
}

function positiveIntegerArgument(input: Record<string, unknown>, key: string): number {
  const value = input[key];
  if (!Number.isInteger(value) || (value as number) < 1) throw new Error(`${key} must be a positive integer.`);
  return value as number;
}

const defaultSafetyPort: SafetyInspectionPort = { getMissionBundle, getFixtureProofAction: getFixtureProofExternalAction };

export class SentinelForgeTools {
	constructor(private readonly github = new GitHubReadApi(), private readonly safetyPort = defaultSafetyPort) {}

  async call(name: string, args: Record<string, unknown>): Promise<McpTextResponse> {
    try {
			if (name === "approval_probe") return textResponse(JSON.stringify(await inspectApprovalProbe(parseSafetyInput(args), this.safetyPort)));
			if (name === "repair_proposal_gate") return textResponse(JSON.stringify(await inspectRepairProposalGate(parseSafetyInput(args), this.safetyPort)));
      if (name === "fixture_github_pr_gate") return textResponse("sentinelforge-fixture-github-pr-gate: approval required before one separately authorized fixture-only GitHub branch, release-manifest update, and open pull request proof; no mutation, credential use, or network write was performed");
      const owner = stringArgument(args, "owner");
      const repo = stringArgument(args, "repo");
      if (name === "get_repository") return textResponse(JSON.stringify(await this.github.getRepository(owner, repo), null, 2));
      if (name === "get_file") {
        const file = await this.github.getFile(owner, repo, stringArgument(args, "path"), stringArgument(args, "ref"));
        return textResponse(`Repository: ${file.repository}\nPath: ${file.path}\nRef: ${file.ref}\n\n${file.text}`);
      }
      if (name === "get_issue") return textResponse(JSON.stringify(await this.github.getIssue(owner, repo, positiveIntegerArgument(args, "issue_number")), null, 2));
      if (name === "get_workflow_run") return textResponse(JSON.stringify(await this.github.getWorkflowRun(owner, repo, positiveIntegerArgument(args, "run_id")), null, 2));
      return errorResponse(`Unknown sentinelforge-tools tool: ${name}.`);
    } catch (error) {
      return errorResponse(error);
    }
  }
}

export function createSentinelForgeToolsMcpServer(tools = new SentinelForgeTools()): Server {
  const server = new Server({ name: "sentinelforge-tools", version: "1.0.0" }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      { name: "get_repository", description: "Read allowlisted repository metadata.", inputSchema: { type: "object", required: ["owner", "repo"], properties: { owner: { type: "string" }, repo: { type: "string" } } } },
      { name: "get_file", description: "Read decoded text from an allowlisted repository file.", inputSchema: { type: "object", required: ["owner", "repo", "path", "ref"], properties: { owner: { type: "string" }, repo: { type: "string" }, path: { type: "string" }, ref: { type: "string" } } } },
      { name: "get_issue", description: "Read an issue from an allowlisted repository.", inputSchema: { type: "object", required: ["owner", "repo", "issue_number"], properties: { owner: { type: "string" }, repo: { type: "string" }, issue_number: { type: "integer", minimum: 1 } } } },
      { name: "get_workflow_run", description: "Read an Actions workflow run from an allowlisted repository.", inputSchema: { type: "object", required: ["owner", "repo", "run_id"], properties: { owner: { type: "string" }, repo: { type: "string" }, run_id: { type: "integer", minimum: 1 } } } },
			{ name: "approval_probe", description: "Read and fail-closed inspect a persisted approval checkpoint and its supplied correlation. It never approves, resumes, mutates, or writes.", inputSchema: { type: "object", required: ["mission_id"], properties: { mission_id: { type: "string" }, action_id: { type: "string" }, required_action_id: { type: "string" }, thread_id: { type: "string" }, tool_call_id: { type: "string" }, proposal_fingerprint: { type: "string" } } }, annotations: { readOnlyHint: true } },
			{ name: "repair_proposal_gate", description: "Read and fail-closed validate a persisted fixture repair proposal/action for either approval capture or external-execution readiness. It never approves, resumes, mutates, or writes.", inputSchema: { type: "object", required: ["mission_id", "proposal_fingerprint", "stage"], properties: { mission_id: { type: "string" }, action_id: { type: "string" }, proposal_fingerprint: { type: "string" }, stage: { type: "string", enum: ["APPROVAL_CAPTURE", "EXTERNAL_EXECUTION"] } } }, annotations: { readOnlyHint: true } },
      { name: "fixture_github_pr_gate", description: "Return a constant non-mutating acknowledgement for one exact future fixture-only pull-request proof. It performs no credential use, mutation, or network write and exists solely for a genuine approval checkpoint.", inputSchema: { type: "object", properties: {} }, annotations: { readOnlyHint: true } },
    ],
  }));
  server.setRequestHandler(CallToolRequestSchema, async request => tools.call(request.params.name, (request.params.arguments ?? {}) as Record<string, unknown>));
  return server;
}

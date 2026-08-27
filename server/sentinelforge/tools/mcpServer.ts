import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { ENV } from "../../_core/env";
import { SENTINELFORGE_ALLOWED_REPOSITORIES } from "./githubRead";
import { GitHubReadApi } from "./githubRead";
import { getFixtureProofExternalAction, getMissionBundle, replaceFixtureProofExternalAction } from "../repository";
import { inspectApprovalProbe, inspectRepairProposalGate, parseSafetyInput, type SafetyInspectionPort } from "./safetyInspection";
import { markFixtureProofReadEvidence } from "../liveFixtureProof";
import { FIXTURE_PROOF_AFTER_VERSION, FIXTURE_PROOF_BASE_BRANCH, FIXTURE_PROOF_BEFORE_VERSION, FIXTURE_PROOF_FILE, FIXTURE_PROOF_REPOSITORY, fixtureProofFingerprint, type FixtureProofAction } from "../fixtureGithubProof";

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

type FixtureEvidencePort = SafetyInspectionPort & { replaceFixtureProofAction(action: FixtureProofAction): Promise<void> };
const defaultSafetyPort: FixtureEvidencePort = { getMissionBundle, getFixtureProofAction: getFixtureProofExternalAction, replaceFixtureProofAction: replaceFixtureProofExternalAction };

function parseFixtureActionReference(args: Record<string, unknown>): { missionId: string; actionId: string } | null {
  const hasMission = "proof_mission_id" in args;
  const hasAction = "proof_action_id" in args;
  if (!hasMission && !hasAction) return null;
  if (!hasMission || !hasAction) throw new Error("Fixture proof file reads require both proof_mission_id and proof_action_id.");
  return { missionId: stringArgument(args, "proof_mission_id"), actionId: stringArgument(args, "proof_action_id") };
}

type FixtureArtifact = "package.json" | "release-manifest.json";

function fixtureArtifactArgument(args: Record<string, unknown>): FixtureArtifact {
  const artifact = stringArgument(args, "artifact");
  if (artifact !== "package.json" && artifact !== FIXTURE_PROOF_FILE) throw new Error("Fixture proof read refused: artifact must be package.json or release-manifest.json.");
  return artifact;
}

function assertNoModelSuppliedFixtureTarget(args: Record<string, unknown>) {
  const supplied = ["owner", "repo", "ref", "path"].filter(key => key in args);
  if (supplied.length > 0) throw new Error("Fixture proof read refused: model-supplied target fields are not accepted; use only proof identifiers and artifact.");
}

function assertFixtureActionIntegrity(action: FixtureProofAction, bundle: NonNullable<Awaited<ReturnType<SafetyInspectionPort["getMissionBundle"]>>>, missionId: string) {
  const [owner, repo] = action.intent.repository.split("/") as [string, string];
  const expectedFingerprint = fixtureProofFingerprint({ summary: bundle.mission.repairSummary, patch: bundle.mission.patch ?? "" });
  if (action.status !== "AWAITING_APPROVAL") throw new Error("Fixture proof read refused: persisted action is not awaiting approval.");
  if (action.missionId !== missionId || action.intent.missionId !== missionId || bundle.mission.id !== missionId || bundle.mission.repository !== FIXTURE_PROOF_REPOSITORY || action.intent.repository !== FIXTURE_PROOF_REPOSITORY || action.intent.baseBranch !== FIXTURE_PROOF_BASE_BRANCH || action.intent.filePath !== FIXTURE_PROOF_FILE || action.intent.proposalFingerprint !== expectedFingerprint) throw new Error("Fixture proof read refused: persisted action intent, mission, or proposal fingerprint does not match the canonical proof.");
  return { owner, repo };
}

async function resolveFixtureArtifactRead(args: Record<string, unknown>, port: FixtureEvidencePort) {
  const reference = parseFixtureActionReference(args);
  if (!reference) return null;
  assertNoModelSuppliedFixtureTarget(args);
  const artifact = fixtureArtifactArgument(args);
  const [action, bundle] = await Promise.all([port.getFixtureProofAction(reference.actionId), port.getMissionBundle(reference.missionId)]);
  if (!action || action.missionId !== reference.missionId || !bundle) throw new Error("Fixture proof read refused: persisted action does not match proof_mission_id.");
  const target = assertFixtureActionIntegrity(action, bundle, reference.missionId);
  return {
    action,
    owner: target.owner,
    repo: target.repo,
    path: artifact,
    ref: action.intent.baseBranch,
    expectedVersion: artifact === "package.json" ? FIXTURE_PROOF_AFTER_VERSION : FIXTURE_PROOF_BEFORE_VERSION,
  };
}

function assertExpectedVersion(text: string, expectedVersion: string, path: string) {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error(`Fixture proof read refused: ${path} is not valid JSON.`); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || (parsed as { version?: unknown }).version !== expectedVersion) throw new Error(`Fixture proof read refused: ${path} does not contain required version ${expectedVersion}.`);
}

export class SentinelForgeTools {
	constructor(private readonly github = new GitHubReadApi(), private readonly safetyPort: FixtureEvidencePort = defaultSafetyPort) {}

  async call(name: string, args: Record<string, unknown>): Promise<McpTextResponse> {
    try {
		if (name === "approval_probe") return textResponse(JSON.stringify(await inspectApprovalProbe(parseSafetyInput(args), this.safetyPort)));
		if (name === "repair_proposal_gate") return textResponse(JSON.stringify(await inspectRepairProposalGate(parseSafetyInput(args), this.safetyPort)));
		if (name === "fixture_github_pr_gate") {
          const reference = parseFixtureActionReference(args);
          if (!reference) throw new Error("Fixture proof gate requires persisted proof_mission_id and proof_action_id.");
          const [action, bundle] = await Promise.all([this.safetyPort.getFixtureProofAction(reference.actionId), this.safetyPort.getMissionBundle(reference.missionId)]);
          const evidence = action?.readEvidence;
          if (!action || !bundle || action.missionId !== reference.missionId) throw new Error("Fixture proof gate refused: persisted action does not match proof_mission_id.");
          assertFixtureActionIntegrity(action, bundle, reference.missionId);
          if (!evidence?.packageEvidenceVerified || !evidence.manifestEvidenceVerified || evidence.correlation !== null) throw new Error("Fixture proof gate refused: both exact server-verified read evidences for the persisted action are required before approval eligibility.");
          return textResponse(JSON.stringify({ status: "EVIDENCE_VERIFIED_FOR_PROVIDER_APPROVAL", missionId: action.missionId, actionId: action.id, repository: action.intent.repository, base: action.intent.baseBranch, packageEvidenceVerified: true, manifestEvidenceVerified: true, remoteWriteAuthority: "UNVERIFIED", mutation: "NONE" }));
        }
	      if (name === "get_file") {
          const fixture = await resolveFixtureArtifactRead(args, this.safetyPort);
          const owner = fixture?.owner ?? stringArgument(args, "owner");
          const repo = fixture?.repo ?? stringArgument(args, "repo");
          const path = fixture?.path ?? stringArgument(args, "path");
          const ref = fixture?.ref ?? stringArgument(args, "ref");
	        const file = await this.github.getFile(owner, repo, path, ref);
          if (fixture) {
            assertExpectedVersion(file.text, fixture.expectedVersion, path);
            await this.safetyPort.replaceFixtureProofAction(markFixtureProofReadEvidence({ action: fixture.action, path: fixture.path }));
          }
	        return textResponse(`Repository: ${file.repository}\nPath: ${file.path}\nRef: ${file.ref}\n\n${file.text}`);
      }
	      const owner = stringArgument(args, "owner");
	      const repo = stringArgument(args, "repo");
	      if (name === "get_repository") return textResponse(JSON.stringify(await this.github.getRepository(owner, repo), null, 2));
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
	      { name: "get_file", description: "Read decoded text from an allowlisted repository file. Fixture-proof reads accept only persisted proof IDs plus artifact (package.json or release-manifest.json); the server derives owner, repository, and ref from immutable action intent before it reads or marks evidence.", inputSchema: { type: "object", oneOf: [{ required: ["owner", "repo", "path", "ref"] }, { required: ["proof_mission_id", "proof_action_id", "artifact"] }], properties: { owner: { type: "string" }, repo: { type: "string" }, path: { type: "string" }, ref: { type: "string" }, proof_mission_id: { type: "string" }, proof_action_id: { type: "string" }, artifact: { type: "string", enum: ["package.json", "release-manifest.json"] } } } },
      { name: "get_issue", description: "Read an issue from an allowlisted repository.", inputSchema: { type: "object", required: ["owner", "repo", "issue_number"], properties: { owner: { type: "string" }, repo: { type: "string" }, issue_number: { type: "integer", minimum: 1 } } } },
      { name: "get_workflow_run", description: "Read an Actions workflow run from an allowlisted repository.", inputSchema: { type: "object", required: ["owner", "repo", "run_id"], properties: { owner: { type: "string" }, repo: { type: "string" }, run_id: { type: "integer", minimum: 1 } } } },
			{ name: "approval_probe", description: "Read and fail-closed inspect a persisted approval checkpoint and its supplied correlation. It never approves, resumes, mutates, or writes.", inputSchema: { type: "object", required: ["mission_id"], properties: { mission_id: { type: "string" }, action_id: { type: "string" }, required_action_id: { type: "string" }, thread_id: { type: "string" }, tool_call_id: { type: "string" }, proposal_fingerprint: { type: "string" } } }, annotations: { readOnlyHint: true } },
			{ name: "repair_proposal_gate", description: "Read and fail-closed validate a persisted fixture repair proposal/action for either approval capture or external-execution readiness. It never approves, resumes, mutates, or writes.", inputSchema: { type: "object", required: ["mission_id", "proposal_fingerprint", "stage"], properties: { mission_id: { type: "string" }, action_id: { type: "string" }, proposal_fingerprint: { type: "string" }, stage: { type: "string", enum: ["APPROVAL_CAPTURE", "EXTERNAL_EXECUTION"] } } }, annotations: { readOnlyHint: true } },
	      { name: "fixture_github_pr_gate", description: "Fail-closed evidence gate for one persisted fixture action. It is eligible only after both exact action-bound file reads were server-verified; it performs no credential use, mutation, or network write.", inputSchema: { type: "object", required: ["proof_mission_id", "proof_action_id"], properties: { proof_mission_id: { type: "string" }, proof_action_id: { type: "string" } } }, annotations: { readOnlyHint: true } },
    ],
  }));
  server.setRequestHandler(CallToolRequestSchema, async request => tools.call(request.params.name, (request.params.arguments ?? {}) as Record<string, unknown>));
  return server;
}

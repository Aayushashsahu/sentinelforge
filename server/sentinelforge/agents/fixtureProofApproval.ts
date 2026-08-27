import type { TrueForgeInlineAgentSpec } from "../trueforge/client";

export const FIXTURE_GITHUB_PR_GATE_TOOL_NAME = "fixture_github_pr_gate";

export function buildFixtureProofApprovalSpec(input: { model: string; toolsMcpName: string }): TrueForgeInlineAgentSpec {
  return {
    model: { name: input.model, params: { parallel_tool_calls: false } },
    instructions: "Mandatory execution sequence: invoke sentinelforge-tools get_file with the persisted proof identifiers and artifact package.json, then invoke get_file with the same proof identifiers and artifact release-manifest.json, then invoke fixture_github_pr_gate exactly once. Do not supply owner, repository, ref, or path for fixture proof reads; the server derives those values from immutable persisted intent. Do not produce a conversational answer before those three calls. The gate is non-mutating but represents only the exact future fixture proof: one dedicated branch, one release-manifest.json version alignment from 1.3.0 to 1.4.0, and one open unmerged pull request. Do not use a sandbox, GitHub write tool, credential, branch, commit, pull request, continuation, or any other tool. Stop at the approval gate.",
    mcp_servers: [{ name: input.toolsMcpName, enable_tools: ["get_file", FIXTURE_GITHUB_PR_GATE_TOOL_NAME], require_approval_for_tools: [FIXTURE_GITHUB_PR_GATE_TOOL_NAME], preload: true }],
    config: { iteration_limit: 5, sandbox: { enabled: false, file_downloads: false }, dynamic_sub_agents: { enabled: false }, ask_user_questions: { enabled: false } },
  };
}

export function buildFixtureProofApprovalMessage(input: { missionId: string; actionId: string }): string {
	return `This is a mandatory tool-execution workflow, not a conversational request. The server has persisted immutable proof identifiers: proof_mission_id "${input.missionId}" and proof_action_id "${input.actionId}". Call sentinelforge-tools.get_file with exactly those proof identifiers and artifact "package.json". Then call sentinelforge-tools.get_file with exactly those proof identifiers and artifact "release-manifest.json". Do not supply owner, repo, ref, or path: the server derives the canonical target from immutable persisted action intent. Only after both successful reads, call sentinelforge-tools.fixture_github_pr_gate exactly once with both proof identifiers. Do not write an answer before the calls. Stop at the approval gate; do not use a sandbox, credential, GitHub write, branch, commit, pull request, continuation, approval, or rejection.`;
}

import type { TrueForgeInlineAgentSpec } from "../trueforge/client";

export const FIXTURE_GITHUB_PR_GATE_TOOL_NAME = "fixture_github_pr_gate";

export function buildFixtureProofApprovalSpec(input: { model: string; toolsMcpName: string }): TrueForgeInlineAgentSpec {
  return {
    model: { name: input.model, params: { parallel_tool_calls: false } },
    instructions: "Mandatory execution sequence: invoke sentinelforge-tools fixture_github_pr_gate exactly once with the persisted proof identifiers. The server has already acquired and validated the canonical package.json and release-manifest.json evidence with the action-bound scratch credential; do not attempt or claim any file read. Do not supply owner, repository, ref, path, credential, branch, commit, pull request, continuation, approval, or rejection. Do not produce a conversational answer before the gate call. The gate is non-mutating but represents only the exact future fixture proof: one dedicated branch, one release-manifest.json version alignment from 1.3.0 to 1.4.0, and one open unmerged pull request. Do not use a sandbox, GitHub write tool, or any other tool. Stop at the approval gate.",
    mcp_servers: [{ name: input.toolsMcpName, enable_tools: [FIXTURE_GITHUB_PR_GATE_TOOL_NAME], require_approval_for_tools: [FIXTURE_GITHUB_PR_GATE_TOOL_NAME], preload: true }],
    config: { iteration_limit: 5, sandbox: { enabled: false, file_downloads: false }, dynamic_sub_agents: { enabled: false }, ask_user_questions: { enabled: false } },
  };
}

export function buildFixtureProofApprovalMessage(input: { missionId: string; actionId: string }): string {
		return `This is a mandatory tool-execution workflow, not a conversational request. The server has already verified the canonical package.json version 1.4.0 and release-manifest.json version 1.3.0 using its action-bound scratch credential. The server has persisted immutable proof identifiers: proof_mission_id "${input.missionId}" and proof_action_id "${input.actionId}". Call sentinelforge-tools.fixture_github_pr_gate exactly once with only those proof identifiers. Do not attempt or claim any file reads, and do not supply owner, repo, ref, path, credential, branch, commit, pull request, continuation, approval, or rejection. Do not write an answer before the gate call. Stop at the approval gate; do not use a sandbox, GitHub write, or any other tool.`;
}

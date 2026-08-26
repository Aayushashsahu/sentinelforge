import type { TrueForgeInlineAgentSpec } from "../trueforge/client";

export const REPAIR_PROPOSAL_GATE_TOOL_NAME = "repair_proposal_gate";

export function buildRepairProposalApprovalSpec(input: { model: string; toolsMcpName: string }): TrueForgeInlineAgentSpec {
  return {
    model: { name: input.model, params: { parallel_tool_calls: false } },
    instructions: "Mandatory execution sequence: invoke sentinelforge-tools get_file for package.json, then invoke get_file for release-manifest.json, then invoke repair_proposal_gate exactly once. Do not produce a conversational answer before those three calls; an answer without the calls is a failure. Use no tool other than those three first-party sentinelforge-tools calls. The gate is deliberately non-mutating and approval-gated; do not use a sandbox, GitHub write tool, branch, commit, pull request, or any other tool. Stop at the approval gate and do not continue after it.",
    mcp_servers: [{
      name: input.toolsMcpName,
      enable_tools: ["get_file", REPAIR_PROPOSAL_GATE_TOOL_NAME],
      require_approval_for_tools: [REPAIR_PROPOSAL_GATE_TOOL_NAME],
      preload: true,
    }],
    config: {
      iteration_limit: 5,
      sandbox: { enabled: false, file_downloads: false },
      dynamic_sub_agents: { enabled: false },
      ask_user_questions: { enabled: false },
    },
  };
}

export function buildRepairProposalApprovalMessage(input: { owner: string; repo: string; expectedManifestVersion: string }): string {
  return `This is a mandatory tool-execution workflow, not a conversational request. Call sentinelforge-tools.get_file for owner "${input.owner}", repo "${input.repo}", path "package.json", ref "main". Then call sentinelforge-tools.get_file again for the same owner and repo, path "release-manifest.json", ref "main". Read the actual file bodies and compare their versions; do not assume them. The persisted repair proposal must change only release-manifest.json, whose current expected version is ${input.expectedManifestVersion}, to the authoritative package.json version. Only after both successful reads, call sentinelforge-tools.repair_proposal_gate exactly once. You must not write a normal answer before these calls. Stop at the approval gate; do not invoke GitHub writes, a sandbox, branch, commit, pull request, approval continuation, approval, or rejection.`;
}

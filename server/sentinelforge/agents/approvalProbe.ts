import type { TrueForgeInlineAgentSpec } from "../trueforge/client";

export const APPROVAL_PROBE_TOOL_NAME = "approval_probe";

export function buildApprovalProbeSpec(input: { model: string; toolsMcpName: string }): TrueForgeInlineAgentSpec {
  return {
    model: { name: input.model },
    instructions: "Use only the approval_probe tool exactly once. It is a harmless non-mutating approval-mechanism probe. Do not use any other tool, do not use a sandbox, and do not continue after the approval gate.",
    mcp_servers: [{
      name: input.toolsMcpName,
      enable_tools: [APPROVAL_PROBE_TOOL_NAME],
      require_approval_for_tools: [APPROVAL_PROBE_TOOL_NAME],
      preload: true,
    }],
    config: {
      iteration_limit: 2,
      sandbox: { enabled: false, file_downloads: false },
      dynamic_sub_agents: { enabled: false },
      ask_user_questions: { enabled: false },
    },
  };
}

export function buildApprovalProbeMessage(input: { missionId: string }): string {
	return `Call approval_probe exactly once now with mission_id "${input.missionId}". This is an approval-gate verification only: do not use any other tool, do not use a sandbox, and do not provide a final answer before the approval gate.`;
}

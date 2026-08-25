import { describe, expect, it } from "vitest";
import { APPROVAL_PROBE_TOOL_NAME, buildApprovalProbeMessage, buildApprovalProbeSpec } from "./approvalProbe";

describe("TrueForge approval probe", () => {
  it("uses one harmless literal tool selector while keeping sandboxing and other tools disabled", () => {
    const spec = buildApprovalProbeSpec({ model: "nvidia-nim/nemotron", toolsMcpName: "sentinelforge-tools" });

    expect(spec.mcp_servers).toEqual([{
      name: "sentinelforge-tools",
      enable_tools: [APPROVAL_PROBE_TOOL_NAME],
      require_approval_for_tools: [APPROVAL_PROBE_TOOL_NAME],
      preload: true,
    }]);
    expect(spec.config).toEqual({
      iteration_limit: 2,
      sandbox: { enabled: false, file_downloads: false },
      dynamic_sub_agents: { enabled: false },
      ask_user_questions: { enabled: false },
    });
    expect(buildApprovalProbeMessage()).toContain("approval_probe exactly once");
  });
});

import { describe, expect, it } from "vitest";
import { buildRepairProposalApprovalMessage, buildRepairProposalApprovalSpec, REPAIR_PROPOSAL_GATE_TOOL_NAME } from "./repairApproval";

describe("repair proposal approval agent", () => {
  it("enables only the first-party file read and literal non-mutating approval gate", () => {
    const spec = buildRepairProposalApprovalSpec({ model: "provider/model", toolsMcpName: "sentinelforge-tools" });
    expect(spec.mcp_servers?.[0]).toEqual({ name: "sentinelforge-tools", enable_tools: ["get_file", REPAIR_PROPOSAL_GATE_TOOL_NAME], require_approval_for_tools: [REPAIR_PROPOSAL_GATE_TOOL_NAME], preload: true });
    expect(spec.config.sandbox.enabled).toBe(false);
    const message = buildRepairProposalApprovalMessage({ owner: "Aayushashsahu", repo: "sentinelforge-incident-fixture", expectedManifestVersion: "1.3.0" });
    expect(message).toContain("package.json");
    expect(message).toContain("release-manifest.json");
    expect(message).toContain(REPAIR_PROPOSAL_GATE_TOOL_NAME);
    expect(spec.instructions).toContain("Mandatory execution sequence");
  });
});

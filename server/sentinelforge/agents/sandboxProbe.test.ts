import { describe, expect, it } from "vitest";
import { buildSandboxProbeSpec, buildSandboxRepairVerificationSpec, SANDBOX_REPAIR_VERIFICATION_COMMAND } from "./sandboxProbe";

describe("TrueForge sandbox probe", () => {
  it("enables only the sandbox for one harmless bounded command and attaches no MCP server", () => {
    const spec = buildSandboxProbeSpec("nvidia-nim/nemotron");
    expect(spec.config.sandbox).toEqual({ enabled: true, file_downloads: false });
    expect(spec.config.iteration_limit).toBe(4);
    expect(spec.mcp_servers).toBeUndefined();
    expect(spec.instructions).toContain("printf sentinel-forge-sandbox-ok");
  });

  it("confines the proposed manifest repair and deterministic verifier to a sandbox-only agent", () => {
    const spec = buildSandboxRepairVerificationSpec("nvidia-nim/nemotron");
    expect(spec.config.sandbox).toEqual({ enabled: true, file_downloads: false });
    expect(spec.config.iteration_limit).toBe(1);
    expect(spec.mcp_servers).toBeUndefined();
    expect(spec.instructions).toContain(SANDBOX_REPAIR_VERIFICATION_COMMAND);
    expect(spec.instructions).toContain("1.4.0");
    expect(spec.instructions).toContain("do not use MCP, GitHub, network access, credentials, or host resources");
  });
});

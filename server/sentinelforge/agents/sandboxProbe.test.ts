import { describe, expect, it } from "vitest";
import { buildSandboxProbeSpec } from "./sandboxProbe";

describe("TrueForge sandbox probe", () => {
  it("enables only the sandbox for one harmless bounded command and attaches no MCP server", () => {
    const spec = buildSandboxProbeSpec("nvidia-nim/nemotron");
    expect(spec.config.sandbox).toEqual({ enabled: true, file_downloads: false });
    expect(spec.config.iteration_limit).toBe(4);
    expect(spec.mcp_servers).toBeUndefined();
    expect(spec.instructions).toContain("printf sentinel-forge-sandbox-ok");
  });
});

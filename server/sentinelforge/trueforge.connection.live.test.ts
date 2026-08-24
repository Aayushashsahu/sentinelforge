import { describe, expect, it } from "vitest";

const configuredBaseUrl = process.env.TRUEFORGE_BASE_URL?.replace(/\/+$/, "");

describe.skipIf(!configuredBaseUrl)("configured TrueForge runtime", () => {
  it("responds to the documented healthz endpoint without an Authorization header in no-auth mode", async () => {
    const response = await fetch(`${configuredBaseUrl}/healthz`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });

    expect(response.ok).toBe(true);
  }, 15_000);

  it("keeps the supplied model and GitHub MCP name server-side while validating reachability", async () => {
    expect(process.env.TRUEFORGE_MODEL).toBe("nemotron-3-5-lightning-30b-a3b");
    expect(process.env.TRUEFORGE_GITHUB_MCP_NAME).toBe("github");

    const response = await fetch(`${configuredBaseUrl}/healthz`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });

    expect(response.ok).toBe(true);
  }, 15_000);
});

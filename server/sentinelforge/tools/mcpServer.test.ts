import { describe, expect, it, vi } from "vitest";
import { GitHubReadApi } from "./githubRead";
import { getSentinelForgeToolsStatus, SentinelForgeTools } from "./mcpServer";

const fixtureOwner = "Aayushashsahu";
const fixtureRepo = "sentinelforge-incident-fixture";

describe("sentinelforge-tools", () => {
  it("reports the read-only tool surface, harmless approval gates, and fixture allowlist without returning a credential", () => {
    const status = getSentinelForgeToolsStatus();
    expect(status).toMatchObject({ name: "sentinelforge-tools", endpointPath: "/api/mcp/sentinelforge-tools", writeActionsEnabled: false, sandboxEnabled: false });
    expect(status.allowedRepositories).toEqual([`${fixtureOwner}/${fixtureRepo}`]);
    expect(status.tools).toEqual(["get_repository", "get_file", "get_issue", "get_workflow_run", "approval_probe", "repair_proposal_gate"]);
    expect(JSON.stringify(status)).not.toContain("GITHUB_READ_TOKEN");
  });

  it("returns decoded allowlisted file text as ordinary MCP text content without returning the token", async () => {
    const token = "server-only-test-token";
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ type: "file", encoding: "base64", content: Buffer.from('{"version":"1.4.0"}\n').toString("base64"), size: 20 }), { status: 200 }));
    const tools = new SentinelForgeTools(new GitHubReadApi(token, fetchImpl as typeof fetch));

    const result = await tools.call("get_file", { owner: fixtureOwner, repo: fixtureRepo, path: "package.json", ref: "main" });

    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([{ type: "text", text: expect.stringContaining('"version":"1.4.0"') }]);
    expect(JSON.stringify(result)).not.toContain(token);
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining(`/repos/${fixtureOwner}/${fixtureRepo}/contents/package.json?ref=main`), expect.objectContaining({ headers: expect.objectContaining({ authorization: `Bearer ${token}` }) }));
  });

  it("rejects repositories outside the explicit allowlist before making a network request", async () => {
    const fetchImpl = vi.fn();
    const tools = new SentinelForgeTools(new GitHubReadApi("server-only-test-token", fetchImpl as typeof fetch));

    const result = await tools.call("get_file", { owner: "other", repo: "repository", path: "package.json", ref: "main" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not an allowed SentinelForge investigation target");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns a constant harmless approval-probe value without reading GitHub or performing any write", async () => {
    const fetchImpl = vi.fn();
    const tools = new SentinelForgeTools(new GitHubReadApi("server-only-test-token", fetchImpl as typeof fetch));

    const result = await tools.call("approval_probe", {});

    expect(result).toEqual({ content: [{ type: "text", text: "sentinelforge-approval-probe: harmless" }] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns a constant non-mutating repair approval-gate value without reading GitHub or performing any write", async () => {
    const fetchImpl = vi.fn();
    const tools = new SentinelForgeTools(new GitHubReadApi("server-only-test-token", fetchImpl as typeof fetch));

    const result = await tools.call("repair_proposal_gate", {});

    expect(result.content[0].text).toContain("approval required");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

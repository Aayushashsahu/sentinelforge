import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { describe, expect, it } from "vitest";

const runLiveToolsTest = process.env.RUN_SENTINELFORGE_TOOLS_LIVE_TEST === "1";
const endpoint = process.env.SENTINELFORGE_TOOLS_MCP_URL ?? "http://127.0.0.1:3000/api/mcp/sentinelforge-tools";

describe.skipIf(!runLiveToolsTest)("sentinelforge-tools MCP endpoint", () => {
  it("returns the allowlisted fixture release evidence as ordinary MCP text", async () => {
    const client = new Client({ name: "sentinelforge-tools-contract-test", version: "1.0.0" }, { capabilities: {} });
    const transport = new StreamableHTTPClientTransport(new URL(endpoint));
    await client.connect(transport);
    try {
      const packageResult = await client.callTool({
        name: "get_file",
        arguments: { owner: "Aayushashsahu", repo: "sentinelforge-incident-fixture", path: "package.json", ref: "main" },
      });
      const manifestResult = await client.callTool({
        name: "get_file",
        arguments: { owner: "Aayushashsahu", repo: "sentinelforge-incident-fixture", path: "release-manifest.json", ref: "main" },
      });
      const testResult = await client.callTool({
        name: "get_file",
        arguments: { owner: "Aayushashsahu", repo: "sentinelforge-incident-fixture", path: "test.js", ref: "main" },
      });

      for (const result of [packageResult, manifestResult, testResult]) {
        expect(result.isError).not.toBe(true);
        expect(result.content).toHaveLength(1);
        expect(result.content[0]).toMatchObject({ type: "text" });
      }
      expect((packageResult.content[0] as { text: string }).text).toContain('"version": "1.4.0"');
      expect((manifestResult.content[0] as { text: string }).text).toContain('"version": "1.3.0"');
      expect((testResult.content[0] as { text: string }).text).toMatch(/release-manifest|version/i);
    } finally {
      await client.close();
    }
  }, 25_000);
});

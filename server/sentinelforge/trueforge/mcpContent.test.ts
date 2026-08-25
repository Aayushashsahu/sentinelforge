import { describe, expect, it } from "vitest";
import { extractMcpTextContent, hasNonMetadataFileText } from "./mcpContent";

describe("GitHub MCP file-content extraction", () => {
  it("consumes actual file text from a get_file_contents resource rather than discarding it as metadata", () => {
    const getFileContentsResponse = {
      content: [
        { type: "text", text: "successfully downloaded text file" },
        { type: "resource", resource: { uri: "repo://Aayushashsahu/sentinelforge/contents/README.md", mimeType: "text/plain; charset=utf-8", text: "# SentinelForge\n\nApproval-gated incident response." } },
      ],
    };
    expect(extractMcpTextContent(getFileContentsResponse)).toContainEqual({ source: "resource", text: "# SentinelForge\n\nApproval-gated incident response." });
    expect(hasNonMetadataFileText(getFileContentsResponse)).toBe(true);
  });

  it("does not mistake a SHA-only acknowledgement for actual file text", () => {
    const metadataOnlyResponse = { content: [{ type: "text", text: "successfully downloaded text file (SHA: 1fb71ffef5b8d75e8004ad291719f8bdf8d24d30)" }] };
    expect(hasNonMetadataFileText(metadataOnlyResponse)).toBe(false);
  });
});

export type McpTextContent = { text: string; source: "text" | "resource" };

/**
 * GitHub MCP may return a normal text acknowledgement plus a resource whose
 * `resource.text` contains the requested file. Preserve that text rather than
 * treating the acknowledgement, SHA, or URL as file content.
 */
export function extractMcpTextContent(payload: unknown): McpTextContent[] {
  if (!payload || typeof payload !== "object") return [];
  const content = Array.isArray((payload as { content?: unknown }).content)
    ? (payload as { content: unknown[] }).content
    : [];
  return content.flatMap<McpTextContent>(item => {
    if (!item || typeof item !== "object") return [];
    const record = item as { type?: unknown; text?: unknown; resource?: unknown };
    if (record.type === "text" && typeof record.text === "string" && record.text.trim()) return [{ text: record.text, source: "text" as const }];
    if ((record.type === "resource" || record.type === "embeddedResource") && record.resource && typeof record.resource === "object") {
      const resource = record.resource as { text?: unknown };
      if (typeof resource.text === "string" && resource.text.trim()) return [{ text: resource.text, source: "resource" as const }];
    }
    return [];
  });
}

export function hasNonMetadataFileText(payload: unknown): boolean {
  return extractMcpTextContent(payload).some(item => item.source === "resource" || !/^(successfully downloaded|sha[:\s]|https?:\/\/)/i.test(item.text.trim()));
}

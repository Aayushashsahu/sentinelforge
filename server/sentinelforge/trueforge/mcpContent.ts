export type NormalizedMcpContent =
  | { type: "text"; text: string }
  | { type: "resource"; uri: string | null; mimeType: string | null; text: string | null; blobPresent: boolean }
  | { type: "resource_link"; uri: string | null; name: string | null; mimeType: string | null; description: string | null; size: number | null };

export type McpTextContent = { text: string; source: "text" | "resource" };

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Normalizes only content already returned by the configured MCP client. It
 * never follows resource links or decodes resource blobs.
 */
export function normalizeMcpResultContent(payload: unknown): NormalizedMcpContent[] {
  if (!payload || typeof payload !== "object") return [];
  const content = Array.isArray((payload as { content?: unknown }).content)
    ? (payload as { content: unknown[] }).content
    : [];
  return content.flatMap<NormalizedMcpContent>(item => {
    if (!item || typeof item !== "object") return [];
    const record = item as { type?: unknown; text?: unknown; resource?: unknown; uri?: unknown; name?: unknown; mimeType?: unknown; description?: unknown; size?: unknown };
    if (record.type === "text" && typeof record.text === "string" && record.text.trim()) return [{ type: "text", text: record.text }];
    if ((record.type === "resource" || record.type === "embeddedResource") && record.resource && typeof record.resource === "object") {
      const resource = record.resource as { uri?: unknown; mimeType?: unknown; text?: unknown; blob?: unknown };
      return [{ type: "resource", uri: stringOrNull(resource.uri), mimeType: stringOrNull(resource.mimeType), text: stringOrNull(resource.text), blobPresent: typeof resource.blob === "string" && resource.blob.length > 0 }];
    }
    if (record.type === "resource_link") {
      return [{ type: "resource_link", uri: stringOrNull(record.uri), name: stringOrNull(record.name), mimeType: stringOrNull(record.mimeType), description: stringOrNull(record.description), size: numberOrNull(record.size) }];
    }
    return [];
  });
}

/** Returns the exact text that may safely be included in an agent-facing result. */
export function toAgentVisibleMcpText(payload: unknown): string {
  return normalizeMcpResultContent(payload).flatMap(block => {
    if (block.type === "text") return [block.text];
    if (block.type === "resource" && block.text) return [block.text];
    return [];
  }).join("\n");
}

/**
 * GitHub MCP may return a normal text acknowledgement plus a resource whose
 * `resource.text` contains the requested file. Preserve that text rather than
 * treating the acknowledgement, SHA, or URL as file content.
 */
export function extractMcpTextContent(payload: unknown): McpTextContent[] {
  return normalizeMcpResultContent(payload).flatMap<McpTextContent>(block => {
    if (block.type === "text") return [{ text: block.text, source: "text" }];
    if (block.type === "resource" && block.text) return [{ text: block.text, source: "resource" }];
    return [];
  });
}

export function hasNonMetadataFileText(payload: unknown): boolean {
  return extractMcpTextContent(payload).some(item => item.source === "resource" || !/^(successfully downloaded|sha[:\s]|https?:\/\/)/i.test(item.text.trim()));
}

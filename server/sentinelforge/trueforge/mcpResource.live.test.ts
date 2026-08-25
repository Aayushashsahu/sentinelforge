import { describe, expect, it } from "vitest";
import { buildReadOnlyInvestigatorSpec, parseInvestigatorResult } from "../agents/investigator";
import { containsGithubMcpToolEvent, mapTrueForgeSessionHistory } from "../liveWorkflow";
import { getTrueForgeRuntimeConfig, TrueForgeClient } from "./client";
import { readTrueForgeSse, TrueForgeSseAbortedError, type TrueForgeStreamEvent } from "./stream";

const runLiveTest = process.env.RUN_TRUEFORGE_MCP_RESOURCE_LIVE_TEST === "1";

function countResourceBlocks(value: unknown): number {
  if (Array.isArray(value)) return value.reduce((total, item) => total + countResourceBlocks(item), 0);
  if (!value || typeof value !== "object") return 0;
  const record = value as Record<string, unknown>;
  return (record.type === "resource" || record.type === "embeddedResource" ? 1 : 0) + Object.values(record).reduce((total, item) => total + countResourceBlocks(item), 0);
}

async function readOneBoundedTurn(client: TrueForgeClient, sessionId: string, message: string): Promise<TrueForgeStreamEvent[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75_000);
  try {
    const response = await client.createTurnStream({ sessionId, previousTurnId: "none", input: [{ type: "user.message", content: message }], signal: controller.signal });
    return await readTrueForgeSse(response, controller.signal);
  } catch (error) {
    if (!(error instanceof TrueForgeSseAbortedError) && !controller.signal.aborted) throw error;
    return mapTrueForgeSessionHistory(await client.listSessionEvents(sessionId));
  } finally {
    clearTimeout(timeout);
  }
}

describe.skipIf(!runLiveTest)("explicit live GitHub MCP resource verification", () => {
  it("uses one read-only GitHub MCP README call and answers the external-action question from its file body", async () => {
    const config = getTrueForgeRuntimeConfig();
    const client = new TrueForgeClient(config);
    const model = await client.resolveModelName(config.model);
    const session = await client.createInlineSession(buildReadOnlyInvestigatorSpec({ model, githubMcpName: config.githubMcpName }));
    const events = await readOneBoundedTurn(client, session.id, [
      "Use search_repositories for exactly Aayushashsahu/sentinelforge, then call get_file_contents exactly once with owner Aayushashsahu, repo sentinelforge, path README.md, and ref main.",
      "Consume content[].resource.text when present. Return the required Investigator JSON only. Answer: What does the SentinelForge README state about the current external action implementation?",
      "Your evidence must identify README.md and quote a non-empty verbatim README body excerpt that answers that question. A SHA, URI, filename, acknowledgement, or metadata is not evidence.",
      "Do not use shell, curl, git, sandbox, a custom GitHub client, a GitHub write, an approval action, any other file, or any other repository.",
    ].join(" "));

    const resourceBlocks = countResourceBlocks(events);
    const receivedGithubToolCall = containsGithubMcpToolEvent(events, config.githubMcpName);
    let finding = "unparseable";
    let evidenceSources: string[] = [];
    let readmeEvidence = "";
    try {
      const result = parseInvestigatorResult(events.map(event => event.data));
      finding = result.finding;
      evidenceSources = result.evidence.map(item => item.source);
      readmeEvidence = result.evidence.find(item => /README\.md/i.test(item.source))?.detail ?? "";
    } catch {
      // The raw event shape is the primary observation for this boundary test.
    }
    console.info(JSON.stringify({ sessionId: session.id, receivedGithubToolCall, resourceBlocks, evidenceSources, findingLength: finding.length, readmeEvidenceLength: readmeEvidence.length }));
    expect(receivedGithubToolCall).toBe(true);
    expect(readmeEvidence.length).toBeGreaterThan(24);
    expect(readmeEvidence).toMatch(/external action/i);
    expect(readmeEvidence).not.toMatch(/^(successfully downloaded|sha[:\s]|https?:\/\/)/i);
  }, 90_000);
});

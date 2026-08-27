import { describe, expect, it, vi } from "vitest";
import { readBoundedSessionHistory } from "./liveWorkflow";
import type { TrueForgeClient } from "./trueforge/client";

describe("bounded TrueForge session-history retrieval", () => {
  it("maps the documented parent turn envelope and capture session after direct stream completion", async () => {
    const listSessionEvents = vi.fn().mockResolvedValue({
      data: [
        { turn_id: "turn_1", event: { type: "turn.done", id: "done" } },
        { turn_id: "turn_1", event: { type: "mcp.initialize", id: "init", thread_id: "main", mcp_servers: [{ id: "mcp", name: "sentinelforge-tools" }] } },
      ],
    });

    const events = await readBoundedSessionHistory({ client: { listSessionEvents } as unknown as TrueForgeClient, sessionId: "session_1" });

    expect(listSessionEvents).toHaveBeenCalledTimes(1);
    expect(events).toEqual([
      { event: "turn.done", data: { type: "turn.done", id: "done" }, historyEnvelope: { sessionId: "session_1", turnId: "turn_1" } },
      { event: "mcp.initialize", data: { type: "mcp.initialize", id: "init", thread_id: "main", mcp_servers: [{ id: "mcp", name: "sentinelforge-tools" }] }, historyEnvelope: { sessionId: "session_1", turnId: "turn_1" } },
    ]);
  });
});

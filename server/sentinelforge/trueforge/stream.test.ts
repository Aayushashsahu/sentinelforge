import { describe, expect, it } from "vitest";
import { parseSseFrames, readTrueForgeSse } from "./stream";

describe("TrueForge SSE parser", () => {
  it("preserves named events and JSON payloads for append-only audit persistence", () => {
    const events = parseSseFrames('event: turn.created\ndata: {"id":"turn_1"}\n\nevent: model.message\ndata: {"text":"working"}\n\n');
    expect(events).toEqual([{ event: "turn.created", data: { id: "turn_1" } }, { event: "model.message", data: { text: "working" } }]);
  });

  it("returns promptly once the runtime emits a terminal turn event", async () => {
    let cancelled = false;
    const response = new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode('event: turn.done\ndata: {"type":"turn.done"}\n\n')); },
      cancel() { cancelled = true; },
    }));

    await expect(readTrueForgeSse(response)).resolves.toEqual([{ event: "turn.done", data: { type: "turn.done" } }]);
    expect(cancelled).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { parseSseFrames, readTrueForgeSse, TrueForgeSseAbortedError } from "./stream";

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

  it("cancels an open stream and reports an abort instead of returning partial events", async () => {
    let cancelled = false;
    const response = new Response(new ReadableStream({
      start() {},
      cancel() { cancelled = true; },
    }));
    const controller = new AbortController();
    const pending = readTrueForgeSse(response, controller.signal);
    controller.abort();

    await expect(pending).rejects.toBeInstanceOf(TrueForgeSseAbortedError);
    expect(cancelled).toBe(true);
  });

  it("contains a rejected cancellation during abort without creating an unhandled stream failure", async () => {
    let cancelled = false;
    const response = new Response(new ReadableStream({
      start() {},
      cancel() { cancelled = true; return Promise.reject(new DOMException("aborted", "AbortError")); },
    }));
    const controller = new AbortController();
    const pending = readTrueForgeSse(response, controller.signal);
    controller.abort();

    await expect(pending).rejects.toBeInstanceOf(TrueForgeSseAbortedError);
    expect(cancelled).toBe(true);
  });

  it("returns the controlled abort outcome even when cancellation never resolves", async () => {
    const response = new Response(new ReadableStream({
      start() {},
      cancel() { return new Promise<void>(() => undefined); },
    }));
    const controller = new AbortController();
    const pending = readTrueForgeSse(response, controller.signal);
    controller.abort();

    await expect(pending).rejects.toBeInstanceOf(TrueForgeSseAbortedError);
  });
});

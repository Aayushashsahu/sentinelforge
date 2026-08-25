export type TrueForgeStreamEvent = { event: string; data: unknown };

export class TrueForgeSseAbortedError extends Error {
  constructor() { super("TrueForge turn stream was aborted before a terminal event."); }
}

function decodeData(rawData: string): unknown {
  try { return JSON.parse(rawData); } catch { return rawData; }
}

export function parseSseFrames(raw: string): TrueForgeStreamEvent[] {
  return raw.split(/\r?\n\r?\n/).flatMap(frame => {
    const lines = frame.split(/\r?\n/);
    const event = lines.find(line => line.startsWith("event:"))?.slice(6).trim() ?? "message";
    const dataLines = lines.filter(line => line.startsWith("data:")).map(line => line.slice(5).trim());
    return dataLines.length > 0 ? [{ event, data: decodeData(dataLines.join("\n")) }] : [];
  });
}

function isTerminalTurnEvent(event: TrueForgeStreamEvent): boolean {
  return event.event === "turn.done" || (event.data !== null && typeof event.data === "object" && !Array.isArray(event.data) && (event.data as Record<string, unknown>).type === "turn.done");
}

export async function readTrueForgeSse(response: Response, signal?: AbortSignal): Promise<TrueForgeStreamEvent[]> {
  if (!response.body) throw new Error("TrueForge turn stream did not include a response body.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events: TrueForgeStreamEvent[] = [];
  let pending = "";
  let aborted = signal?.aborted ?? false;
  const onAbort = () => { aborted = true; void reader.cancel("TrueForge turn stream timeout."); };
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    if (aborted) throw new TrueForgeSseAbortedError();
    while (true) {
      const { done, value } = await reader.read();
      if (aborted) throw new TrueForgeSseAbortedError();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const frames = pending.split(/\r?\n\r?\n/);
      pending = frames.pop() ?? "";
      for (const frame of frames) {
        const parsed = parseSseFrames(frame);
        events.push(...parsed);
        if (parsed.some(isTerminalTurnEvent)) {
          await reader.cancel("Terminal TrueForge turn event received.");
          return events;
        }
      }
    }
    pending += decoder.decode();
    const finalEvents = parseSseFrames(pending);
    events.push(...finalEvents);
    return events;
  } finally {
    signal?.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
}

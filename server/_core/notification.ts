import { TRPCError } from "@trpc/server";
import { ENV } from "./env";

export type NotificationPayload = { title: string; content: string };
const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

const buildEndpointUrl = (baseUrl: string): string => new URL("webdevtoken.v1.WebDevService/SendNotification", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();

function validatePayload(input: NotificationPayload): NotificationPayload {
  const title = input.title.trim();
  const content = input.content.trim();
  if (!title) throw new TRPCError({ code: "BAD_REQUEST", message: "Notification title is required." });
  if (!content) throw new TRPCError({ code: "BAD_REQUEST", message: "Notification content is required." });
  if (title.length > TITLE_MAX_LENGTH) throw new TRPCError({ code: "BAD_REQUEST", message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.` });
  if (content.length > CONTENT_MAX_LENGTH) throw new TRPCError({ code: "BAD_REQUEST", message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.` });
  return { title, content };
}

/** Delivers an owner-facing approval alert and reports whether the upstream endpoint accepted it. */
export async function notifyOwner(payload: NotificationPayload): Promise<boolean> {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Notification service URL is not configured." });
  if (!ENV.forgeApiKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Notification service API key is not configured." });
  try {
    const response = await fetch(buildEndpointUrl(ENV.forgeApiUrl), { method: "POST", headers: { accept: "application/json", authorization: `Bearer ${ENV.forgeApiKey}`, "content-type": "application/json", "connect-protocol-version": "1" }, body: JSON.stringify({ title, content }) });
    if (!response.ok) { console.warn(`[Notification] Owner alert failed with ${response.status}.`); return false; }
    return true;
  } catch { console.warn("[Notification] Owner alert endpoint was unreachable."); return false; }
}

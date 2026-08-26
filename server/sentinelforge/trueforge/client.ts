import { ENV } from "../../_core/env";
import { z } from "zod";

export type TrueForgeRuntimeConfig = {
  baseUrl: string;
  token?: string;
  model: string;
  githubMcpName: string;
  toolsMcpName: string;
};

export type TrueForgeConnectionStatus = {
  connected: boolean;
  version: string | null;
  latencyMs: number | null;
  errorCode: "NOT_CONFIGURED" | "HTTP_ERROR" | "NETWORK_ERROR" | "TIMEOUT" | null;
  httpStatus: number | null;
  errorDetail: string | null;
};

const HEALTH_PATH = "/healthz";
const DEFAULT_TIMEOUT_MS = 12_000;
const sessionSchema = z.object({ id: z.string().min(1) }).passthrough();
const sessionEnvelopeSchema = z.union([sessionSchema, z.object({ data: sessionSchema })]);
const modelCatalogueSchema = z.object({ data: z.array(z.object({ name: z.string().min(1) })) });

export type TrueForgeInlineAgentSpec = {
  model: { name: string; params?: { parallel_tool_calls?: boolean; [key: string]: unknown } };
  instructions: string;
  mcp_servers?: Array<{
    name: string;
    enable_tools: string[];
    require_approval_for_tools: string[];
    preload: true;
  }>;
  response_format?: { type: "json_object" };
  config: {
    iteration_limit: number;
    sandbox: { enabled: boolean; file_downloads: boolean };
    dynamic_sub_agents: { enabled: false };
    ask_user_questions: { enabled: false };
  };
};

export type TrueForgeRemoteSession = z.infer<typeof sessionSchema>;
export type TrueForgeTurnInput =
  | { type: "user.message"; content: string }
  | { type: "user.tool_approval"; thread_id: string; tool_call_id: string; approval: { status: "allow" } | { status: "deny"; reason?: string } };

export class TrueForgeHttpError extends Error {
  constructor(readonly status: number, readonly body: string, readonly path: string) {
    super(`TrueForge request failed for ${path}: HTTP ${status}.${sanitizeRemoteErrorDetail(body) ? ` Detail: ${sanitizeRemoteErrorDetail(body)}` : ""}`);
  }
}

function sanitizeRemoteErrorDetail(value: string): string {
  return value
    .slice(0, 1_000)
    .replace(/(bearer\s+)[^\s"']+/gi, "$1[REDACTED]")
    .replace(/(["']?(?:authorization|token|secret|api[_-]?key)["']?\s*[:=]\s*)["']?[^,}\s"']+["']?/gi, "$1[REDACTED]");
}

export function normalizeTrueForgeBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, "");
  if (!normalized) throw new Error("TRUEFORGE_BASE_URL is not configured.");
  const url = new URL(normalized);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("TRUEFORGE_BASE_URL must use HTTP or HTTPS.");
  return url.toString().replace(/\/+$/, "");
}

export function getTrueForgeRuntimeConfig(): TrueForgeRuntimeConfig {
  return {
    baseUrl: normalizeTrueForgeBaseUrl(ENV.trueForgeBaseUrl),
    ...(ENV.trueForgeToken ? { token: ENV.trueForgeToken } : {}),
    model: ENV.trueForgeModel,
    githubMcpName: ENV.trueForgeGithubMcpName,
    toolsMcpName: ENV.trueForgeToolsMcpName,
  };
}

function extractVersion(payload: string): string | null {
  try {
    const parsed = JSON.parse(payload) as { version?: unknown };
    return typeof parsed.version === "string" ? parsed.version : null;
  } catch {
    return null;
  }
}

export class TrueForgeClient {
  constructor(
    private readonly config: TrueForgeRuntimeConfig,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {}

  private buildHeaders(contentType = false): Record<string, string> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (contentType) headers["content-type"] = "application/json";
    if (this.config.token) headers.authorization = `Bearer ${this.config.token}`;
    return headers;
  }

  async probeHealth(): Promise<TrueForgeConnectionStatus> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.config.baseUrl}${HEALTH_PATH}`, {
        headers: this.buildHeaders(), signal: controller.signal,
      });
      const body = await response.text();
      if (!response.ok) return { connected: false, version: extractVersion(body), latencyMs: Date.now() - startedAt, errorCode: "HTTP_ERROR", httpStatus: response.status, errorDetail: body || response.statusText || "TrueForge healthz request failed." };
      return { connected: true, version: extractVersion(body), latencyMs: Date.now() - startedAt, errorCode: null, httpStatus: response.status, errorDetail: null };
    } catch (error) {
      return { connected: false, version: null, latencyMs: Date.now() - startedAt, errorCode: controller.signal.aborted ? "TIMEOUT" : "NETWORK_ERROR", httpStatus: null, errorDetail: error instanceof Error ? error.message : "TrueForge healthz request failed." };
    } finally {
      clearTimeout(timeout);
    }
  }

  async resolveModelName(configuredName: string): Promise<string> {
    if (configuredName.includes("/")) return configuredName;
    const response = await this.fetchImpl(`${this.config.baseUrl}/api/v1/models`, { headers: this.buildHeaders() });
    const responseBody = await response.text();
    if (!response.ok) throw new TrueForgeHttpError(response.status, responseBody, "/api/v1/models");
    let parsed: unknown;
    try { parsed = JSON.parse(responseBody); } catch { throw new Error("TrueForge model catalogue response was not valid JSON."); }
    const catalogue = modelCatalogueSchema.safeParse(parsed);
    if (!catalogue.success) throw new Error("TrueForge model catalogue response was malformed.");
    const matches = catalogue.data.data.filter(model => model.name === configuredName || model.name.endsWith(`/${configuredName}`));
    if (matches.length !== 1) throw new Error(`Configured TRUEFORGE_MODEL could not be resolved uniquely from the live TrueForge model catalogue: ${configuredName}`);
    return matches[0]!.name;
  }

  private async postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    const response = await this.fetchImpl(`${this.config.baseUrl}${path}`, {
      method: "POST", headers: this.buildHeaders(true), body: JSON.stringify(body), signal,
    });
    const responseBody = await response.text();
    if (!response.ok) throw new TrueForgeHttpError(response.status, responseBody, path);
    try {
      return JSON.parse(responseBody) as T;
    } catch {
      throw new TrueForgeHttpError(response.status, `Expected JSON response; received: ${responseBody}`, path);
    }
  }

  async createInlineSession(agent: TrueForgeInlineAgentSpec, signal?: AbortSignal): Promise<TrueForgeRemoteSession> {
    const response = await this.postJson<unknown>("/api/v1/sessions", { agent: { spec: agent } }, signal);
    const parsed = sessionEnvelopeSchema.safeParse(response);
    if (!parsed.success) throw new Error("TrueForge session response was malformed.");
    return ("data" in parsed.data ? parsed.data.data : parsed.data) as TrueForgeRemoteSession;
  }

  async listSessionEvents(sessionId: string, signal?: AbortSignal): Promise<unknown> {
    const path = `/api/v1/sessions/${encodeURIComponent(sessionId)}/events`;
    const response = await this.fetchImpl(`${this.config.baseUrl}${path}`, { headers: this.buildHeaders(), signal });
    const responseBody = await response.text();
    if (!response.ok) throw new TrueForgeHttpError(response.status, responseBody, "/api/v1/sessions/:sessionId/events");
    try { return JSON.parse(responseBody) as unknown; } catch { throw new Error("TrueForge session event history response was not valid JSON."); }
  }

  async createTurnStream(input: { sessionId: string; input: TrueForgeTurnInput[]; previousTurnId?: "auto" | "none" | string; signal?: AbortSignal }): Promise<Response> {
    const response = await this.fetchImpl(`${this.config.baseUrl}/api/v1/sessions/${encodeURIComponent(input.sessionId)}/turns`, {
      method: "POST",
      headers: { ...this.buildHeaders(true), accept: "text/event-stream" },
      body: JSON.stringify({ input: input.input, ...(input.previousTurnId ? { previous_turn_id: input.previousTurnId } : {}) }),
      signal: input.signal,
    });
    if (!response.ok) throw new TrueForgeHttpError(response.status, await response.text(), "/api/v1/sessions/:sessionId/turns");
    return response;
  }
}

export async function probeConfiguredTrueForge(): Promise<TrueForgeConnectionStatus> {
  try {
    return await new TrueForgeClient(getTrueForgeRuntimeConfig()).probeHealth();
  } catch (error) {
    return { connected: false, version: null, latencyMs: null, errorCode: "NOT_CONFIGURED", httpStatus: null, errorDetail: error instanceof Error ? error.message : "TrueForge is not configured." };
  }
}

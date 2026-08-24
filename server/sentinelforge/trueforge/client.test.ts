import { describe, expect, it, vi } from "vitest";
import { TrueForgeClient, TrueForgeHttpError, normalizeTrueForgeBaseUrl } from "./client";

describe("TrueForgeClient", () => {
  it("normalizes a base URL and omits Authorization in standalone no-auth mode", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ version: "0.1.4" }), { status: 200 }));
    const client = new TrueForgeClient({ baseUrl: normalizeTrueForgeBaseUrl("https://runtime.example///"), model: "nemotron", githubMcpName: "github" }, fetchImpl);

    await expect(client.probeHealth()).resolves.toMatchObject({ connected: true, version: "0.1.4", httpStatus: 200, errorCode: null });
    expect(fetchImpl).toHaveBeenCalledWith("https://runtime.example/healthz", expect.objectContaining({ headers: { accept: "application/json" } }));
  });

  it("includes bearer authentication only when an explicit token exists", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("ok", { status: 200 }));
    const client = new TrueForgeClient({ baseUrl: "https://runtime.example", token: "token", model: "nemotron", githubMcpName: "github" }, fetchImpl);

    await client.probeHealth();
    expect(fetchImpl).toHaveBeenCalledWith("https://runtime.example/healthz", expect.objectContaining({ headers: { accept: "application/json", authorization: "Bearer token" } }));
  });

  it("returns exact HTTP status and body when healthz is unsuccessful", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("runtime unavailable", { status: 503, statusText: "Service Unavailable" }));
    const client = new TrueForgeClient({ baseUrl: "https://runtime.example", model: "nemotron", githubMcpName: "github" }, fetchImpl);

    await expect(client.probeHealth()).resolves.toMatchObject({ connected: false, errorCode: "HTTP_ERROR", httpStatus: 503, errorDetail: "runtime unavailable" });
  });

  it("resolves an unqualified configured model against the runtime catalogue", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: [{ name: "nvidia-nim/nemotron-3-5-lightning-30b-a3b" }] }), { status: 200 }));
    const client = new TrueForgeClient({ baseUrl: "https://runtime.example", model: "nemotron-3-5-lightning-30b-a3b", githubMcpName: "github" }, fetchImpl);

    await expect(client.resolveModelName("nemotron-3-5-lightning-30b-a3b")).resolves.toBe("nvidia-nim/nemotron-3-5-lightning-30b-a3b");
    expect(fetchImpl).toHaveBeenCalledWith("https://runtime.example/api/v1/models", { headers: { accept: "application/json" } });
  });

  it("creates an inline session through the documented endpoint with a read-only MCP policy", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: { id: "session_1" } }), { status: 201 }));
    const client = new TrueForgeClient({ baseUrl: "https://runtime.example", model: "nemotron", githubMcpName: "github" }, fetchImpl);
    const session = await client.createInlineSession({
      model: { name: "nemotron" }, instructions: "Investigate safely.", mcp_servers: [{ name: "github", enable_tools: ["@read-only"], require_approval_for_tools: ["@write", "@destructive"], preload: true }], config: { iteration_limit: 12, sandbox: { enabled: false, file_downloads: false }, dynamic_sub_agents: { enabled: false }, ask_user_questions: { enabled: false } },
    });

    expect(session.id).toBe("session_1");
    expect(fetchImpl).toHaveBeenCalledWith("https://runtime.example/api/v1/sessions", expect.objectContaining({ method: "POST", headers: { accept: "application/json", "content-type": "application/json" } }));
    const request = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(request.body as string)).toMatchObject({ agent: { spec: { model: { name: "nemotron" }, mcp_servers: [{ name: "github", enable_tools: ["@read-only"] }] } } });
  });

  it("surfaces non-successful remote session responses without fabricating a session", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("model unavailable", { status: 422 }));
    const client = new TrueForgeClient({ baseUrl: "https://runtime.example", model: "nemotron", githubMcpName: "github" }, fetchImpl);
    const agent = { model: { name: "nemotron" }, instructions: "x", mcp_servers: [], config: { iteration_limit: 1, sandbox: { enabled: false as const, file_downloads: false as const }, dynamic_sub_agents: { enabled: false as const }, ask_user_questions: { enabled: false as const } } };

    await expect(client.createInlineSession(agent)).rejects.toMatchObject({ status: 422, body: "model unavailable", message: expect.stringContaining("model unavailable") });
  });

  it("redacts sensitive server-validation fields before exposing an HTTP error message", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"token":"private-value","detail":"invalid"}', { status: 422 }));
    const client = new TrueForgeClient({ baseUrl: "https://runtime.example", model: "nemotron", githubMcpName: "github" }, fetchImpl);
    const agent = { model: { name: "nemotron" }, instructions: "x", mcp_servers: [], config: { iteration_limit: 1, sandbox: { enabled: false as const, file_downloads: false as const }, dynamic_sub_agents: { enabled: false as const }, ask_user_questions: { enabled: false as const } } };

    await expect(client.createInlineSession(agent)).rejects.toThrow(/"token":\[REDACTED\]/);
  });
});

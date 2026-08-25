import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { randomUUID } from "crypto";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { appRouter } from "../routers";
import { createSentinelForgeToolsMcpServer } from "../sentinelforge/tools/mcpServer";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => server.close(() => resolve(true)));
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port += 1) if (await isPortAvailable(port)) return port;
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const sentinelForgeToolsTransports = new Map<string, StreamableHTTPServerTransport>();
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  app.all("/api/mcp/sentinelforge-tools", async (req, res, next) => {
    try {
      const incomingSessionId = typeof req.headers["mcp-session-id"] === "string" ? req.headers["mcp-session-id"] : undefined;
      let transport = incomingSessionId ? sentinelForgeToolsTransports.get(incomingSessionId) : undefined;
      if (!transport) {
        if (req.body?.method !== "initialize") {
          res.status(400).json({ jsonrpc: "2.0", error: { code: -32000, message: "MCP session is not initialized." }, id: req.body?.id ?? null });
          return;
        }
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: sessionId => {
            sentinelForgeToolsTransports.set(sessionId, transport!);
          },
        });
        transport.onclose = () => {
          if (transport?.sessionId) sentinelForgeToolsTransports.delete(transport.sessionId);
        };
        await createSentinelForgeToolsMcpServer().connect(transport);
      }
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("[sentinelforge-tools] MCP transport request failed", error instanceof Error ? error.message : "Unknown transport error.");
      next(error);
    }
  });
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  if (process.env.NODE_ENV === "development") await setupVite(app, server);
  else serveStatic(app);
  const preferredPort = Number.parseInt(process.env.PORT ?? "3000", 10);
  const port = await findAvailablePort(preferredPort);
  server.listen(port, () => console.log(`Server running on http://localhost:${port}/`));
}

startServer().catch(console.error);

import { loadConfig } from "./config";
import { connectDb } from "./db";
import { createApp } from "./calendar/routes";

import { createMcpHttpApp } from "./mcp/httpTransport";
import type { Server } from "node:http";

async function main(): Promise<void> {
  const config = loadConfig();
  await connectDb(config.mongoUri);
  const app = createApp(config);

// Temporary runtime env endpoint (development only)
app.get("/env", (_req, res) => {
  // if (process.env.NODE_ENV === "production") {
  //   return res.status(403).json({ error: "Disabled in production." });
  // }

  res.json(process.env);
});
 
  // Mount MCP HTTP endpoint
  app.use("/mcp", createMcpHttpApp());

  const server: Server = app.listen(config.port, () => {
    console.log(`Rytham API http://127.0.0.1:${config.port}`);
    console.log(`MCP HTTP  http://127.0.0.1:${config.port}/mcp`);
  });

  // Graceful shutdown for Render (sends SIGTERM on deploy)
  const shutdown = () => {
    console.log("[Server] Graceful shutdown initiated...");
    server.close(() => {
      console.log("[Server] HTTP server closed");
      process.exit(0);
    });
    // Force exit after 10 seconds if graceful shutdown stalls
    setTimeout(() => {
      console.error("[Server] Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

import fs from "node:fs";
import path from "node:path";
import type { Express, NextFunction, Request, Response } from "express";
import express from "express";

const API_PREFIXES = [
  "/auth",
  "/api",
  "/chat",
  "/usage",
  "/activities",
  "/calendar",
  "/health",
  "/mcp",
];

function isApiPath(requestPath: string): boolean {
  if (requestPath === "/chat" || requestPath === "/usage") {
    return false;
  }
  return API_PREFIXES.some(
    (prefix) => requestPath === prefix || requestPath.startsWith(`${prefix}/`),
  );
}

export function mountWeb(app: Express): void {
  const webDist = path.join(process.cwd(), "web", "dist");
  const indexFile = path.join(webDist, "index.html");
  if (!fs.existsSync(indexFile)) {
    return;
  }

  app.use(express.static(webDist));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    if (isApiPath(req.path)) {
      next();
      return;
    }
    res.sendFile(indexFile);
  });
}

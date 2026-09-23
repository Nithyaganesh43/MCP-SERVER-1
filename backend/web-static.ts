import fs from "node:fs";
import path from "node:path";
import type { Express, NextFunction, Request, Response } from "express";
import express from "express";

const API_PREFIXES = [
  "/auth",
  "/api",
  "/google",
  "/chat",
  "/usage",
  "/activities",
  "/calendar",
  "/health",
  "/mcp",
  "/env",
];

function isApiPath(requestPath: string): boolean {
  if (requestPath === "/chat" || requestPath === "/usage") {
    return false;
  }
  return API_PREFIXES.some(
    (prefix) => requestPath === prefix || requestPath.startsWith(`${prefix}/`),
  );
}

function resolveWebDist(): string | null {
  const candidates = [
    path.join(process.cwd(), "web", "dist"),
    path.join(process.cwd(), "backend", "web", "dist"),
    path.resolve(__dirname, "web", "dist"),
    path.resolve(__dirname, "..", "web", "dist"),
  ];
  for (const dir of candidates) {
    const indexFile = path.join(dir, "index.html");
    if (fs.existsSync(indexFile)) {
      return dir;
    }
  }
  return null;
}

export function mountWeb(app: Express): void {
  const webDist = resolveWebDist();
  if (!webDist) {
    return;
  }
  const indexFile = path.join(webDist, "index.html");

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

# Rytham MCP Server — Render Deployment & API Key Authentication

This document details how to deploy the Rytham MCP (Model Context Protocol) server to [Render](https://render.com), configure API Key Authentication, and connect remote client tools such as Cursor or backend integration services.

---

## 1. Architecture Overview

```
                        ┌─────────────────────────────────────┐
                        │        Cursor / Remote MCP Client   │
                        └──────────────────┬──────────────────┘
                                           │
                                           │ HTTP POST /mcp
                                           │ Header: X-MCP-API-Key: rk_live_...
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Render Web Service (rytham-api)                                              │
│                                                                             │
│   ┌───────────────────────────┐    ┌────────────────────────────────────┐   │
│   │ Express App (/activities) │    │ MCP Router (/mcp)                   │   │
│   └───────────────────────────┘    └─────────────────┬──────────────────┘   │
│                                                      │                      │
│                                                      ▼                      │
│                                            [ requireMcpApiKey ]             │
│                                                      │                      │
│                                                      ▼                      │
│                                         [ StreamableHTTPServerTransport ]   │
│                                                      │                      │
│                                                      ▼                      │
│                                              [ ToolRegistry ]               │
│                                           (calendar.* tools)                │
└─────────────────────────────────────────────────────────────────────────────┘
```

The MCP Server runs in two modes:
1. **HTTP Transport (`/mcp`)**: Production-ready endpoint deployed on Render, protected by `X-MCP-API-Key`.
2. **STDIO Transport**: Local development mode (`npm run start:mcp`), preserving instant local Cursor workflow.

---

## 2. Environment Variables Reference

| Variable | Required | Description | Example |
|---|---|---|---|
| `NODE_ENV` | Yes | Application environment | `production` |
| `MONGODB_URI` | Yes | MongoDB Connection String | `mongodb+srv://user:pass@cluster.mongodb.net/rytham` |
| `JWT_SECRET` | Yes | Secret for JWT signing & verification | `d5d027...` |
| `MCP_API_KEY` | Yes (in Prod) | API key for authenticating `/mcp` requests | `rk_live_8f93a1c4b2e56789` |
| `MCP_USER_ID` | Optional | User ID associated with API Key requests | `68c0e0010000000000000001` |
| `TIMEZONE` | Optional | Default timezone (defaults to `Asia/Kolkata`) | `Asia/Kolkata` |
| `PORT` | Optional | HTTP Port (defaults to `3000`, Render injects `PORT`) | `10000` |

---

## 3. Render Deployment Setup

### Option A: Deploy via Blueprint (`render.yaml`)

1. Connect your repository to Render.
2. Select **New > Blueprint**.
3. Point to `render.yaml` in the root of the repository.
4. Fill in secret environment variables in the Render Dashboard (`MONGODB_URI`, `JWT_SECRET`, `MCP_API_KEY`, etc.).

### Option B: Manual Web Service Setup

1. **Service Type**: Web Service
2. **Runtime**: Node
3. **Build Command**: `cd backend && npm ci && npm run build`
4. **Start Command**: `cd backend && node dist/server.js`
5. **Health Check Path**: `/health`

---

## 4. API Key Authentication

All remote requests to `/mcp` must supply the configured API key in the `X-MCP-API-Key` HTTP header.

### Header Format
```http
X-MCP-API-Key: rk_live_xxxxxxxxx
```

### Behavior
- **Missing Key** → `401 Unauthorized` (`{ "error": "Unauthorized", "message": "Missing X-MCP-API-Key header" }`)
- **Invalid Key** → `401 Unauthorized` (`{ "error": "Unauthorized", "message": "Invalid API key" }`)
- **Valid Key** → Request proceeds to MCP execution.
- Security: Uses `crypto.timingSafeEqual` constant-time comparison to prevent timing attacks.
- Logs: Full API keys are **never** logged to stdout/stderr or log services.

---

## 5. Client Configuration Examples

### Cursor (Remote MCP Server)

Add the following to your `.cursor/mcp.json` or global Cursor settings:

```json
{
  "mcpServers": {
    "rytham": {
      "url": "https://<your-render-app>.onrender.com/mcp",
      "headers": {
        "X-MCP-API-Key": "rk_live_xxxxxxxxx"
      }
    }
  }
}
```

### Cursor (Local Development - STDIO)

For local development without deploying, standard STDIO transport continues to work unchanged:

```json
{
  "mcpServers": {
    "rytham-mcp-server": {
      "command": "npx",
      "args": [
        "tsx",
        "d:/Professional-projects/PersonalAi/backend/mcp/server.ts"
      ],
      "cwd": "d:/Professional-projects/PersonalAi/backend",
      "env": {
        "MONGODB_URI": "mongodb+srv://...",
        "JWT_SECRET": "...",
        "TIMEZONE": "Asia/Kolkata"
      }
    }
  }
}
```

---

## 6. Verification & Health Checks

- **Health Check**: `GET https://<your-render-app>.onrender.com/health` (Returns `200 OK` `{ "ok": true, "db": true }`)
- **MCP Endpoint**: `POST https://<your-render-app>.onrender.com/mcp` (Protected by `X-MCP-API-Key`)

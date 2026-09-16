# Rytham Architecture & Folder Structure Specification

This document defines the folder structure rules, architectural patterns, visual file tree, and detailed file-by-file context for the **Rytham Personal AI** repository. Every AI agent working on this repository must read and understand this file to ensure zero context loss, consistent file placement, and strict modularity.

---

# Section 1: Folder Structure Rules

## 1. Core Architectural Philosophy & Plug-and-Play Architecture (Locked)
- **Modularity:** Every service or feature component in Rytham must sit inside `backend/modules/<name>/` with standard contract files:
  - `tools.ts` — Tool definitions and exports.
  - `prompts.ts` — AI prompt definitions (if applicable).
  - `types.ts` — TypeScript interfaces and type declarations.
  - `index.ts` — Public barrel export for the module.
- **The 2–3 File Rule:** Adding, extending, or integrating a module must **never require editing more than 2–3 existing files** (e.g., registering in `backend/registry/modules.ts` and updating configuration/constants).
- **Core Domain Separation:** Primary backend capabilities live in dedicated domain directories (`backend/calendar/`, `backend/calendar-intelligence/`, `backend/auth/`, `backend/karen/`, `backend/reflection/`). Each domain directory maintains a clean internal separation:
  - `contract.ts` — Tool I/O contracts, z/custom input parsers, allowed update paths.
  - `service.ts` — Core business logic, data access, and rule enforcement.
  - `http.ts` — REST endpoint transport delegating directly to `service.ts`.

## 2. Directory Organization Principles
- **Root Directory (`PersonalAi/`):** Houses primary agent entry point (`agent.md`), cloud deployment configs (`render.yaml`), backend source code, and root dotfiles.
- **`doc/` Directory:** Consolidated documentation folder containing all operational protocols, rules, schemas, plans, and agent tracking files.
  - `doc/rules.md` — Consolidated repository rules & mandatory multi-agent checklist.
  - `doc/folder structure.md` — Folder structure rules & comprehensive AI file context.
  - `doc/generic prompt.md` — Agent prompt template reference.
  - `doc/image.png` — Visual documentation reference image.
  - `doc/plans/` — Dedicated folder containing feature blueprints, architecture specifications, and module contracts (`plan.md`, `plan-b.md`).
  - `doc/activeagents/` — The single source of truth for parallel agent task tracking and archiving (`active/`, `finished/`).
- **`backend/` Directory:** Node.js/Express server written in TypeScript.
- **`backend/model/` Directory:** Centralized database domain layer. Holds database models, TypeScript contracts, Mongoose schemas, and global constants.
- **`backend/mcp/` Directory:** Model Context Protocol (MCP) server layer exposing AI tools via stdio and Streamable HTTP.
- **`backend/orchestrator/` Directory:** Built AI Orchestrator (Karen Core): Intent → Context → Planner → Execute → Response. Transport: `POST /chat`.
- **`backend/tests/` Directory:** Complete test suite using Jest, Supertest, and MongoMemoryServer.

## 3. Naming Conventions
- **Filenames:** Use lowercase `kebab-case` for multi-word filenames (e.g., `calendar-intelligence.ts`, `scheduling-preference.types.ts`, `plan-b.md`).
- **Model Files:** Database entities use paired files: `<entity>.types.ts` (interfaces) and `<entity>.schema.ts` (Mongoose schema).
- **Test Files:** Named `<feature>.test.ts` or `<module>.test.ts` placed inside `backend/tests/`.
- **Active Agent Files:** Must follow sequential date-based indexing: `doc/activeagents/active/<index>_<agent-name>-<feature>.md` (e.g., `1_workflow-multi-agent.md`).

## 4. File Placement Rules
- **Constants & Enums:** All closed enums, default values, priority mappings, and database indexes belong exclusively in `backend/model/constants.ts`.
- **Database Contracts:** All database document interfaces belong in `backend/model/*.types.ts`.
- **Tool Contracts:** Input/output types, validation rules, and endpoint mappings belong in `<module>/contract.ts`.
- **Business Logic:** Core application logic belongs in `<module>/service.ts`.
- **MCP Registrations:** MCP tool registration functions belong in `backend/mcp/modules/<module>.ts`.
- **HTTP Transport:** REST routes belong in `<module>/http.ts` or `backend/auth/http.ts`.
- **Feature Plans & Specs:** Product design blueprints and multi-module specifications belong in `doc/plans/`.
- **Documentation & Rules:** Operational rules and specifications belong in `doc/`.

## 5. Mandatory Maintenance Rule (Folder Structure Update Protocol)
- **CRITICAL:** Whenever ANY file or folder in this repository is **created**, **added**, **renamed**, **moved**, or **deleted**, the agent modifying the filesystem MUST immediately update this file (`doc/folder structure.md`).
- Section 1 (rules) and Section 2 (file breakdown & context) MUST be kept 100% synchronized with the actual workspace state.
- No task is complete until `doc/folder structure.md` accurately reflects the codebase.

---

# Section 2: Actual Folder Structure & Comprehensive File Context

## Project Visual Tree

```
PersonalAi/
├── agent.md                          # Multi-Agent Protocol & Rytham Operating Contract Pointer
├── render.yaml                       # Render deployment blueprint (Hosted MCP & Web Service)
├── .gitignore                        # Git exclusion rules (.env, node_modules, .cursor/mcp.json)
├── .cursor/
│   ├── mcp.json                      # Cursor MCP local configuration (Streamable HTTP URL)
│   └── rules/
│       └── rytham-workflow.mdc       # Always-apply Cursor rule enforcing agent.md
├── doc/                              # Repository Documentation & Rules Directory
│   ├── rules.md                      # Consolidated repository rules & agent checklist
│   ├── folder structure.md           # Folder structure rules & full AI file context
│   ├── generic prompt.md             # Agent prompt template reference
│   ├── image.png                     # Visual documentation asset
│   ├── plans/                        # Product & Architecture Specifications
│   │   ├── plan.md                   # AI Orchestrator Specification V2
│   │   └── plan-b.md                 # Karen Module & Calendar Intelligence Spec
│   └── activeagents/                 # Parallel Agent Task Tracking & Archiving
│       ├── active/
│       │   ├── .gitkeep
│       │   └── Rytham Architecture Principles.md # Architectural reference document
│       └── finished/
│           ├── .gitkeep
│           ├── 1_workflow-multi-agent.md
│           ├── 2_orchestrator-spec-v2.md
│           ├── 3_composer-completion-contract.md
│           ├── 4_calendar-intelligence-module.md
│           ├── 5_rytham-karen-memory.md
│           ├── 6_rytham-reflection-module.md
│           ├── 7_rytham-conversation-context.md
│           ├── 8_composer-module5-collections.md
│           ├── 9_verifier-verify-and-fix.md
│           ├── 10_orchestrator-karen-core.md
│           ├── 11_client-spa-auth-chat-usage.md
│           ├── 12_env-production.md
│           └── 13_cursor-render-build-jest-types.md
└── backend/
    ├── package.json                  # Node.js dependencies & scripts
    ├── package-lock.json             # Lockfile
    ├── tsconfig.json                 # TypeScript compiler configuration (includes Jest types for tests)
    ├── tsconfig.build.json           # Production tsc config (no Jest; excludes tests)
    ├── jest.config.js                # Jest test runner configuration
    ├── .env                          # Secrets & env variables (GITIGNORED)
    ├── .env.example                  # Environment variable key template
    ├── oauth.json                    # Local Google OAuth download reference (GITIGNORED)
    ├── server.ts                     # Express server entry point & startup
    ├── config.ts                     # Centralized env loader & config constants
    ├── db.ts                         # Mongoose connection & index sync helper
    ├── errors.ts                     # HttpError class definition
    ├── web-static.ts                 # Serves backend/web/dist at `/` (SPA fallback)
    ├── MCP_DEPLOYMENT.md             # Remote Render MCP deployment notes
    ├── model/
    │   ├── index.ts                  # Barrel export for model types, schemas, & constants
    │   ├── constants.ts              # Enums, defaults, priorities, & collection indexes
    │   ├── activity.types.ts         # Activity TypeScript interfaces
    │   ├── activity.schema.ts        # Mongoose schema for activities collection
    │   ├── user.types.ts             # User TypeScript interfaces
    │   ├── user.schema.ts            # Mongoose schema for users collection
    │   ├── scheduling-preference.types.ts # Scheduling preference value types
    │   ├── scheduling-preference.schema.ts # Mongoose schema for scheduling_preferences
    │   ├── memory.types.ts           # Memory interface & category types
    │   ├── memory.schema.ts          # Mongoose schema for memories collection
    │   ├── conversation-state.types.ts # ConversationState TypeScript interfaces
    │   ├── conversation-state.schema.ts # Mongoose schema for conversation_states
    │   ├── message.types.ts          # Chat transcript TypeScript interfaces
    │   ├── message.schema.ts         # Mongoose schema for messages collection
    │   ├── usage.types.ts            # DeepSeek usage TypeScript interfaces
    │   ├── usage.schema.ts           # Mongoose schema for usage collection
    │   ├── history.types.ts          # History TypeScript interfaces
    │   └── history.schema.ts         # Mongoose schema for histories collection
    ├── auth/
    │   ├── google.ts                 # Google OAuth client & auth code exchanger
    │   ├── jwt.ts                    # Backend JWT sign & verify utilities (sub = userId)
    │   ├── middleware.ts             # Bearer JWT or per-user API key authentication
    │   └── http.ts                   # Auth REST (/auth/google, /api/google, /auth/api-key, /auth/me)
    ├── chat/
    │   └── service.ts                # Single long conversation transcript (append/list)
    ├── usage/
    │   ├── service.ts                # DeepSeek token usage snapshot & record
    │   └── http.ts                   # GET /api/usage
    ├── web/                          # React + Tailwind SPA (served by Express at /)
    │   ├── vite.config.ts            # Vite build config (outDir web/dist)
    │   ├── tailwind.config.js        # Tailwind content paths
    │   ├── postcss.config.js         # PostCSS + Tailwind
    │   ├── tsconfig.json             # Frontend TypeScript config
    │   ├── index.html                # SPA shell
    │   └── src/
    │       ├── main.tsx              # React mount
    │       ├── App.tsx               # Home / Chat / Usage router
    │       ├── api.ts                # Browser API client (JWT or API key)
    │       ├── index.css             # Tailwind + black page base
    │       └── pages/
    │           ├── Home.tsx          # Google OAuth, API-key login, profile, API key reveal
    │           ├── Chat.tsx          # Single conversation, one message per send
    │           └── Usage.tsx         # DeepSeek token usage
    ├── calendar/
    │   ├── contract.ts               # Tool I/O types, z parsers, update paths, REST mapping
    │   ├── service.ts                # CalendarService (create, update, delete, list, reschedule, etc.)
    │   ├── http.ts                   # REST endpoint router delegating to CalendarService
    │   ├── time.ts                   # Zoned date bounds, gap calculation, floating packing
    │   └── recurrence.ts             # Recurrence rule parser & in-memory expansion
    ├── calendar-intelligence/
    │   ├── contract.ts               # Calendar Intelligence tool I/O types & parsers
    │   └── service.ts                # CalendarIntelligenceService (preferences, capacity, missed)
    ├── karen/
    │   ├── conversation/
    │   │   ├── contract.ts           # Conversation tool input parsers
    │   │   └── service.ts            # ConversationService (setState, getContext, clearState)
    │   └── memory/
    │       ├── contract.ts           # Memory tool I/O types & parsers
    │       └── service.ts            # MemoryService (save, search, update, delete, list)
    ├── reflection/
    │   ├── contract.ts               # Reflection tool input parsers
    │   └── service.ts                # ReflectionService (daily, weekly, monthly summaries)
    ├── modules/                      # Plug-and-Play Module Barrel Wrappers
    │   ├── calendar/
    │   ├── calendar-intelligence/
    │   ├── conversation/
    │   ├── memory/
    │   └── reflection/
    ├── registry/
    │   └── modules.ts                # Central Module Registry wiring plug-and-play tools
    ├── orchestrator/                 # AI Orchestrator (Karen Core) — built
    │   ├── index.ts                  # Pipeline handle(): Intent → Context → Plan → Execute → Reply
    │   ├── types.ts                  # Shared pipeline types
    │   ├── http.ts                   # POST /chat + GET /chat/messages
    │   ├── context/
    │   ├── execution/
    │   ├── gateway/                  # Public execute(tool, payload) re-export
    │   ├── intent/
    │   ├── mcp/                      # Hosted MCP client, gateway, session recovery
    │   ├── personality/              # Karen replies (no tool names)
    │   ├── planner/
    │   └── providers/                # DeepSeek reasoner + heuristic fallback
    ├── mcp/
    │   ├── manifest.ts               # Tool manifest, envelope types, Tool interface
    │   ├── errors.ts                 # MCP error codes & handleMcpError function
    │   ├── context.ts                # UserContext generator from request JWT / stdio env
    │   ├── auth.ts                   # MCP permission checking helper
    │   ├── registry.ts               # ToolRegistry singleton
    │   ├── transport.ts              # MCP tool execution handler with error envelopes
    │   ├── sessionManager.ts         # Streamable HTTP session manager (Mcp-Session-Id map)
    │   ├── httpTransport.ts          # Express /mcp Streamable HTTP transport endpoint
    │   ├── apiKeyAuth.ts             # X-MCP-API-Key authentication middleware
    │   ├── logger.ts                 # MCP request logger
    │   ├── server.ts                 # McpServer facade, capability setup, stdio runner
    │   └── modules/                  # Tool registration modules
    │       ├── calendar.ts           # 14 Calendar tools registration
    │       ├── calendar-intelligence.ts # 7 Calendar Intelligence tools registration
    │       ├── conversation.ts       # 3 Conversation Context tools registration
    │       ├── memory.ts             # 5 Memory tools registration
    │       └── reflection.ts         # 3 Reflection tools registration
    └── tests/
        ├── helpers/
        │   ├── db.ts                 # MongoMemoryServer & index sync helper
        │   ├── seed.ts               # Deterministic seed data (user_test_001, 5 activities)
        │   ├── app.ts                # Supertest Express app helper
        │   ├── auth.ts               # Test JWT generators (valid, expired, invalid)
        │   └── mcpHttp.ts            # Test helper for MCP Streamable HTTP sessions
        ├── create.test.ts            # POST /activities tests
        ├── read.test.ts              # GET /activities tests
        ├── update.test.ts            # PATCH /activities/:id tests
        ├── delete.test.ts            # DELETE /activities/:id tests
        ├── complete.test.ts          # POST /activities/:id/complete tests
        ├── reschedule.test.ts        # POST /activities/:id/reschedule tests
        ├── conflicts.test.ts         # POST /calendar/conflicts tests
        ├── suggest-slot.test.ts      # POST /calendar/suggest-slot tests
        ├── recurrence.test.ts        # Recurrence expansion tests
        ├── reminders.test.ts         # Reminder offset validation tests
        ├── priority.test.ts          # Priority bounds validation tests
        ├── timezone.test.ts          # Timezone preservation tests
        ├── status.test.ts            # Status lifecycle tests
        ├── integrity.test.ts         # DB timestamp & field immutability tests
        ├── concurrency.test.ts       # Concurrent operations & optimistic lock tests
        ├── security.test.ts          # User isolation & payload security tests
        ├── performance.test.ts       # Performance smoke tests (1,000 items < 500ms)
        ├── mcp.test.ts               # MCP tool discovery & execution tests
        ├── mcp-auth.test.ts          # MCP HTTP X-MCP-API-Key auth tests
        ├── mcp-session.test.ts       # MCP Streamable HTTP session lifecycle tests
        ├── mcp-gateway.test.ts       # MCP Gateway client, retry, JWT, session recovery
        ├── orchestrator.test.ts      # Intent, planner, execution, personality, POST /chat
        ├── calendar-intelligence.test.ts # 20 Calendar Intelligence tool tests
        ├── collections.test.ts       # Model-level index & validation tests
        ├── reflection.test.ts        # Reflection tool summary/insight tests
        ├── memory.test.ts            # Memory CRUD & confidence tests
        ├── conversation.test.ts      # Conversation context tool tests
        ├── preferences.test.ts       # user_preferences adapter & slot learning tests
        ├── buffers.test.ts           # Meeting/travel buffer tests
        ├── undo.test.ts              # Atomic action undo tests
        ├── intelligence.test.ts      # Proactive capacity & missed rescue tests
        ├── auth.test.ts              # Google OAuth, API key login, JWT route tests
        ├── chat.test.ts              # Chat transcript persistence (history not sent to AI)
        ├── usage.test.ts             # DeepSeek usage budget & GET /usage
        └── protected.test.ts         # Middleware auth protection tests
```

---

## Detailed File-by-File Context & Purpose

### Root Directory Files
- **[`agent.md`](file:///d:/Professional-projects/PersonalAi/agent.md):** The primary Multi-Agent Coordination Protocol and Rytham operating contract pointer. Directs agents to `rules.md`, `folder structure.md`, and `plans/`.
- **[`rules.md`](file:///d:/Professional-projects/PersonalAi/rules.md):** The consolidated, must-follow repository rules. Contains all operational protocols, database contracts, decision policies, single source of truth mappings, MCP security rules, and mandatory update checklists.
- **[`folder structure.md`](file:///d:/Professional-projects/PersonalAi/folder%20structure.md):** This file. Defines directory rules, plug-and-play standards, visual tree, and complete file-by-file context for AI agents.
- **[`generic prompt.md`](file:///d:/Professional-projects/PersonalAi/generic%20prompt.md):** Reference prompt template used when invoking agents on specific tasks.
- **[`render.yaml`](file:///d:/Professional-projects/PersonalAi/render.yaml):** Render Cloud deployment blueprint configured for hosted MCP Streamable HTTP (`https://rytham-mcp.onrender.com/mcp`) and Express Web API.
- **[`.gitignore`](file:///d:/Professional-projects/PersonalAi/.gitignore):** Standard Git ignore file protecting sensitive files (`.env`, `node_modules`, `dist`, `.cursor/mcp.json`, `oauth.json`).

### `plans/` Directory (Product & Architecture Specifications)
- **[`plans/plan.md`](file:///d:/Professional-projects/PersonalAi/plans/plan.md):** AI Orchestrator V2 architecture specification (implemented as Karen Core). Multi-module MCP coordination between Calendar, Calendar Intelligence, Karen Memory, Reflection, and Conversation.
- **[`plans/plan-b.md`](file:///d:/Professional-projects/PersonalAi/plans/plan-b.md):** Detailed specification for Karen (Memory & Conversation) and Calendar Intelligence modules. Defines collection schemas, MCP tool signatures, and ownership boundaries.

### `.cursor/` Directory
- **`.cursor/mcp.json`:** Local Cursor IDE MCP client configuration pointing to hosted Streamable HTTP MCP server with `X-MCP-API-Key` headers. Gitignored.
- **`.cursor/rules/rytham-workflow.mdc`:** Cursor configuration rule with `alwaysApply: true` mandating that `agent.md` and active agent status registration are processed on every prompt.

### `activeagents/` Directory
- **`activeagents/active/`:** Directory holding active agent task tracking files (`<index>_<agent-name>-<feature>.md`). Agents create these before touching any code.
- **`activeagents/active/Rytham Architecture Principles.md`:** Reference document detailing core architectural principles for Rytham V1.
- **`activeagents/finished/`:** Archive directory holding completed agent task logs once work is finalized and verified.

### `backend/` Root Files
- **`backend/server.ts`:** Entry point for the backend. Loads environment variables, connects to MongoDB via `db.ts`, initializes Express routes (`auth`, `calendar`), initializes MCP handlers (`/mcp`), and starts the HTTP server.
- **`backend/config.ts`:** Centralized configuration loader using `dotenv`. Exports application settings: `MONGODB_URI`, `PORT`, `TIMEZONE`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `MCP_API_KEY`, `CORS_ORIGINS`, `DEEPSEEK_API_KEY`, `DEEPSEEK_URL`, `DEEPSEEK_MODEL`, `DEEPSEEK_TOKEN_BUDGET`.
- **`backend/db.ts`:** Mongoose connection manager. Connects to Atlas/local MongoDB and executes `syncIndexes()` on all models (`activities`, `users`, `scheduling_preferences`, `memories`, `conversation_states`, `messages`, `usage`).
- **`backend/web-static.ts`:** Serves the built SPA from `web/dist` at `/` with fallback to `index.html` for non-API GET routes. No-ops when the frontend has not been built.
- **`backend/errors.ts`:** Defines custom `HttpError` class with status code support (e.g. 400, 401, 403, 404, 409).
- **`backend/MCP_DEPLOYMENT.md`:** Architectural notes and deployment documentation for Render remote MCP hosting.
- **`backend/package.json`:** Defines dependencies (`express`, `mongoose`, `jsonwebtoken`, `google-auth-library`, `@modelcontextprotocol/sdk`, `zod`, `dotenv`) and npm scripts (`dev`, `build`, `start`, `test`, `typecheck`).
- **`backend/tsconfig.json`:** TypeScript compiler configuration with `strict: true` enabled. `types` includes `node` and `jest` for local typecheck and tests.
- **`backend/tsconfig.build.json`:** Production emit config used by `npm run build`. Extends `tsconfig.json`, sets `types` to `node` only, and excludes `tests`.
- **`backend/jest.config.js`:** Jest configuration setting environment to Node and TypeScript ts-jest transformer.

### `backend/model/` Directory (Database Domain Layer)
- **`backend/model/index.ts`:** Barrel exporter exposing all model types, Mongoose schemas, and constants to callers.
- **`backend/model/constants.ts`:** Single Source of Truth for closed enums (`FLEXIBILITY`, `RECURRENCE_RULE`, `ACTIVITY_STATUS`, `PREFERENCE_TYPE`, `MEMORY_CATEGORY`), defaults, priority maps, and database index definitions (`INDEXES`).
- **`backend/model/activity.types.ts`:** TypeScript interfaces for `Activity` document, schedule, behavior, recurrence, and reminders.
- **`backend/model/activity.schema.ts`:** Mongoose schema for `activities` collection. Features `strict: true`, no `versionKey`, immutable fields, and compound indexes.
- **`backend/model/user.types.ts`:** TypeScript interface for `User` document (Google OAuth user profile plus generated `apiKey`).
- **`backend/model/user.schema.ts`:** Mongoose schema for `users` collection with unique indexes on `googleId` and `apiKey`. `generateUserApiKey()` default.
- **`backend/model/scheduling-preference.types.ts`:** TypeScript interfaces for `SchedulingPreference` types, shapes (`sleep_window`, `learning_window`, `quiet_hours`, `commute`, `workload_limit`, `focus_duration`, `exam_planning`), and shape validators.
- **`backend/model/scheduling-preference.schema.ts`:** Mongoose schema for `scheduling_preferences` with unique compound index `{ userId: 1, type: 1 }`.
- **`backend/model/memory.types.ts`:** TypeScript interface for `Memory` document and 6 closed memory categories.
- **`backend/model/memory.schema.ts`:** Mongoose schema for `memories` collection with index `{ userId: 1, category: 1 }`.
- **`backend/model/conversation-state.types.ts`:** TypeScript interface for `ConversationState` document (mission, context, entities map).
- **`backend/model/conversation-state.schema.ts`:** Mongoose schema for `conversation_states` collection with unique index `{ userId: 1 }` and `updatedAt` timestamp only.
- **`backend/model/message.types.ts` & `message.schema.ts`:** Chat transcript (`messages` collection). One long conversation per user. History is stored here and never sent to DeepSeek.
- **`backend/model/usage.types.ts` & `usage.schema.ts`:** Per-user DeepSeek token usage (`usage` collection). One document per user.
- **`backend/model/history.types.ts` & `history.schema.ts`:** Interfaces and Mongoose schema for activity modification audit log.

### `backend/auth/` Directory (Authentication Layer)
- **`backend/auth/google.ts`:** Google OAuth 2.0 client setup, URL generator, and code exchange for user profile.
- **`backend/auth/jwt.ts`:** Backend JWT generator (`signToken`) and verification (`verifyToken`). Embeds `{ sub: userId, email, name }`.
- **`backend/auth/middleware.ts`:** Express authentication middleware. Accepts `Authorization: Bearer <JWT>` or `Authorization: Bearer <user apiKey>`.
- **`backend/auth/http.ts`:** Authentication REST router: `/auth/google`, `/api/google`, `/auth/google/callback` (JSON), `/api/google/callback` (redirect `/?token=`), `/auth/api-key`, `/auth/logout`, `/auth/me`.

### `backend/chat/` Directory
- **`backend/chat/service.ts`:** Appends one user message and one assistant reply per turn. Lists the user's single conversation in chronological order.

### `backend/usage/` Directory
- **`backend/usage/service.ts`:** Token usage snapshot and increment. Remaining tokens = `DEEPSEEK_TOKEN_BUDGET - totalTokens`.
- **`backend/usage/http.ts`:** `GET /api/usage` for the signed-in user.

### `backend/web/` Directory (Client SPA)
- Black, functional React + Tailwind UI served by Express after `npm run build`.
- **Home:** Google sign-in, API-key login, profile, API key hidden by default.
- **Chat:** One message in, one action/reply. Transcript loaded from DB.
- **Usage:** DeepSeek request and token counts.

### `backend/calendar/` Directory (Calendar Domain Core)
- **`backend/calendar/contract.ts`:** Tool input/output TypeScript definitions, Zod validation parsers, allowed update path whitelist (`ALLOWED_UPDATE_PATHS`), and REST-to-Tool mappings for 8 core calendar tools.
- **`backend/calendar/service.ts`:** `CalendarService` class containing core business logic for calendar activities (`create`, `update`, `delete`, `list`, `complete`, `reschedule`, `conflicts`, `suggestSlot`). Accepts `userId` in constructor.
- **`backend/calendar/http.ts`:** REST transport layer translating Express HTTP requests into `CalendarService` method calls. Mounts `POST /chat`, `GET /chat/messages`, `GET /api/usage`, and the SPA.
- **`backend/calendar/time.ts`:** Zoned date arithmetic, day/week/month ISO window calculation, gap detection, and floating task gap reservation packing.
- **`backend/calendar/recurrence.ts`:** In-memory recurrence rule parser expanding daily, weekly, monthly, and yearly recurring series within query windows without persisting extra document instances.

### `backend/calendar-intelligence/` Directory
- **`backend/calendar-intelligence/contract.ts`:** Input/output types and parsers for 7 Calendar Intelligence tools (`calendar.preferences.*`, `calendar.capacity.check`, `calendar.missed.review`, `calendar.preview`).
- **`backend/calendar-intelligence/service.ts`:** `CalendarIntelligenceService` implementing preferences management, proactive capacity checking against workload limits, missed task recovery recommendations, and day previews.

### `backend/karen/` Directory (Karen Personal Assistant Domain)
- **`backend/karen/conversation/contract.ts` & `service.ts`:** Tool parsers and `ConversationService` for maintaining user conversation mission, context state, and entity references (`"it"`, `"that meeting"`).
- **`backend/karen/memory/contract.ts` & `service.ts`:** Tool parsers and `MemoryService` for managing Karen long-term memories with confidence scoring (0-1) and temporary preference expiration.

### `backend/reflection/` Directory
- **`backend/reflection/contract.ts` & `service.ts`:** Tool parsers and `ReflectionService` generating on-demand daily summaries, weekly trend insights, and monthly completion analytics directly from activity history.

### `backend/modules/` Directory (Plug-and-Play Module Barrels)
- Standardized plug-and-play module wrappers (`calendar`, `calendar-intelligence`, `conversation`, `memory`, `reflection`) exporting modular tool definitions for clean integration.

### `backend/registry/` Directory
- **`backend/registry/modules.ts`:** Central module registry (`calendar`, `calendar-intelligence`, `memory`, `reflection`, `conversation`). `listRegisteredTools()` is the planner catalog. Adding a module means its folder plus this file.

### `backend/orchestrator/` Directory (AI Orchestrator / Karen Core — built)
- **`backend/orchestrator/index.ts`:** `handle(request)` runs User → Intent → Context → Planner → Execute → Response. All tools go through `McpGateway.execute(tool, payload)`.
- **`backend/orchestrator/types.ts`:** Pipeline types (`IntentResult`, `ExecutionPlan`, `OrchestratorRequest`).
- **`backend/orchestrator/http.ts`:** `POST /chat` with Bearer JWT or user API key. Body `{ message }` only (no history). Persists the turn in `messages`. `GET /chat/messages` returns the stored transcript. Response `{ reply, clarification, executed }`.
- **`backend/orchestrator/intent/`:** Intent classification and entity extraction. Never executes tools.
- **`backend/orchestrator/context/`:** Resolves `it` / `that meeting` via `conversation.context`.
- **`backend/orchestrator/planner/`:** Builds a registered-tool chain. Routes scheduling config to `calendar.preferences.*` and personal knowledge to `memory.*`.
- **`backend/orchestrator/execution/`:** Sequential gateway execution, bind from prior results, stop on unrecoverable error. Gateway retries once on temporary failures.
- **`backend/orchestrator/personality/`:** Karen replies: warm, polite, calm. Never exposes tool names. Never fabricates success.
- **`backend/orchestrator/gateway/`:** Public `execute(tool, payload)` / `McpGateway` re-export.
- **`backend/orchestrator/mcp/`:** Hosted MCP client (`https://rytham-mcp.onrender.com/mcp` by default). Attaches `X-MCP-API-Key` and `Authorization: Bearer <JWT>`. Recovers Streamable HTTP sessions.
- **`backend/orchestrator/providers/`:** DeepSeek reasoning (optional `DEEPSEEK_API_KEY`) with heuristic fallback. DeepSeek never calls MCP. Each completion sends only the current system+user pair (`max_tokens` 256). Skipped when the user's token budget is exhausted.

### `backend/mcp/` Directory (Model Context Protocol Layer)
- **`backend/mcp/manifest.ts`:** MCP tool manifest definitions, input schemas, response envelope shapes (`{ success, data }` or `{ success: false, error }`).
- **`backend/mcp/errors.ts`:** Standard MCP error codes (`VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `CALENDAR_CONFLICT`, `NO_AVAILABLE_SLOT`, `INTERNAL_ERROR`) and `handleMcpError`.
- **`backend/mcp/context.ts`:** `UserContext` resolver extracting `userId` from request Bearer JWT or stdio environment variable `RYTHAM_JWT`.
- **`backend/mcp/auth.ts`:** Permission verification helper validating user scopes before tool execution.
- **`backend/mcp/registry.ts`:** `ToolRegistry` singleton managing tool registration and lookup.
- **`backend/mcp/transport.ts`:** MCP execution handler wrapping tool invocations in standardized error envelopes and setting `isError: true` on SDK failures.
- **`backend/mcp/sessionManager.ts`:** Streamable HTTP session manager mapping `Mcp-Session-Id` headers to isolated transports and SDK servers.
- **`backend/mcp/httpTransport.ts`:** Express `/mcp` Streamable HTTP endpoint handler supporting session initialization, message passing, and session teardown.
- **`backend/mcp/apiKeyAuth.ts`:** Middleware validating `X-MCP-API-Key` headers on remote Streamable HTTP requests.
- **`backend/mcp/logger.ts`:** Safe logging utility for tracking MCP execution without exposing secret tokens.
- **`backend/mcp/server.ts`:** `McpServer` facade exposing tools/resources/prompts capabilities, stdio runner, and HTTP wiring.
- **`backend/mcp/modules/`:** Individual tool registration modules (`calendar.ts`, `calendar-intelligence.ts`, `conversation.ts`, `memory.ts`, `reflection.ts`) registering 32 total MCP tools.

### `backend/tests/` Directory (Test Suite Matrix)
- **`backend/tests/helpers/`:** Test environment support code.
  - `db.ts` — Starts `MongoMemoryServer` and executes `syncIndexes()`.
  - `seed.ts` — Provides deterministic test dataset (`user_test_001` and 5 standard seeded activities).
  - `app.ts` — Creates Supertest Express test app instance.
  - `auth.ts` — Generates valid, expired, and invalid test JWT tokens.
  - `mcpHttp.ts` — Supertest helper for testing Streamable HTTP MCP sessions.
- **35 Test Suites (`*.test.ts`):** Complete automated regression coverage across authentication (Google OAuth, per-user API key, JWT), authorization, activity CRUD operations, recurrence expansion, reminder parsing, timezone accuracy, optimistic concurrency locking, multi-tenant security isolation, performance benchmarks (1,000 items under 500ms), calendar intelligence preferences, Karen memory CRUD, conversation state tracking, chat transcript persistence, DeepSeek usage budget, reflection insights, MCP HTTP/stdio session transport, MCP Gateway, and the AI Orchestrator pipeline (`POST /chat`). 273 tests.

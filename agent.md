# AGENT.md – Multi-Agent Coordination Protocol (Mandatory)

This repository supports multiple AI agents working in parallel. Every agent must announce its work, continuously update progress, communicate with other agents through their task files, and archive completed work.

This protocol is mandatory for every prompt and every agent. The Rytham product contract below this protocol remains mandatory. Follow both.

Cursor rule `.cursor/rules/rytham-workflow.mdc` (`alwaysApply: true`) requires this file on every prompt.

---

# Multi-Agent Completion Contract

**Status:** Active development rule.

## Objective

Every approved decision becomes part of the project specification immediately. Agents must update documentation and implementation artifacts until their assigned task is complete. Do not leave accepted decisions as unfinished placeholders.

## Core Rules

1. **Approved = Updated.** Once the user approves a decision, immediately integrate it into the relevant documents.
2. **Complete the assigned scope.** Finish the entire requested change, including related sections, examples, and cross-references.
3. **No placeholder summaries.** Do not respond with "planning only", "not implemented", or "not specified" for work that belongs to the assigned scope.
4. **Resolve internal details.** If a small implementation detail is missing, infer a consistent solution from existing architecture instead of stopping.
5. **Escalate only for true product decisions.** Ask questions only when multiple product directions would change behavior.

## Parallel Agent Rules

- No file ownership or locking.
- Every agent reads every file in `activeagents/active/` before starting.
- Agents continue working even if another agent touches the same file.
- Overlapping edits are reconciled after completion, not used as a reason to stop.

## Active Agent Registry

Each agent creates and continuously updates (indexed sequentially by creation date: `1_*`, `2_*`, etc.):

`activeagents/active/<index>_<agent-name>-<feature>.md`

It must contain:

- Agent name
- Assigned objective
- Current progress
- Files touched
- Completed changes

## Completion Standard

A task is complete only when all of the following are finished:

- Primary requested change applied.
- Related documentation updated.
- Examples updated.
- Cross-references updated.
- Conflicting wording removed.
- Final change log appended.

Then move the status file to `activeagents/finished/`.

## Documentation Update Rule

When a decision changes behavior, agents must update every affected document in the same task.

Example: user approves that exam revision belongs to `calendar.preferences.*`. The assigned agent must update ownership tables, automatic-learning examples, orchestrator examples, tool-selection examples, remove contradictory wording, and record the completed change.

Do not leave approved behavior undefined. If the decision fits existing architecture, define sequences, examples, and contracts consistently in the same update.

## Escalation Rule

Only stop and ask the user when:

- Multiple valid product behaviors exist.
- Security or privacy behavior changes.
- Public API compatibility would change.
- The user explicitly requests a design decision.

Everything else should be completed within the assigned task.

## Success Principle

Agents coordinate through awareness, complete their assigned scope end-to-end, and leave the project in a fully updated state instead of handing back partially integrated decisions.

---

## Directory Structure

```
activeagents/
├── active/
│   ├── backend-auth.md
│   ├── ui-dashboard.md
│   └── parser-phase2.md
└── finished/
    ├── backend-auth.md
    └── parser-phase2.md
```

- `active/` → Running tasks.
- `finished/` → Completed task logs.
- Every agent owns exactly one file while active.
- Filename: `<index>_<agent-name>-<feature>.md` (sequentially indexed based on creation date: `1_*`, `2_*`, etc., lowercase, hyphenated, no spaces).
- Do not invent other coordination folders. `activeagents/` is the only parallel-work log.

This file (`agent.md`) is shared. Multiple agents may edit it; reconcile after completion per the Completion Contract above.

---

## Rule 1 – Register Before Working

Before editing any project file, create:

```
activeagents/active/<index>_<agent-name>-<feature>.md
```

Example:

```
activeagents/active/1_backend-auth.md
```

Template:

```markdown
# Agent: backend-auth
Status: ACTIVE
Started: YYYY-MM-DD HH:MM UTC

## Objective
Implement API key authentication.

## Planned Files
- server/auth.js
- server/index.js
- middleware/apiKey.js

## Files Touched
(None)

## Current Progress
- Created task.
- Beginning implementation.

## Incoming Messages
(None)

## Outgoing Messages
(None)
```

No code changes may begin before this file exists.

---

## Rule 2 – Track Files Touched

Before and while modifying project files, list them under **Files Touched** in your task file. There is no file locking. Other agents may edit the same files; reconcile overlaps after completion.

---

## Rule 3 – Continuous Progress Updates

After every meaningful milestone, update the task file.

Examples:

- Created middleware
- Added validation
- Fixed bug
- Updated tests
- Waiting for another agent

The task file is the live progress log. It is the source of truth for this agent. Never share one task file across two agents.

---

## Rule 4 – Agent-to-Agent Communication

Agents communicate only by appending messages to another agent's task file.

Format:

```markdown
## Incoming Messages

### From: ui-dashboard
Time: YYYY-MM-DD HH:MM UTC
Request: Need authentication endpoint response format.
```

The receiving agent must:

1. Read new incoming messages.
2. Acknowledge them.
3. Respond inside its own task file.

Response format:

```markdown
## Outgoing Messages

### To: ui-dashboard
Time: YYYY-MM-DD HH:MM UTC
Response: Authentication returns: { success: true, token: "...", expiresIn: 3600 }
```

Agents must check messages before every major work cycle.

---

## Rule 5 – Respect Parallel Work

Every agent must assume:

- multiple agents are running simultaneously,
- active task files represent live work,
- duplicate implementation should be avoided,
- overlapping edits are reconciled after completion.

Before beginning work:

1. Read all files inside `activeagents/active/`.
2. Identify overlapping work.
3. Coordinate using messages when two agents would implement the same feature.
4. Continue assigned work even if another agent touches the same file.

Two agents must never write the same task file at the same time except to append an Incoming Message. Do not rewrite another agent's progress or outgoing messages.

---

## Rule 6 – Completion Procedure

When work finishes:

1. Update status.
2. Add final summary.
3. List every modified file.
4. Move the task file to `activeagents/finished/`.

Final template:

```markdown
Status: COMPLETED
Completed: YYYY-MM-DD HH:MM UTC

## Summary
Implemented API key authentication.

## Files Modified
- server/index.js
- server/auth.js
- middleware/apiKey.js

## Changes Made
- Added API key middleware.
- Protected API routes.
- Added configuration.
- Updated documentation.

## Messages Resolved
- Responded to ui-dashboard.
```

Then move:

```
activeagents/active/1_backend-auth.md
```

to:

```
activeagents/finished/1_backend-auth.md
```

If `activeagents/finished/<same-name>.md` already exists, append a timestamp: `<index>_<name>-YYYYMMDD-HHMM.md`.

---

## Rule 8 – Recovery

If an agent starts and finds its task file already exists:

- resume that task,
- continue updating the same file,
- never create duplicates.

If an abandoned task exists:

- append a recovery note,
- continue from the existing history.

---

## Mandatory Startup Checklist

Before doing any work, every agent must:

- [ ] Read `agent.md` (Completion Contract, protocol, Rytham contract).
- [ ] Read every file in `activeagents/active/`.
- [ ] Create or resume its own task file.
- [ ] Check incoming messages.
- [ ] Keep **Files Touched**, **Current progress**, and **Completed changes** updated.
- [ ] Respond to agent messages.
- [ ] Complete the assigned scope end-to-end per the Completion Contract.
- [ ] Archive the task file to `activeagents/finished/` upon completion.

Failure to follow this protocol is a violation of repository workflow.

---

# Rytham V1 — Agent Workflow

This file is the project operating contract. Read it at the start of every prompt. Update it at the end of every change. Do not work from memory.

Cursor rule `.cursor/rules/rytham-workflow.mdc` (`alwaysApply: true`) requires this file on every prompt.

---

## 1. Mandatory loop

1. Read this file before any work (protocol at the top, then this contract).
2. Read every file in `activeagents/active/`. Create or resume `activeagents/active/<index>_<agent-name>-<feature>.md`. Check incoming messages. No project edits before that file exists.
3. Read `backend/model/` if the task touches data.
4. Read `backend/auth/` if the task touches identity or JWT.
5. Read `backend/calendar/` if the task touches calendar tools or HTTP.
6. Read `backend/mcp/` if the task touches MCP.
7. Do only what the user asked and what this file already allows.
8. Keep types, schema, constants, tool contract, and this file identical.
9. After the change, update **Current state**, **File map**, and any contract that changed. Archive the task file to `activeagents/finished/`.
10. Stop. Do not add follow-on work.

If a step is missing from this file and from the user message, apply the Completion Contract Escalation Rule. Infer consistent details from existing architecture when the assigned scope requires it.

---

## 2. Decision policy

Follow the Multi-Agent Completion Contract at the top of this file. Approved decisions become specification immediately.

| Situation | Action |
| --- | --- |
| Specified here, in `plan.md`, `plan b.md`, or the user message | Follow it and update all affected docs in the same task |
| Small implementation detail missing within assigned scope | Infer a consistent solution from existing architecture; document it |
| Multiple valid product behaviors | Stop and ask (Escalation Rule) |
| Security, privacy, or public API compatibility change | Stop and ask (Escalation Rule) |
| Not in V1 scope | Do not build it |
| “Helpful extra” outside assigned scope | Do not add it |
| Naming / folder / type already listed | Reuse it |
| Spec and this file disagree on product behavior | Stop and ask |

AI (product) never thinks in HTTP. Path is **Intent → Tool → Backend**. REST is transport only. MCP is implemented; it must call the same `CalendarService` methods. Do not duplicate calendar logic.

---

## 3. Project identity

| Item | Value |
| --- | --- |
| Product | Rytham |
| Version | V1.0 |
| Module | Calendar / activities + Auth + MCP |
| Role | AI-first personal assistant |
| Persistence | MongoDB via Mongoose |
| HTTP | Express |
| Auth | Google OAuth → backend JWT (`jsonwebtoken`) |
| Env loader | dotenv |
| Language | TypeScript |
| Package | `backend/` (`rytham-backend`) |
| Database name | `rytham` |
| Default timezone | `Asia/Kolkata` (`TIMEZONE` env) |
| API port | `3000` (`PORT` env) |

V1 stores one document per logical activity. Habits, routines, reminders, medicines, meetings, and tasks are all `activities`.

**Freeze:** the activities schema is stable. The existing 8 `calendar.*` tools' public I/O cannot change without a version bump. Future modules (Notes, Finance, GitHub, Email) must integrate without modifying those tools' public contract unless absolutely necessary. Planned Calendar Intelligence and Karen MCP tools are specified in `plan b.md` and are not built.

Identity is Google OAuth. The backend finds or creates a `users` document and issues its own JWT. Every API uses `Authorization: Bearer <JWT>`. `userId` is JWT `sub` (`req.user.id`). Clients must not send `userId`. AI and MCP use this JWT, never Google's access token. Do not store passwords. Do not store Google tokens on `User`.

---

## 4. Current state

**Status:** Schema + MongoDB + Google OAuth/JWT auth + calendar tool API over REST + MCP capability layer. Auth is locked. Activities schema is frozen. Milestone tag: `v1-backend-platform`. Multi-agent coordination protocol is in this file (top) and is mandatory.

**Implemented**

- Multi-agent protocol: Completion Contract; one task file per agent in `activeagents/active/`; no file locks; agent-to-agent messages; archive to `activeagents/finished/` on completion
- Collection `users` (Google identity; no passwords; no Google tokens; no nested preferences)
- Collection `activities`
- Collection `scheduling_preferences` (canonical scheduling config; unique `{ userId, type }`; 7 closed types)
- Collection `memories` (Karen personal knowledge; 6 categories; confidence 0–1; `expiresAt` required for `temporary_preference`)
- Collection `conversation_states` (one document per user; `updatedAt` only)
- Closed enums and defaults in `backend/model/constants.ts` (including `PREFERENCE_TYPE`, `MEMORY_CATEGORY`, collection indexes)
- TypeScript contracts in `backend/model/*.types.ts`
- Mongoose schemas in `backend/model/*.schema.ts`
- Public barrel `backend/model/index.ts`
- MongoDB connection `backend/db.ts` (`MONGODB_URI` in `backend/.env`; `syncIndexes` for activities, users, scheduling_preferences, memories, conversation_states)
- Google OAuth + JWT in `backend/auth/`
- Tool I/O in `backend/calendar/contract.ts` (`userId` never in tool input)
- `CalendarService` in `backend/calendar/service.ts` (one method per tool; `userId` from constructor; `reschedule` uses `updatedAt` optimistic lock, always writes `schedule.endAt` including null, and a Mongo transaction when the topology supports it; `suggest_slot` reserves unscheduled floating tasks into gaps; `create` capacity, `suggest_slot` quiet hours / learning window, and `split_task` focus duration read `scheduling_preferences`; `calendar.user_preferences` is a compatibility adapter onto that collection)
- Recurrence expansion in `backend/calendar/recurrence.ts` (in-memory inside query windows; no extra documents)
- REST transport in `backend/calendar/http.ts` (Bearer JWT required; `userId` from `req.user.id`; production CORS allowlist)
- MCP capability layer in `backend/mcp/` (`userId` from JWT `sub`; HTTP Streamable `/mcp` reads `Authorization: Bearer <JWT>` per request; `MCP_USER_ID` is not used at runtime; stdio loads `backend/.env` from `mcp/server.ts` so `RYTHAM_JWT` is present even if Cursor cwd differs; missing JWT is `UNAUTHORIZED`; SDK capabilities are tools + resources + prompts; `CallTool` sets `isError: true` when the tool envelope is a failure)
- Streamable HTTP sessions: `mcp/sessionManager.ts` maps `Mcp-Session-Id` to one transport + SDK server; `/mcp` reuses that transport; DELETE/`onclose` drops the session and closes the server
- Process entry `backend/server.ts`
- Hosted MCP on Render (`https://rytham-mcp.onrender.com`); Cursor `.cursor/mcp.json` uses Streamable HTTP `url` `https://rytham-mcp.onrender.com/mcp` and header `X-MCP-API-Key` (value lives only in that file, never here; file is gitignored via root `.gitignore`)
- End-to-End API, Auth, and MCP test suite with Jest + Supertest + MongoDB in `backend/tests/` (indexes synced before queries)
- Conversation MCP in `backend/karen/conversation/` (3 tools: `conversation.state`, `conversation.context`, `conversation.clear`; stores mission, context, entity references like "it" or "that meeting"; registered in `mcp/server.ts`)
- Reflection MCP in `backend/reflection/` (3 tools: `reflection.daily`, `reflection.weekly`, `reflection.monthly`; generates summaries and insights on-demand from activities; no persistence collection; registered in `mcp/server.ts`)
- Memory MCP in `backend/karen/memory/` (5 tools: `memory.save`, `memory.search`, `memory.update`, `memory.delete`, `memory.list`; 6 closed categories: preference, habit, goal, relationship, health, temporary_preference; confidence scoring 0-1; registered in `mcp/server.ts`)

**Not implemented (do not start unless the user asks)**

- Notifications
- UI
- Product planner / AI Orchestrator (specified in `plan.md` V2; designed to coordinate Calendar, Calendar Intelligence, Karen Memory, Reflection, and Conversation MCP modules; not coded)
- `POST /auth/refresh` (optional later)
- Notes, Finance, GitHub, Email tools

**Calendar Intelligence Module (built):** 7 new MCP tools for scheduling preferences and proactive capacity management (`calendar.preferences.*`, `calendar.capacity.*`, `calendar.missed.*`, `calendar.preview`). Collection `scheduling_preferences` is the only store for scheduling configuration. `User.preferences` is removed. `calendar.user_preferences` writes/reads the four adapter types (`quiet_hours`, `learning_window`, `focus_duration`, `workload_limit`) and does not delete `sleep_window` / `commute` / `exam_planning`. Tests: 20 tests in `calendar-intelligence.test.ts` plus model tests in `collections.test.ts`. Zero changes to existing 8 frozen `calendar.*` tool contracts. Note: `calendar.split_task` already exists in calendar module (not duplicated).

**Next allowed work:** AI Orchestrator is fully specified in `plan.md` V2 (code not built). Other next work: none until specified.

---

## 5. File map

```
PersonalAi/
  agent.md                          ← protocol (top) + this workflow (update every change)
  plan.md                           ← AI Orchestrator spec V2 (code not built; multi-module MCP coordination)
  plan b.md                         ← Karen Module + Calendar Intelligence spec (collections built; Orchestrator not coded; I/O in section 18)
  .gitignore                        ← `.cursor/mcp.json`, root `.env`
  render.yaml                       ← Render web service blueprint
  .cursor/rules/rytham-workflow.mdc ← always-apply: read this file first; register in activeagents/
  .cursor/mcp.json                  ← Cursor MCP: hosted Streamable HTTP `/mcp`; gitignored; do not copy secrets into this file
  activeagents/
    active/
      .gitkeep                      ← live agent task files go here
    finished/
      .gitkeep
      1_workflow-multi-agent.md       ← protocol install log
      2_orchestrator-spec-v2.md
      3_composer-completion-contract.md
      4_calendar-intelligence-module.md
      5_rytham-karen-memory.md
      6_rytham-reflection-module.md
      7_rytham-conversation-context.md
      8_composer-module5-collections.md
  backend/
    package.json
    package-lock.json
    tsconfig.json
    jest.config.js                  ← Jest test framework config
    .gitignore                      ← node_modules, dist, .env, oauth.json
    .env                            ← secrets; never commit; never copy into this file
    .env.example                    ← keys only, no secrets
    oauth.json                      ← local Google client download; gitignored; not loaded at runtime
    server.ts                       ← load config, connect DB, listen
    config.ts                       ← MONGODB_URI, PORT, TIMEZONE, Google OAuth, JWT, CORS_ORIGINS
    db.ts                           ← mongoose.connect + syncIndexes (activities + users + scheduling_preferences + memories + conversation_states)
    errors.ts                       ← HttpError
    model/
      index.ts
      constants.ts
      activity.types.ts
      activity.schema.ts
      user.types.ts
      user.schema.ts
      history.types.ts
      history.schema.ts
      scheduling-preference.types.ts ← PreferenceType from constants; value shapes; isValidPreferenceValue
      scheduling-preference.schema.ts ← SchedulingPreferenceModel; unique { userId: 1, type: 1 }
      memory.types.ts               ← Memory interface
      memory.schema.ts              ← MemoryModel; { userId: 1, category: 1 }
      conversation-state.types.ts   ← ConversationState interface
      conversation-state.schema.ts  ← ConversationStateModel; unique { userId: 1 }; updatedAt only
    auth/
      google.ts                     ← Google authorization URL + code exchange
      jwt.ts                        ← JWT sign & verify (payload: sub, email, name)
      middleware.ts                 ← Bearer auth → req.user
      http.ts                       ← /auth/google, /auth/google/callback, /auth/logout, /auth/me
    calendar/
      contract.ts                   ← tool names, I/O types, parsers
      service.ts                    ← CalendarService
      http.ts                       ← REST → service; production CORS
      time.ts                       ← day/week/month bounds, overlap, gaps, floating gap reserve, zoned ymd
      recurrence.ts                 ← expand daily/weekly/monthly/yearly inside a window
    calendar-intelligence/
      contract.ts                   ← 7 Calendar Intelligence tool I/O types, parsers
      service.ts                    ← CalendarIntelligenceService (7 methods: save/get/update/delete preferences, check capacity, review missed, preview)
    karen/
      conversation/
        contract.ts                 ← conversation tool input parsers (state, context, clear)
        service.ts                  ← ConversationService (setState, getContext, clearState)
      memory/
        contract.ts                 ← memory tool I/O types and parsers (save, search, update, delete, list)
        service.ts                  ← MemoryService (save with default confidence 0.9, search with limit 5, update, delete, list)
    reflection/
      contract.ts                   ← reflection tool input parsers (daily, weekly, monthly)
      service.ts                    ← ReflectionService (daily, weekly, monthly summaries and insights)
    MCP_DEPLOYMENT.md               ← Render / remote Streamable HTTP notes
    mcp/
      manifest.ts                   ← ToolManifest, Tool, UserContext & response envelopes
      errors.ts                     ← ERROR_CODES & McpError handling
      context.ts                    ← UserContext from request JWT `sub` (HTTP) or `RYTHAM_JWT` (stdio) or explicit userId (tests); DEFAULT_V1_PERMISSIONS includes calendar:preferences:*
      auth.ts                       ← Permission check helper
      registry.ts                   ← ToolRegistry singleton & tool discovery
      transport.ts                  ← MCP tool execution handler
      sessionManager.ts             ← Streamable HTTP session map (id → transport + SDK server)
      httpTransport.ts              ← Express `/mcp` Streamable HTTP; session reuse
      apiKeyAuth.ts                 ← `X-MCP-API-Key` middleware
      logger.ts                     ← MCP request logging (no secrets)
      server.ts                     ← McpServer facade, MCP_CAPABILITIES, wireMcpSdkHandlers, StdioServerTransport runner; registers calendar + calendar-intelligence
      modules/
        calendar.ts                 ← 14 Calendar tools registration
        calendar-intelligence.ts    ← 7 Calendar Intelligence tools registration
        conversation.ts             ← 3 Conversation tools (state, context, clear)
        reflection.ts               ← 3 Reflection tools (daily, weekly, monthly)
        memory.ts                   ← 5 Memory tools (save, search, update, delete, list)
    tests/
      helpers/
        db.ts                       ← MongoMemoryServer & DB cleanup helper; syncIndexes (activities + users + scheduling_preferences + memories + conversation_states)
        seed.ts                     ← Test Google profile, test user, user_test_001 + 5 activities
        app.ts                      ← Supertest express app helper
        auth.ts                     ← Valid / expired / invalid JWT helpers
        mcpHttp.ts                  ← MCP HTTP test app, API key + Bearer JWT headers, session helpers
      create.test.ts                ← POST /activities tests
      read.test.ts                  ← GET /activities tests
      update.test.ts                ← PATCH /activities/:id tests
      delete.test.ts                ← DELETE /activities/:id tests
      complete.test.ts              ← POST /activities/:id/complete tests
      reschedule.test.ts            ← POST /activities/:id/reschedule tests
      conflicts.test.ts             ← POST /calendar/conflicts tests
      suggest-slot.test.ts          ← POST /calendar/suggest-slot tests
      recurrence.test.ts            ← Recurrence rules tests
      reminders.test.ts             ← Reminder offsets tests
      priority.test.ts              ← Priority range validation tests
      timezone.test.ts              ← Timezone preservation tests
      status.test.ts                ← Status lifecycle tests
      integrity.test.ts             ← DB timestamp & field immutability tests
      concurrency.test.ts           ← Concurrent operations tests
      security.test.ts              ← Payload security & user isolation tests
      performance.test.ts           ← Performance smoke tests (1,000 items)
      mcp.test.ts                   ← MCP tool discovery, execution with JWT userId, permissions
      mcp-auth.test.ts              ← MCP HTTP API key auth
      mcp-session.test.ts           ← MCP Streamable HTTP session id, reuse, DELETE cleanup
      calendar-intelligence.test.ts ← Calendar Intelligence tools (20 tests: CRUD preferences, capacity check, missed review, preview, user isolation, unique constraint)
      collections.test.ts           ← Model-level scheduling_preferences, memories, conversation_states
      reflection.test.ts            ← Reflection tool tests (daily/weekly/monthly summaries)
      memory.test.ts                ← Memory tool tests (save/search/update/delete/list, confidence validation, user isolation)
      conversation.test.ts          ← Conversation Context tool tests (state, context, clear, partial update, permissions)
      preferences.test.ts           ← calendar.user_preferences adapter onto scheduling_preferences; learning-window suggest_slot
      buffers.test.ts
      undo.test.ts
      intelligence.test.ts
      auth.test.ts                  ← Authentication routes tests
      protected.test.ts             ← Auth middleware protection tests
```

Do not add `activity_instances` or `notifications` schemas unless the user asks.

---

## 6. Ownership (one source each)

| Concern | Owner | Mirrors |
| --- | --- | --- |
| Enum strings / numbers | `constants.ts` | schema `enum`, this file section 8 |
| Defaults | `constants.ts` | schema `default`, this file section 8 |
| Indexes | `INDEXES`, `INDEXES_SCHEDULING_PREFERENCES`, `INDEXES_MEMORIES`, `INDEXES_CONVERSATION_STATES` in `constants.ts` | schema index loops, this file section 9 |
| Field names and nullability | `activity.types.ts` `Activity` | Mongoose paths, this file section 7 |
| User fields | `user.types.ts` `User` | `user.schema.ts`, this file section 7b |
| Scheduling preference fields | `scheduling-preference.types.ts` `SchedulingPreference` | `scheduling-preference.schema.ts`, this file section 7c |
| Memory fields | `memory.types.ts` `Memory` | `memory.schema.ts`, this file section 7d |
| Conversation state fields | `conversation-state.types.ts` `ConversationState` | `conversation-state.schema.ts`, this file section 7e |
| Persistence | `activity.schema.ts`, `user.schema.ts`, `scheduling-preference.schema.ts`, `memory.schema.ts`, `conversation-state.schema.ts` | types + constants |
| Public model imports | `model/index.ts` | callers import from here |
| Auth REST | `auth/http.ts` | this file section 15 |
| JWT | `auth/jwt.ts` | payload `sub`, `email`, `name` |
| MCP execution | `mcp/transport.ts` | `mcp/server.ts`, `mcp/modules/calendar.ts` |
| MCP HTTP sessions | `mcp/sessionManager.ts` | `mcp/httpTransport.ts` |
| MCP identity | `mcp/context.ts` | HTTP: request `Authorization: Bearer` JWT `sub`; stdio: `RYTHAM_JWT`; tests may pass `userId` |
| MCP permissions | `mcp/auth.ts` | `mcp/modules/calendar.ts` tool `permissions` |
| Tool names + I/O | `calendar/contract.ts` | this file section 15–16 |
| Recurrence expansion | `calendar/recurrence.ts` | `calendar/service.ts` list/conflicts/suggestSlot, this file section 9 |
| Tool behavior | `calendar/service.ts` | this file section 16 |
| REST paths | `REST_TO_TOOL` in `contract.ts` | `calendar/http.ts`, this file section 15 |
| CORS | `calendar/http.ts` | `config.ts` `corsOrigins`, this file section 17 |
| Env keys | `config.ts` | `.env.example`, this file section 17 |

If one owner changes, update every mirror in the same turn, including this file.

---

## 7. Activity contract (closed)

Collection name: `activities`.

```
Activity {
  _id: ObjectId
  userId: ObjectId
  title: string
  note: string                    // default ""
  category: string                // default ""; free-form
  schedule: {
    startAt: Date | null          // default null
    endAt: Date | null            // default null
    durationMin: number | null    // default null; min 0
    timezone: string              // required; IANA, e.g. Asia/Kolkata
  }
  behavior: {
    flexibility: "fixed" | "moveable" | "floating"
    recurrence: {
      rule: "none" | "daily" | "weekly" | "monthly" | "yearly"
      interval: number            // default 1; min 1
      days: number[]              // ISO weekdays 1=Mon … 7=Sun; default []
      until: Date | null          // default null
    }
  }
  priority: 1 | 2 | 3 | 4 | 5
  reminders: { beforeMin: number }[]   // default []; beforeMin >= 0
  status: "pending" | "done" | "missed" | "cancelled"
  tags: string[]                  // default []
  metadata: object                // default {}; never used by core scheduling
  createdBy: "ai" | "user" | "system"
  createdAt: Date                 // mongoose timestamps
  updatedAt: Date                 // mongoose timestamps
}
```

Rules:

- Field set is closed. Do not add fields.
- `strict: true`. Extra keys are rejected.
- No `versionKey`. Optimistic lock for `reschedule` uses existing `updatedAt`.
- `minimize: false` so empty `metadata` stays on the document.
- `category` and `tags` stay free-form strings. Do not turn them into enums.
- `metadata` is reserved for later modules. Do not read it in scheduling logic.
- V1 does not store expanded recurring occurrences.
- `note` and `category` are `required: false` in Mongoose because empty string fails Mongoose `required`. They still default to `""` and are always stored on create via the service.

Insert must supply: `userId`, `title`, `schedule.timezone`, `behavior.flexibility`, `priority`, `createdBy`.

Insert may omit (schema/service fills): `note`, `category`, `reminders`, `status`, `tags`, `metadata`, `behavior.recurrence`, `schedule.startAt` / `endAt` / `durationMin`, `createdAt`, `updatedAt`, `_id`.

`activityId` in tools is `String(_id)` (24-char hex). Do not invent `act_` prefixes.

---

## 7b. User contract (closed)

Collection name: `users`. Google is the identity provider. Do not store passwords. Do not store Google tokens.

```
User {
  _id: ObjectId
  googleId: string
  email: string
  name: string
  picture: string
  timezone: string
  createdAt: Date
  updatedAt: Date
}
```

Rules:

- Field set is closed. Do not add fields.
- `strict: true`. Extra keys are rejected.
- No `versionKey`.
- `googleId` is unique.
- `picture` defaults to `""`.
- On first login, `timezone` is set from env `TIMEZONE`.
- Login finds by `googleId` or creates.
- `/auth/me` and login `user` are `{ id, googleId, email, name, picture, timezone, createdAt, updatedAt }`.
- Login callback body is `{ token, user }`.

JWT payload (minimal):

```
{ "sub": "<userId>", "email": "<email>", "name": "<name>" }
```

Do not put permissions or large user data in the token.

---

## 7c. Scheduling preference contract (closed)

Collection name: `scheduling_preferences`. `preferenceId` in tools is `String(_id)` (24-char hex). Do not invent `pref_` prefixes.

```
SchedulingPreference {
  _id: ObjectId
  userId: ObjectId
  type: sleep_window | learning_window | quiet_hours | commute | workload_limit | focus_duration | exam_planning
  value: object   // shape closed per type (section 8)
  timezone: string
  createdAt: Date
  updatedAt: Date
}
```

Rules:

- Field set is closed. Do not add fields.
- `strict: true`. Extra keys are rejected.
- No `versionKey`.
- Unique index `{ userId: 1, type: 1 }` (one document per type per user).
- `value` is validated against `type`. Wrong shape is rejected.
- This collection is the only store for scheduling configuration. Do not store a copy on `User`.

`value` by type:

| `type` | `value` |
| --- | --- |
| `sleep_window` | `{ start: "HH:mm", end: "HH:mm" }` |
| `learning_window` | `{ start: "HH:mm", end: "HH:mm" }` |
| `quiet_hours` | `{ start: "HH:mm", end: "HH:mm" }` |
| `commute` | `{ durationMin: number }` (`>= 0`) |
| `workload_limit` | `{ maxImportant: number }` (`>= 1`; `priority >= 4` counts as important) |
| `focus_duration` | `{ durationMin: number }` (`>= 1`) |
| `exam_planning` | `{ enabled: true, daysBeforeExam: number }` (`>= 1`) |

`calendar.user_preferences` compatibility adapter (not one of the frozen 8 tools):

| Blob field | `type` | stored `value` |
| --- | --- | --- |
| `quietHours.{startHour,endHour}` | `quiet_hours` | `{ start, end }` as `HH:00` |
| `bestLearningWindow` | `learning_window` | same |
| `focusDurationMin` | `focus_duration` | `{ durationMin }` |
| `maxDailyHighPriorityTasks` | `workload_limit` | `{ maxImportant }` |

Update replaces those four types for the user and does not delete `sleep_window` / `commute` / `exam_planning`. `preferredBreakMin` is not a closed type and is rejected. Timezone on write = user timezone, else env `TIMEZONE`. Missing `workload_limit` → create capacity default 3. Missing `focus_duration` → split_task default 60.

---

## 7d. Memory contract (closed)

Collection name: `memories`. `memoryId` in tools is `String(_id)` (24-char hex). Do not invent `mem_` prefixes.

```
Memory {
  _id: ObjectId
  userId: ObjectId
  category: preference | habit | goal | relationship | health | temporary_preference
  content: string
  confidence: number          // 0–1 inclusive; default 0.9
  expiresAt: Date | null      // default null; required when category is temporary_preference
  createdAt: Date
  updatedAt: Date
}
```

Rules:

- Field set is closed. Do not add fields.
- `strict: true`. Extra keys are rejected.
- No `versionKey`.
- Index `{ userId: 1, category: 1 }`.
- Scheduling configuration is not a memory. Use `scheduling_preferences`.

---

## 7e. Conversation state contract (closed)

Collection name: `conversation_states`. One document per user.

```
ConversationState {
  _id: ObjectId
  userId: ObjectId
  mission: string             // default ""
  context: string             // default ""
  entities: object            // default {}
  updatedAt: Date
}
```

Rules:

- Field set is closed. Do not add fields.
- `strict: true`. Extra keys are rejected.
- No `versionKey`.
- Unique index `{ userId: 1 }`.
- Timestamps: `updatedAt` only (no `createdAt`).
- `mission` and `context` are `required: false` in Mongoose because empty string fails Mongoose `required`. They still default to `""`.

---

## 8. Closed values

Copy these from `constants.ts`. Do not invent aliases (`movable`, `completed`, `todo`).

| Set | Values |
| --- | --- |
| `FLEXIBILITY` | `fixed`, `moveable`, `floating` |
| `RECURRENCE_RULE` | `none`, `daily`, `weekly`, `monthly`, `yearly` |
| `ACTIVITY_STATUS` | `pending`, `done`, `missed`, `cancelled` |
| `CREATED_BY` | `ai`, `user`, `system` |
| `PRIORITY` | `1`, `2`, `3`, `4`, `5` |
| `WEEKDAY` | `1`–`7` (Monday–Sunday) |
| `LIST_RANGE` | `day`, `week`, `month`, `custom` (in `calendar/contract.ts`) |
| `PREFERENCE_TYPE` | `sleep_window`, `learning_window`, `quiet_hours`, `commute`, `workload_limit`, `focus_duration`, `exam_planning` |
| `MEMORY_CATEGORY` | `preference`, `habit`, `goal`, `relationship`, `health`, `temporary_preference` |

Meanings (do not rewrite):

| Priority | Meaning |
| --- | --- |
| 5 | Critical |
| 4 | Important |
| 3 | Normal |
| 2 | Optional |
| 1 | Someday |

| Flexibility | Meaning |
| --- | --- |
| `fixed` | Cannot move automatically |
| `moveable` | AI may reschedule |
| `floating` | AI chooses the best time |

| Status | Meaning |
| --- | --- |
| `pending` | Not completed |
| `done` | Completed |
| `missed` | Time passed |
| `cancelled` | Intentionally removed |

Defaults:

| Field | Default |
| --- | --- |
| `note` | `""` |
| `category` | `""` |
| `status` | `pending` |
| `reminders` | `[]` |
| `tags` | `[]` |
| `metadata` | `{}` |
| `recurrence.rule` | `none` |
| `recurrence.interval` | `1` |
| `recurrence.days` | `[]` |
| `recurrence.until` | `null` |
| `schedule.startAt` / `endAt` / `durationMin` | `null` |
| `createdBy` on `calendar.create` | `ai` |
| memory `confidence` | `0.9` |
| memory `expiresAt` | `null` |
| conversation `mission` / `context` | `""` |
| conversation `entities` | `{}` |

No default for `timezone` (except list/suggest fallback `TIMEZONE`), `flexibility`, `priority`, `title`, `userId`.

---

## 9. Indexes and queries

Indexes (activities, only these):

1. `{ userId: 1, "schedule.startAt": 1 }`
2. `{ userId: 1, status: 1 }`
3. `{ userId: 1, priority: -1 }`
4. `{ userId: 1, status: 1, "schedule.startAt": 1 }`

Users: unique index on `googleId` (find-or-create).

`scheduling_preferences`: unique `{ userId: 1, type: 1 }`.

`memories`: `{ userId: 1, category: 1 }`.

`conversation_states`: unique `{ userId: 1 }`.

Do not add indexes until the user asks.

`suggest_slot` occupancy also includes `quiet_hours` from `scheduling_preferences` when present, and prefers a gap inside `learning_window` when that window is free.

Implemented query shapes:

- Day / week / month / custom window `[start, end)` in the requested timezone
- Non-recurring list: `userId` + `schedule.startAt` in `[start, end)`
- Recurring list: `userId` + `behavior.recurrence.rule` in `daily|weekly|monthly|yearly` + stored `schedule.startAt` `< end`, then expand in memory
- Expanded list rows use the same `activityId`; `startAt` / `endAt` are the occurrence instants; documents are not duplicated
- Week is ISO (Monday 00:00 to next Monday 00:00) in `TIMEZONE`
- Month is calendar month of `date` in `TIMEZONE`
- Custom: `startAt` + `endAt` (ISO or `YYYY-MM-DD`)
- Conflicts / suggest: pending activities with a `startAt` `< window.end`, occupancy against expanded instances
- `suggest_slot` also loads pending `floating` activities with `schedule.startAt` null and a `durationMin`, and reserves them into free gaps before choosing the requested slot
- Sort list by occurrence `startAt` ascending

---

## 10. Schedule shapes (data only)

The schema allows nulls. Callers fill what they have. Do not add schema validators that require a specific combination.

| Situation | Stored |
| --- | --- |
| Meeting | `startAt` + `endAt` |
| Timed block | `startAt` + `durationMin` |
| Reminder | `startAt` only |
| Floating task | `durationMin` only |

Occupancy used by conflicts and suggest_slot:

- `endAt` present → `[startAt, endAt)`
- else `durationMin` present → `[startAt, startAt + durationMin)`
- else point `[startAt, startAt)`
- no `startAt` → not occupied (except `suggest_slot` packing below)

`suggest_slot` additionally packs pending unscheduled floating tasks (`flexibility: floating`, `startAt` null, `durationMin` set) into free gaps, higher `priority` first, using the same largest-gap placement as the requested slot. Those reserved blocks count as busy for the suggestion. Conflicts do not pack unscheduled floating tasks.

Product planner rules (AI layer, not coded as auto-reschedule):

1. `fixed` never moves automatically.
2. `moveable` may shift on conflict.
3. `floating` fills gaps.
4. Higher `priority` wins.

The API does not auto-reschedule. It returns conflict data. The AI decides what to say and which tool to call next.

---

## 11. Scope

**Included**

- Hour-wise scheduling fields
- Recurrence rule stored; expanded inside `calendar.list`, `calendar.conflicts`, and `calendar.suggest_slot` query windows; not persisted
- `fixed` / `moveable` / `floating`
- Priority 1–5
- Reminder offsets
- Calendar tools over REST (Bearer JWT required)
- Conflict detection (read-only)
- Slot suggestion (read-only)
- Google OAuth + backend JWT
- `users` collection
- `scheduling_preferences`, `memories`, `conversation_states` collections
- MCP calendar tools (`userId` from JWT `sub`)

**Deferred. Do not implement.**

- `POST /auth/refresh`
- `activity_instances`
- Notification delivery
- Calendar sharing
- Multi-timezone travel
- Attachments
- Location triggers
- `notifications` collection
- `deleteFutureRecurrences`
- Notes, Finance, GitHub, Email tools
- AI Orchestrator (see `plan.md` V2; multi-module MCP coordination; do not start until asked)

**Code quality (non-negotiable)**

Modular. Reusable. Maintainable. Scalable. Readable. Clean. Simple. Complete. Do not overengineer. Do not add repository/DTO/factory layers.

---

## 12. Change procedure

When the user asks to change the activity model:

1. Change `constants.ts` if a closed value or default or index changes.
2. Change `activity.types.ts` if a field or nullability changes.
3. Change `activity.schema.ts` so Mongoose matches types and constants.
4. Change `index.ts` only if a public export was added or removed.
5. Change `calendar/contract.ts` and `calendar/service.ts` if tool I/O depends on the field.
6. Update this file.
7. Run `npm run typecheck` in `backend/`.

When the user asks to change the user model:

1. Change `user.types.ts` if a field or nullability changes.
2. Change `user.schema.ts` so Mongoose matches.
3. Change `auth/http.ts` if login or `/auth/me` depends on the field.
4. Do not add Google tokens or passwords unless the user asks.
5. Update this file section 7b.
6. Run `npm run typecheck` in `backend/`.

When the user asks to change a tool:

1. Change `calendar/contract.ts` (types + parser).
2. Change `calendar/service.ts`.
3. Change `calendar/http.ts` only if the REST path or status code changes.
4. Update this file section 15–16.

When the user asks for MCP or UI:

1. Reuse `CalendarService`. Do not duplicate tool logic.
2. Do not add new activity fields.
3. MCP `userId` comes from the backend JWT, never from tool input and never from Google tokens.
4. Update **Current state** and **File map** in the same turn.

When the user asks to change scheduling preferences, memories, or conversation state:

1. Change `constants.ts` if a closed value, default, collection name, or index changes.
2. Change the matching `*.types.ts` if a field or nullability changes.
3. Change the matching `*.schema.ts` so Mongoose matches types and constants.
4. Change `index.ts` only if a public export was added or removed.
5. Change `calendar/contract.ts` and `calendar/service.ts` if the `calendar.user_preferences` adapter depends on the field.
6. Update this file sections 7c–7e, 8, and 9.
7. Run `npm run typecheck` in `backend/`.

When the user asks for the AI Orchestrator:

1. Follow `plan.md` V2. Talk to MCP tools only, not REST or MongoDB. Coordinate Calendar, Calendar Intelligence, Karen Memory, Reflection, and Conversation modules as specified there.
2. Do not change the existing 8 `calendar.*` tool I/O or the activities schema.
3. Ownership (`plan b.md` section 6.4): `calendar.preferences.*` owns scheduling configuration; `memory.*` owns personal knowledge. Do not store a second copy. The user never chooses which tool.
4. Update this file.

When the user asks for the Karen Module or Calendar Intelligence:

1. Follow `plan b.md`. Complete the assigned scope per the Completion Contract.
2. Persistence is `scheduling_preferences`, `memories`, and `conversation_states` (this file sections 7c–7e).
3. Ownership (`plan b.md` section 6.4): `calendar.preferences.*` owns scheduling configuration; `memory.*` owns personal knowledge. Do not store a second copy. The user never chooses which tool.
4. Talk to MCP tools only, not REST or MongoDB.
5. Do not change the existing 8 `calendar.*` tool I/O or the activities schema.
6. Update this file.

---

## 13. Update this file (every completed task)

Update before ending the turn:

- [ ] **Current state** matches the repo
- [ ] **File map** lists every project file that exists
- [ ] Contract / enums / defaults / indexes match `backend/model/`
- [ ] Tool list and REST map match `calendar/contract.ts`
- [ ] MCP map matches `backend/mcp/`
- [ ] **Next allowed work** is either the user’s next ask or `none`
- [ ] No leftover “planned” items that were already built
- [ ] No leftover “built” items that were removed
- [ ] Task file archived to `activeagents/finished/` with files modified and changes made

Do not rewrite history. Replace current facts.

---

## 14. Code conventions

- TypeScript `strict`
- Named exports
- Import model types from `model/index.ts`
- No `any`
- `moveable` spelling is required (not `movable`)
- Run: `npm run dev` (tsx watch) or `npm run build` && `npm start` in `backend/`
- Tests: `npm test` in `backend/`
- Typecheck: `npm run typecheck` in `backend/`
- MCP stdio: `npx tsx backend/mcp/server.ts` with `MONGODB_URI`, `JWT_SECRET`, `TIMEZONE`, `RYTHAM_JWT` (stdio also reads `backend/.env` next to `mcp/`)

---

## 15. Tool ↔ REST map

The AI only knows tools. REST maps 1:1 onto `CalendarService`.

| Tool | REST | Service method |
| --- | --- | --- |
| `calendar.create` | `POST /activities` | `create` |
| `calendar.update` | `PATCH /activities/:id` | `update` |
| `calendar.delete` | `DELETE /activities/:id` | `delete` |
| `calendar.list` | `GET /activities` | `list` |
| `calendar.complete` | `POST /activities/:id/complete` | `complete` |
| `calendar.reschedule` | `POST /activities/:id/reschedule` | `reschedule` |
| `calendar.conflicts` | `POST /calendar/conflicts` | `conflicts` |
| `calendar.suggest_slot` | `POST /calendar/suggest-slot` | `suggestSlot` |

Ops only (not a calendar tool): `GET /health` → `{ ok, db }` (unauthenticated).

Calendar REST requires `Authorization: Bearer <JWT>`. Missing or invalid JWT → 401. The backend uses `req.user.id` as `userId`. Clients must not send `userId`.

Auth REST (not calendar tools):

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/auth/google` | Start login (redirect to Google) |
| GET | `/auth/google/callback` | OAuth callback → `{ token, user }` |
| POST | `/auth/logout` | Logout (`{ success: true }`) |
| GET | `/auth/me` | Current user profile |

Login callback body: `{ token, user }` where `user` is `{ id, googleId, email, name, picture, timezone, createdAt, updatedAt }`.

`GET /auth/me` returns that same `user` object (not wrapped). `POST /auth/logout` returns `{ success: true }`.

`POST /auth/refresh` is deferred.

Error body: `{ success: false, message }`.

Unknown tool fields → 400. Unknown update paths → 400. Missing activity → 404.

---

## 16. Tool input / output

Parsers reject extra keys. `userId` is never in tool input. HTTP and MCP resolve `userId` from the backend JWT (`sub`).

### `calendar.create`

Required: `title`, `schedule.timezone`, `behavior.flexibility`, `priority`.

Create response:

```
{ success: true, activityId, message: "<title> added." }
```

HTTP 201.

`createdBy` defaults to `ai`.

### `calendar.update`

Body:

```
{ activityId, changes: { "schedule.startAt": "<ISO>" } }
```

REST takes `activityId` from `:id`. Body still wraps fields in `changes`. Dotted paths only. No full document replace.

Allowed paths: `ALLOWED_UPDATE_PATHS` in `contract.ts`.

Cannot update `_id`, `userId`, `createdAt`, `updatedAt`, `createdBy`.

Response: `{ success: true, activityId, message: "<title> updated." }`

### `calendar.reschedule`

```
{ activityId, newStartAt, reason? }
```

`reason` is accepted and not stored.

New end:

1. If `durationMin` is set → `newStartAt + durationMin`
2. Else if previous `startAt` and `endAt` exist → keep that span
3. Else keep previous `endAt` (may be null)

Always persist `schedule.endAt` to that value, including `null`. Do not skip the write when duration is null.

Response: `{ success: true, newEndAt }` (`newEndAt` ISO or null)

Write path: `findOneAndUpdate` matching `_id`, `userId`, and `updatedAt`. Stale `updatedAt` → HTTP 409 `{ success: false, message }`. Wrapped in a Mongo transaction when the topology supports it. Tool I/O is unchanged.

### `calendar.list`

```
{ range: "day"|"week"|"month"|"custom", date?, startAt?, endAt?, timezone? }
```

- `day` / `week` / `month` require `date` as `YYYY-MM-DD`
- `custom` requires `startAt` and `endAt`
- `timezone` optional; default env `TIMEZONE`

REST: query string on `GET /activities`.

Response: `{ activities: CalendarActivityView[] }`

Each item includes `activityId`, `title`, `note`, `category`, `startAt`, `endAt`, `durationMin`, `timezone`, `flexibility`, `recurrence`, `priority`, `reminders`, `status`, `tags`, `metadata`, `createdBy`, `createdAt`, `updatedAt`. Dates are ISO strings or null.

Recurring series emit one view per occurrence whose `startAt` falls in the window. `activityId` is the stored document id on every occurrence.

### `calendar.complete`

```
{ activityId }
```

Response: `{ status: "done" }`

### `calendar.delete`

```
{ activityId }
```

`deleteFutureRecurrences: true` → 400 (not in V1).

Response: `{ success: true }`

### `calendar.conflicts`

```
{ startAt, endAt }
```

Compares against `status: "pending"` only. Recurring series use expanded instances in the window; the same `activityId` is returned at most once.

Response:

```
{ conflicts: [{ activityId, title, priority, flexibility }] }
```

### `calendar.suggest_slot`

```
{ date: "YYYY-MM-DD", durationMin, timezone? }
```

Search window: that local calendar day `[00:00, next 00:00)`.

Places `durationMin` at the **start of the largest free gap**. Tie → earlier gap. Occupied = pending activities (including expanded recurring instances) that overlap the day, plus unscheduled pending floating tasks packed into gaps (`reserveFloatingGaps` in `time.ts`).

Response:

```
{ suggestedStart: "HH:mm"|null, suggestedEnd: "HH:mm"|null, reason }
```

If a busy block follows the chosen gap: `Largest free slot before <title>.` Else `Largest free slot.` If none: both times null, `No free slot of <n> minutes.`

### `calendar.preferences.save`

```
{ type, value, timezone? }
```

`type` must be one of: `sleep_window`, `learning_window`, `quiet_hours`, `commute`, `workload_limit`, `focus_duration`, `exam_planning`. `timezone` defaults to env `TIMEZONE`. Upserts on `{ userId, type }` (one preference per type per user).

Response: `{ success: true, preferenceId, message }`

### `calendar.preferences.get`

```
{ types?: PreferenceType[] }
```

Omit `types` to return all active preferences. Filter by types array if provided.

Response: `{ preferences: [{ preferenceId, type, value, timezone, updatedAt }] }`

### `calendar.preferences.update`

```
{ preferenceId, value }
```

Updates the value of an existing preference.

Response: `{ success: true, preferenceId, message }`

### `calendar.preferences.delete`

```
{ preferenceId }
```

Deletes a scheduling preference.

Response: `{ success: true }`

### `calendar.capacity.check`

```
{ date: "YYYY-MM-DD", timezone? }
```

Checks if the day's workload (activities with `priority >= 4`) exceeds the user's `workload_limit` preference.

Response: `{ exceedsLimit: boolean, count: number, limit: number | null, date }`

### `calendar.missed.review`

```
{ date?: "YYYY-MM-DD", timezone? }
```

Default `date` = today. Finds activities with `status: "missed"` before the date and suggests recovery dates for `moveable` and `floating` items.

Response: `{ missed: [{ activityId, title, priority, flexibility }], suggestions: [{ activityId, suggestedDate, reason }] }`

### `calendar.preview`

```
{ date: "YYYY-MM-DD", timezone? }
```

Generates a natural summary for the day including activity count, important task count vs. workload limit, and full activity list.

Response: `{ summary: string, activities: CalendarActivityView[], workload: { count, limit } }`

### `conversation.state`

```
{ mission?, context?, entities? }
```

At least one field required. `mission` and `context` are strings. `entities` is an object for resolved references (e.g., `{"it": "activityId", "that meeting": "title"}`). Upserts conversation state (creates if missing, updates provided fields if exists).

Response: `{ success: true }`

### `conversation.context`

```
{}
```

Retrieves current conversation state. Returns empty values if no state exists.

Response: `{ mission, context, entities, updatedAt }` (ISO 8601)

### `conversation.clear`

```
{}
```

Deletes conversation state for the user.

Response: `{ success: true }`

### `memory.save`

```
{ category, content, confidence?, expiresAt? }
```

`category` must be one of: `preference`, `habit`, `goal`, `relationship`, `health`, `temporary_preference`.
`confidence` defaults to `0.9` (range 0-1 inclusive).
`expiresAt` is required when `category` is `temporary_preference` (ISO 8601 date).

Response: `{ success: true, memoryId, message }`

### `memory.search`

```
{ query, limit? }
```

Searches memories by content using regex match. `limit` defaults to `5`.

Response: `{ memories: [{ memoryId, category, content, confidence, updatedAt }] }`

### `memory.update`

```
{ memoryId, content?, confidence? }
```

Updates memory content or confidence. At least one field required. Confidence must be 0-1.

Response: `{ success: true, memoryId, message }`

### `memory.delete`

```
{ memoryId }
```

Deletes a memory by ID. Returns 404 if not found or not owned by user.

Response: `{ success: true }`

### `memory.list`

```
{ category? }
```

Lists all memories for user, optionally filtered by category. Sorted by `updatedAt` descending.

Response: `{ memories: [{ memoryId, category, content, confidence, expiresAt, updatedAt }] }`

### `reflection.daily`

```
{ date?, timezone? }
```

`date` is `YYYY-MM-DD` (defaults to today). `timezone` is IANA timezone (defaults to user timezone from context).

Queries activities for the day and counts by status. Generates natural language summary.

Response: `{ summary: string, completed: number, missed: number, upcoming: number }`

### `reflection.weekly`

```
{ date?, timezone? }
```

`date` is `YYYY-MM-DD` (defaults to current week). `timezone` is IANA timezone (defaults to user timezone from context).

Queries activities for ISO week containing the date. Analyzes completion rate, busiest days, recurring activity adherence, and priority distribution.

Response: `{ summary: string, insights: string[] }`

`insights` is an array of 3-5 actionable observations about weekly patterns.

### `reflection.monthly`

```
{ date?, timezone? }
```

`date` is `YYYY-MM-DD` (defaults to current month). `timezone` is IANA timezone (defaults to user timezone from context).

Queries activities for calendar month containing the date. Analyzes overall completion rate, category distribution, priority vs completion correlation, and improvement areas.

Response: `{ summary: string, trends: string[] }`

`trends` is an array of 3-5 observations about monthly trends.

---

## 16b. MCP contract

MCP is the AI tool surface. REST is not what the AI calls.

- Facade: `backend/mcp/server.ts` (`createMcpServer`, `wireMcpSdkHandlers`, stdio `runStdioServer`)
- Calendar tools live in `backend/mcp/modules/calendar.ts` and call `CalendarService`
- Conversation tools live in `backend/mcp/modules/conversation.ts` and call `ConversationService`
- Reflection tools live in `backend/mcp/modules/reflection.ts` and call `ReflectionService` (generates summaries on-demand; no persistence)
- Execution: `executeToolCall` in `mcp/transport.ts`
- Envelope: `{ success: true, data }` or `{ success: false, error: { code, message } }`
- SDK `CallTool` result sets `isError: true` when that envelope is a failure (including thrown `McpError` / `HttpError` mapped by `handleMcpError`)
- SDK capabilities: `{ tools: {}, resources: {}, prompts: {} }`. `resources/list` and `prompts/list` return empty arrays. `resources/read` returns `{ contents: [] }`. `prompts/get` returns `{ messages: [] }`.
- Tool input must not include `userId` → `VALIDATION_ERROR`
- Unknown tool → `NOT_FOUND`
- Missing permission → `FORBIDDEN`
- Stdio `CallTool` identity: `createUserContext({ jwt: process.env.RYTHAM_JWT })` using `JWT_SECRET`
- Stdio loads dotenv from `path.resolve(__dirname, "../.env")` (`backend/.env`), not `process.cwd()`
- Missing or invalid stdio identity → `McpError` `UNAUTHORIZED` (`Invalid or missing userId in context`); `CallTool` returns that envelope
- Cursor MCP `mcp_auth` is not Rytham identity. `userId` is never taken from Cursor session context or tool input
- Remote Cursor MCP: Streamable HTTP POST `/mcp` with header `X-MCP-API-Key` matching env `MCP_API_KEY`. HTTP tool identity is `Authorization: Bearer <JWT>` on **that request** (`createUserContextFromRequestAuthorization`). `MCP_USER_ID` and `RYTHAM_JWT` are not used for HTTP identity.
- Streamable HTTP sessions: `initialize` without `Mcp-Session-Id` creates a transport, returns `Mcp-Session-Id` (`crypto.randomUUID`). Later POST/GET/DELETE reuse that transport. Unknown id → 404 JSON-RPC `-32001`. Non-initialize without id → 400 JSON-RPC `-32000`. DELETE (and transport `onclose`) drops the session and closes the SDK server. Stdio is unchanged (one process, one transport).
- Tests and in-process calls may pass `UserContext` or `{ jwt }` / `{ userId }`

Default V1 permissions: `calendar:read`, `calendar:write`, `calendar:delete`, `calendar:preferences:read`, `calendar:preferences:write`, `calendar:preferences:delete`, `conversation:read`, `conversation:write`, `reflection:read`.

| Tool | Permissions |
| --- | --- |
| `calendar.create` | `calendar:write` |
| `calendar.update` | `calendar:write` |
| `calendar.complete` | `calendar:write` |
| `calendar.reschedule` | `calendar:write` |
| `calendar.delete` | `calendar:delete` |
| `calendar.list` | `calendar:read` |
| `calendar.conflicts` | `calendar:read` |
| `calendar.suggest_slot` | `calendar:read` |
| `calendar.preferences.save` | `calendar:preferences:write` |
| `calendar.preferences.get` | `calendar:preferences:read` |
| `calendar.preferences.update` | `calendar:preferences:write` |
| `calendar.preferences.delete` | `calendar:preferences:delete` |
| `calendar.capacity.check` | `calendar:preferences:read` |
| `calendar.missed.review` | `calendar:preferences:read` |
| `calendar.preview` | `calendar:preferences:read` |
| `conversation.state` | `conversation:write` |
| `conversation.context` | `conversation:read` |
| `conversation.clear` | `conversation:write` |
| `reflection.daily` | `reflection:read` |
| `reflection.weekly` | `reflection:read` |
| `reflection.monthly` | `reflection:read` |

Error codes (`mcp/errors.ts`): `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `CALENDAR_CONFLICT`, `NO_AVAILABLE_SLOT`, `INTERNAL_ERROR`.

HTTP status mapping from `HttpError`: 401 → `UNAUTHORIZED`, 403 → `FORBIDDEN`, 404 → `NOT_FOUND`, 409 → `CALENDAR_CONFLICT`, 400 → `VALIDATION_ERROR`.

---

## 17. Environment

Keys (values live only in `backend/.env`):

| Key | Meaning |
| --- | --- |
| `MONGODB_URI` | Atlas URI, database name `rytham` |
| `PORT` | HTTP port, default `3000` |
| `TIMEZONE` | Default IANA zone, default `Asia/Kolkata` |
| `GOOGLE_CLIENT_ID` | Google OAuth client id |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | OAuth redirect URI (`http://localhost:3000/auth/google/callback` locally) |
| `JWT_SECRET` | Backend JWT signing secret |
| `JWT_EXPIRES_IN` | JWT lifetime, default `7d` |
| `RYTHAM_JWT` | Backend JWT for MCP stdio (never a Google token) |
| `MCP_API_KEY` | Remote `/mcp` header `X-MCP-API-Key` (required when `NODE_ENV=production`) |
| `CORS_ORIGINS` | Comma-separated browser origins. Required when `NODE_ENV=production`. Non-production CORS is `Access-Control-Allow-Origin: *`. Production echoes a matching origin only; methods `GET,POST,PATCH,DELETE,OPTIONS`; `Access-Control-Allow-Credentials: false`. |

`USER_ID` is not used. Identity is JWT `sub`.

Local Google OAuth: origin `http://localhost:3000`, callback `http://localhost:3000/auth/google/callback` when the API listens on port 3000. If the API uses port 5000, set the Google redirect URI to `http://localhost:5000/auth/google/callback`.

Later production callback: `https://api.rytham.ai/auth/google/callback`.

Do not put URI passwords, client secrets, or JWT secrets in this file or in source. `oauth.json` is gitignored and is not loaded at runtime. `.cursor/mcp.json` is local Cursor wiring; do not copy its env values into this file.

---

## 18. Testing & Test Suite Specification

**Framework:** Jest + Supertest + Mongoose (`backend/tests/`)  
**Execution Command:** `npm test` (or `npm run typecheck && npm test` in `backend/`)

### Isolated Test Database
- Tests run against `MONGODB_URI_TEST` if set, or fall back to an in-memory MongoDB server via `mongodb-memory-server`.
- `connectTestDb` calls `ActivityModel.syncIndexes()` and `UserModel.syncIndexes()`. Performance tests call `syncIndexes` again after `insertMany`.
- `calendar.reschedule` uses a Mongo transaction when the topology is a replica set, mongos, or load balancer (Atlas). Standalone test Mongo uses the same `updatedAt` optimistic lock without a transaction.
- **Database Lifecycle:**
  - `beforeAll`: Connect to isolated test database.
  - `beforeEach`: Clear collections and re-seed deterministic dataset.
  - `afterAll`: Drop database and close connection.
  - **Guarantee:** Zero persistent data changes after execution.

### Seed Dataset (`tests/helpers/seed.ts`)
- **Test Google profile:** `google-test-001` / `user_test_001@gmail.com` / `Test User`
- **User ID:** `000000000000000000000001` (`user_test_001`)
- **Valid JWT / expired JWT / invalid JWT** in `tests/helpers/auth.ts`
- **Timezone:** `Asia/Kolkata`
- **Seeded Activities (`2026-09-09`):**
  1. *Dell Meeting*: 10–11 AM (Fixed, Priority 5)
  2. *Lunch*: 1 PM (Fixed, Priority 4)
  3. *Gym*: 6 PM (Moveable, Priority 3)
  4. *Dinner*: 8:30 PM (Daily, Priority 5)
  5. *Vitamin D*: 10:45 PM (Weekly, Priority 2)

### Test Coverage Matrix (`30` Suites / `218` Tests)
- `auth.test.ts`: Login success (JWT issued), invalid callback 401, missing JWT 401, expired JWT 401, invalid JWT 401, `/auth/me` profile, Google redirect, logout.
- `protected.test.ts`: Every Calendar endpoint — valid JWT success, missing JWT 401, invalid JWT 401.
- `create.test.ts`: Valid event creation, duration parsing, missing title rejection, invalid date validation, negative duration rejection, duplicate submission idempotency.
- `read.test.ts`: Day, week, month views, empty day handling, invalid date format validation.
- `update.test.ts`: Partial field updates while preserving unedited fields, empty payload rejection.
- `delete.test.ts`: Deleting existing & non-existent activities (404).
- `complete.test.ts`: Completing pending activities, idempotent status handling.
- `reschedule.test.ts`: Rescheduling moveable activities, rejecting fixed activities (400 Bad Request), midnight date transitions, null duration / null endAt.
- `conflicts.test.ts`: Conflict detection in range, boundary touching, full containment, partial overlaps.
- `suggest-slot.test.ts`: Largest free slot calculation, impossible duration handling, unscheduled floating tasks reserved in slot planning.
- `recurrence.test.ts`: Daily, weekly (ISO weekday array), monthly, and yearly rules stored; expansion inside list windows; `until`; no duplicate documents.
- `reminders.test.ts`: Single, multiple, zero, and negative reminder offsets.
- `priority.test.ts`: Priority range validation (1–5 accepted; 0, 6, negative rejected).
- `timezone.test.ts`: Preservation of `Asia/Kolkata` timezone and UTC ISO conversion accuracy.
- `status.test.ts`: Status lifecycle transitions (`pending` -> `done`, `cancelled`, `missed`).
- `integrity.test.ts`: Timestamp preservation (`createdAt`), `updatedAt` updates, `userId` immutability.
- `concurrency.test.ts`: Concurrent creations, updates, delete-during-update, and parallel reschedule (200 or 409; one committed startAt).
- `security.test.ts`: Invalid hex ID rejection, malformed JSON handling, unknown fields rejection, multi-tenant user isolation, production CORS allowlist.
- `performance.test.ts`: Smoke performance verification with 1,000 seeded activities (day/week/month under 500 ms).
- `mcp.test.ts`: MCP tool discovery (21 `calendar.*` tools), execution with JWT `userId`, permissions, security, and HTTP JWT isolation.
- `mcp-auth.test.ts`: MCP HTTP `X-MCP-API-Key` (valid, missing, invalid); tools/call without Bearer JWT is `UNAUTHORIZED`.
- `mcp-session.test.ts`: Streamable HTTP session id on initialize, transport reuse, missing/unknown session, DELETE cleanup, initialize capabilities (tools/resources/prompts), `CallTool` `isError: true` on failure.
- `calendar-intelligence.test.ts`: Calendar Intelligence tools (20 tests: CRUD preferences with upsert behavior, capacity check with/without limit, missed activity review, day preview with workload summary, user isolation, unique constraint enforcement).
- `buffers.test.ts`: Travel buffer (`bufferBeforeMin`) and meeting buffer (`bufferAfterMin`) conflict detection.
- `undo.test.ts`: Atomic `calendar.undo` reverting create, update, delete, complete, and reschedule.
- `preferences.test.ts`: `calendar.user_preferences` adapter onto `scheduling_preferences` (`quietHours`, `bestLearningWindow`, `focusDurationMin`) and preference-aware slot suggestions.
- `collections.test.ts`: Model-level unique indexes, value/category validation, defaults, `temporary_preference` expiresAt, conversation `updatedAt` only, user isolation.
- `intelligence.test.ts`: Daily capacity warnings, duplicate creation warnings, multi-day task splitting, missed task rescue, rollover, and weekly workload summary.


# Rytham V1 — Agent Workflow

This file is the project operating contract. Read it at the start of every prompt. Update it at the end of every change. Do not work from memory.

Cursor rule `.cursor/rules/rytham-workflow.mdc` (`alwaysApply: true`) requires this file on every prompt.

---

## 1. Mandatory loop

1. Read this file before any work.
2. Read `backend/model/` if the task touches data.
3. Read `backend/auth/` if the task touches identity or JWT.
4. Read `backend/calendar/` if the task touches calendar tools or HTTP.
5. Read `backend/mcp/` if the task touches MCP.
6. Do only what the user asked and what this file already allows.
7. Keep types, schema, constants, tool contract, and this file identical.
8. After the change, update **Current state**, **File map**, and any contract that changed.
9. Stop. Do not add follow-on work.

If a step is missing from this file and from the user message, stop and ask. Do not fill the gap.

---

## 2. Decision policy

No independent decisions. No invented architecture, fields, collections, modules, libraries, defaults, or features.

| Situation | Action |
| --- | --- |
| Specified here or in the user message | Follow it |
| Two options exist | Stop and ask |
| Not in V1 scope | Do not build it |
| “Helpful extra” | Do not add it |
| Naming / folder / type already listed | Reuse it |
| Spec and this file disagree | Stop and ask |

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

**Freeze:** the activities schema is stable. Calendar tool I/O cannot change without a version bump. Future modules (Notes, Finance, GitHub, Email) must integrate without modifying Calendar's public contract unless absolutely necessary.

Identity is Google OAuth. The backend finds or creates a `users` document and issues its own JWT. Every API uses `Authorization: Bearer <JWT>`. `userId` is JWT `sub` (`req.user.id`). Clients must not send `userId`. AI and MCP use this JWT, never Google's access token. Do not store passwords. Do not store Google tokens on `User`.

---

## 4. Current state

**Status:** Schema + MongoDB + Google OAuth/JWT auth + calendar tool API over REST + MCP capability layer. Auth is locked. Activities schema is frozen.

**Implemented**

- Collection `users` (Google identity; no passwords; no Google tokens)
- Collection `activities`
- Closed enums and defaults in `backend/model/constants.ts`
- TypeScript contracts in `backend/model/activity.types.ts` and `backend/model/user.types.ts`
- Mongoose schemas in `backend/model/activity.schema.ts` and `backend/model/user.schema.ts`
- Public barrel `backend/model/index.ts`
- MongoDB connection `backend/db.ts` (`MONGODB_URI` in `backend/.env`)
- Google OAuth + JWT in `backend/auth/`
- Tool I/O in `backend/calendar/contract.ts` (`userId` never in tool input)
- `CalendarService` in `backend/calendar/service.ts` (one method per tool; `userId` from constructor)
- REST transport in `backend/calendar/http.ts` (Bearer JWT required; `userId` from `req.user.id`)
- MCP capability layer in `backend/mcp/` (`userId` from JWT `sub`; stdio loads `backend/.env` from `mcp/server.ts` so `RYTHAM_JWT` is present even if Cursor cwd differs; missing JWT is `UNAUTHORIZED`)
- Process entry `backend/server.ts`
- End-to-End API, Auth, and MCP test suite with Jest + Supertest + MongoDB in `backend/tests/`

**Not implemented (do not start unless the user asks)**

- Recurrence expansion (`activity_instances`)
- Notifications, memories
- UI
- Product planner / AI Orchestrator (specified in `plan.md`; not coded)
- `POST /auth/refresh` (optional later)
- Notes, Finance, GitHub, Email tools

**Next allowed work:** AI Orchestrator is specified in `plan.md` and is **not implemented**. Do not start it until the user asks. Other next work: none until specified.

---

## 5. File map

```
PersonalAi/
  agent.md                          ← this workflow (update every change)
  plan.md                           ← AI Orchestrator spec (not implemented)
  .cursor/rules/rytham-workflow.mdc ← always-apply: read this file first
  .cursor/mcp.json                  ← local Cursor MCP launch; secrets must not be copied here or into this file
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
    config.ts                       ← MONGODB_URI, PORT, TIMEZONE, Google OAuth, JWT
    db.ts                           ← mongoose.connect + syncIndexes (activities + users)
    errors.ts                       ← HttpError
    model/
      index.ts
      constants.ts
      activity.types.ts
      activity.schema.ts
      user.types.ts
      user.schema.ts
    auth/
      google.ts                     ← Google authorization URL + code exchange
      jwt.ts                        ← JWT sign & verify (payload: sub, email, name)
      middleware.ts                 ← Bearer auth → req.user
      http.ts                       ← /auth/google, /auth/google/callback, /auth/logout, /auth/me
    calendar/
      contract.ts                   ← tool names, I/O types, parsers
      service.ts                    ← CalendarService
      http.ts                       ← REST → service
      time.ts                        subterranean day/week/month bounds, overlap, gaps
    mcp/
      manifest.ts                   ← ToolManifest, Tool, UserContext & response envelopes
      errors.ts                     ← ERROR_CODES & McpError handling
      context.ts                    ← UserContext from JWT `sub` or explicit userId
      auth.ts                       ← Permission check helper
      registry.ts                   ← ToolRegistry singleton & tool discovery
      transport.ts                  ← MCP tool execution handler
      server.ts                     ← McpServer facade & StdioServerTransport inspector runner
      modules/
        calendar.ts                 ← 8 V1 Calendar tools registration
    tests/
      helpers/
        db.ts                       ← MongoMemoryServer & DB cleanup helper
        seed.ts                     ← Test Google profile, test user, user_test_001 + 5 activities
        app.ts                      ← Supertest express app helper
        auth.ts                     ← Valid / expired / invalid JWT helpers
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
      auth.test.ts                  ← Authentication routes tests
      protected.test.ts             ← Auth middleware protection tests
```

Do not add files under `backend/model/` unless the user asks. Do not add `activity_instances`, `memories`, or `notifications` schemas.

---

## 6. Ownership (one source each)

| Concern | Owner | Mirrors |
| --- | --- | --- |
| Enum strings / numbers | `constants.ts` | schema `enum`, this file section 8 |
| Defaults | `constants.ts` | schema `default`, this file section 8 |
| Indexes | `INDEXES` in `constants.ts` | `ActivitySchema.index` loop, this file section 9 |
| Field names and nullability | `activity.types.ts` `Activity` | Mongoose paths, this file section 7 |
| User fields | `user.types.ts` `User` | `user.schema.ts`, this file section 7b |
| Persistence | `activity.schema.ts`, `user.schema.ts` | types + constants |
| Public model imports | `model/index.ts` | callers import from here |
| Auth REST | `auth/http.ts` | this file section 15 |
| JWT | `auth/jwt.ts` | payload `sub`, `email`, `name` |
| MCP execution | `mcp/transport.ts` | `mcp/server.ts`, `mcp/modules/calendar.ts` |
| MCP identity | `mcp/context.ts` | JWT `sub` or explicit `userId`; stdio uses `RYTHAM_JWT` |
| MCP permissions | `mcp/auth.ts` | `mcp/modules/calendar.ts` tool `permissions` |
| Tool names + I/O | `calendar/contract.ts` | this file section 15–16 |
| Tool behavior | `calendar/service.ts` | this file section 16 |
| REST paths | `REST_TO_TOOL` in `contract.ts` | `calendar/http.ts`, this file section 15 |
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
- No `versionKey`.
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

No default for `timezone` (except list/suggest fallback `TIMEZONE`), `flexibility`, `priority`, `title`, `userId`.

---

## 9. Indexes and queries

Indexes (activities, only these):

1. `{ userId: 1, "schedule.startAt": 1 }`
2. `{ userId: 1, status: 1 }`
3. `{ userId: 1, priority: -1 }`

Users: unique index on `googleId` (find-or-create).

Do not add indexes until the user asks.

Implemented query shapes:

- Day / week / month / custom: `userId` + `schedule.startAt` in `[start, end)`
- Week is ISO (Monday 00:00 to next Monday 00:00) in `TIMEZONE`
- Month is calendar month of `date` in `TIMEZONE`
- Custom: `startAt` + `endAt` (ISO or `YYYY-MM-DD`)
- Conflicts / suggest: pending activities with a `startAt`, overlap in memory
- Sort list by `schedule.startAt` ascending

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
- no `startAt` → not occupied

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
- Recurrence rule stored, not expanded
- `fixed` / `moveable` / `floating`
- Priority 1–5
- Reminder offsets
- Calendar tools over REST (Bearer JWT required)
- Conflict detection (read-only)
- Slot suggestion (read-only)
- Google OAuth + backend JWT
- `users` collection
- MCP calendar tools (`userId` from JWT `sub`)

**Deferred. Do not implement.**

- `POST /auth/refresh`
- `activity_instances`
- Notification delivery
- Calendar sharing
- Multi-timezone travel
- Attachments
- Location triggers
- `memories`, `notifications` collections
- `deleteFutureRecurrences`
- Notes, Finance, GitHub, Email tools
- AI Orchestrator (see `plan.md`; do not start until asked)

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

When the user asks for the AI Orchestrator:

1. Follow `plan.md`. Talk to MCP tools only, not REST or MongoDB.
2. Do not change Calendar tool I/O or the activities schema.
3. Update this file.

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

Response: `{ success: true, newEndAt }` (`newEndAt` ISO or null)

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

Compares against `status: "pending"` only.

Response:

```
{ conflicts: [{ activityId, title, priority, flexibility }] }
```

### `calendar.suggest_slot`

```
{ date: "YYYY-MM-DD", durationMin, timezone? }
```

Search window: that local calendar day `[00:00, next 00:00)`.

Places `durationMin` at the **start of the largest free gap**. Tie → earlier gap. Occupied = pending activities that overlap the day.

Response:

```
{ suggestedStart: "HH:mm"|null, suggestedEnd: "HH:mm"|null, reason }
```

If a busy block follows the chosen gap: `Largest free slot before <title>.` Else `Largest free slot.` If none: both times null, `No free slot of <n> minutes.`

---

## 16b. MCP contract

MCP is the AI tool surface. REST is not what the AI calls.

- Facade: `backend/mcp/server.ts` (`createMcpServer`, stdio `runStdioServer`)
- Calendar tools live in `backend/mcp/modules/calendar.ts` and call `CalendarService`
- Execution: `executeToolCall` in `mcp/transport.ts`
- Envelope: `{ success: true, data }` or `{ success: false, error: { code, message } }`
- Tool input must not include `userId` → `VALIDATION_ERROR`
- Unknown tool → `NOT_FOUND`
- Missing permission → `FORBIDDEN`
- Stdio `CallTool` identity: `createUserContext({ jwt: process.env.RYTHAM_JWT })` using `JWT_SECRET`
- Stdio loads dotenv from `path.resolve(__dirname, "../.env")` (`backend/.env`), not `process.cwd()`
- Missing or invalid stdio identity → `McpError` `UNAUTHORIZED` (`Invalid or missing userId in context`); `CallTool` returns that envelope
- Cursor MCP `mcp_auth` is not Rytham identity. `userId` is never taken from Cursor session context or tool input
- Tests and in-process calls may pass `UserContext` or `{ jwt }` / `{ userId }`

Default V1 permissions: `calendar:read`, `calendar:write`, `calendar:delete`.

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

### Test Coverage Matrix (`20` Suites / `86` Tests)
- `auth.test.ts`: Login success (JWT issued), invalid callback 401, missing JWT 401, expired JWT 401, invalid JWT 401, `/auth/me` profile, Google redirect, logout.
- `protected.test.ts`: Every Calendar endpoint — valid JWT success, missing JWT 401, invalid JWT 401.
- `create.test.ts`: Valid event creation, duration parsing, missing title rejection, invalid date validation, negative duration rejection, duplicate submission idempotency.
- `read.test.ts`: Day, week, month views, empty day handling, invalid date format validation.
- `update.test.ts`: Partial field updates while preserving unedited fields, empty payload rejection.
- `delete.test.ts`: Deleting existing & non-existent activities (404).
- `complete.test.ts`: Completing pending activities, idempotent status handling.
- `reschedule.test.ts`: Rescheduling moveable activities, rejecting fixed activities (400 Bad Request), midnight date transitions.
- `conflicts.test.ts`: Conflict detection in range, boundary touching, full containment, partial overlaps.
- `suggest-slot.test.ts`: Largest free slot calculation and impossible duration handling.
- `recurrence.test.ts`: Daily, weekly (ISO weekday array), monthly, and yearly recurrence rules.
- `reminders.test.ts`: Single, multiple, zero, and negative reminder offsets.
- `priority.test.ts`: Priority range validation (1–5 accepted; 0, 6, negative rejected).
- `timezone.test.ts`: Preservation of `Asia/Kolkata` timezone and UTC ISO conversion accuracy.
- `status.test.ts`: Status lifecycle transitions (`pending` -> `done`, `cancelled`, `missed`).
- `integrity.test.ts`: Timestamp preservation (`createdAt`), `updatedAt` updates, `userId` immutability.
- `concurrency.test.ts`: Concurrent creations, updates, and delete-during-update.
- `security.test.ts`: Invalid hex ID rejection, malformed JSON handling, unknown fields rejection, multi-tenant user isolation.
- `performance.test.ts`: Smoke performance verification with 1,000 seeded activities.
- `mcp.test.ts`: MCP tool discovery, execution with JWT `userId`, permissions, and security.


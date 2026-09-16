# Karen Module (Rytham V1) — Plan B

**Status:** Persistence collections built. MCP modules exist in `backend/`. Orchestrator (Karen Core) is built.

**Version:** V1.0

**Priority:** every requirement in this file is highest priority. Do not rank, defer, or drop any point listed here.

**Rule:** this file is the authoritative specification for Karen Module and Calendar Intelligence. Approved decisions are complete here. Implementing agents follow `agent.md` Multi-Agent Completion Contract: infer missing implementation details consistently from existing architecture and document them in the same task.

Implemented contracts for built code live in `agent.md`. The AI Orchestrator specification lives in `plan.md`. Persistence collections `scheduling_preferences`, `memories`, and `conversation_states` are built. MCP modules exist under `backend/modules/` adhering to the locked modular contract (`tools.ts`, `prompts.ts`, `types.ts`, `index.ts`) registered via `backend/registry/modules.ts`. Tool I/O, ownership, sequences, and permissions remain defined in this file.


**Build order:** MCP tools first. The existing 8 `calendar.*` tools remain unchanged. Build the 19 new tools in section 6 when the user asks for implementation.

---

## 1. Objective

Build a persistent AI companion for Rytham with a calm, polite, caring personality that learns about the user over time and uses those learnings to provide better conversations and scheduling without requiring repeated instructions.

Calendar Intelligence (Held Module) gives the AI Orchestrator proactive scheduling decisions. Karen gives long-term personality, memory, and conversation continuity. Both are MCP tool modules. Neither changes the public I/O of the existing 8 `calendar.*` tools.

---

## 2. Current project (extracted; do not change unless the user asks)

Taken from `agent.md` Current state and `plan.md` Locked (built). This is the stage the Karen plan sits on.

### 2.1 Product identity

| Item | Value |
| --- | --- |
| Product | Rytham |
| Version | V1.0 |
| Module (built) | Calendar / activities + Auth + MCP |
| Role | AI-first personal assistant |
| Persistence | MongoDB via Mongoose |
| HTTP | Express |
| Auth | Google OAuth → backend JWT (`jsonwebtoken`) |
| Language | TypeScript |
| Package | `backend/` (`rytham-backend`) |
| Database name | `rytham` |
| Default timezone | `Asia/Kolkata` (`TIMEZONE` env) |
| API port | `3000` (`PORT` env) |

Path the product already uses: **Intent → Tool → Backend**. REST is transport. MCP is the AI tool surface. AI (product) never thinks in HTTP.

### 2.2 Locked (built)

| Layer | Status |
| --- | --- |
| Activities schema | Frozen. Collection `activities`. |
| Users + Google OAuth + backend JWT | Locked. Collection `users`. No passwords. No Google tokens on `User`. |
| Calendar tools | Locked. Same I/O over REST and MCP. `userId` is JWT `sub`, never tool input. |
| REST | Express on `PORT` (default `3000`). Calendar routes require `Authorization: Bearer <JWT>`. |
| MCP | `backend/mcp/`. Calls `CalendarService`. Stdio identity is `RYTHAM_JWT`. HTTP Streamable `/mcp` uses `Authorization: Bearer <JWT>` per request. |
| Tests | `npm test` in `backend/`. Suites and counts live in `agent.md` section 18. |

Milestone tag: `v1-backend-platform`. Auth is locked. Activities schema is frozen.

### 2.3 Calendar MCP tools (existing; public contract frozen)

Tool names and I/O are owned by `backend/calendar/contract.ts` (`agent.md` sections 15–16). Do not change these 8 tools' public I/O without a version bump.

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

Default V1 MCP permissions: `calendar:read`, `calendar:write`, `calendar:delete`.

The API does not auto-reschedule. It returns conflict data. The AI decides what to say and which tool to call next.

Product planner rules (AI layer, not coded as auto-reschedule):

1. `fixed` never moves automatically.
2. `moveable` may shift on conflict.
3. `floating` fills gaps.
4. Higher `priority` wins.

`suggest_slot` places `durationMin` at the start of the largest free gap. Occupied = pending activities (including expanded recurring instances) that overlap the day, plus unscheduled pending floating tasks packed into gaps.

Activity `status` values: `pending`, `done`, `missed`, `cancelled`.

### 2.4 AI Orchestrator (specified in `plan.md`; built)

When the orchestrator is built: it talks **only to MCP**. It never talks to MongoDB or REST. It uses the backend JWT (via MCP context), never a Google access token.

Orchestrator responsibilities (`plan.md`):

- Understand user intent.
- Maintain conversation context.
- Decide when to ask clarifying questions.
- Select the correct MCP tool(s).
- Chain multiple tools automatically.
- Validate tool results.
- Generate natural responses.
- Never expose implementation details.

Orchestrator request pipeline (`plan.md`):

1. User utterance (text or voice transcript)
2. Intent classification
3. Entity extraction
4. Clarify if execution would be unsafe
5. Temporary execution plan
6. MCP tool calls (existing 8 `calendar.*`; planned Calendar Intelligence and Karen tools in this file)
7. Validate results
8. Natural-language response

Orchestrator context layers (`plan.md`):

| Layer | Lifetime |
| --- | --- |
| Request | Current message |
| Conversation | Current chat |
| Session | App session |
| Memory | Long-term (Memory MCP; `memories` collection is built) |

Orchestrator memory routing (`plan.md`):

Personal knowledge uses Memory MCP (`memory.*`). Scheduling configuration uses `calendar.preferences.*` (section 6.4). Collections in section 19 are built (`agent.md` sections 7c–7e).

### 2.5 Not built (from `plan.md`)

- Notifications
- UI
- `POST /auth/refresh`
- Notes, Finance, GitHub, Email tools
- `activity_instances` (recurrence expansion is in-memory inside query windows; no extra documents)
- Notification delivery
- Calendar sharing
- Multi-timezone travel
- Attachments
- Location triggers
- `deleteFutureRecurrences`

`agent.md` file map rule: Do not add `activity_instances` or `notifications` schemas unless the user asks. `scheduling_preferences`, `memories`, and `conversation_states` are built.

---

## 3. Module placement (with AI Orchestrator)

Two MCP modules sit with the AI Orchestrator specified in `plan.md`. The orchestrator is built (`backend/orchestrator/`, `POST /chat`). Persistence for Karen and Calendar Intelligence is built. MCP tools for those modules exist in `backend/`.

The orchestrator talks only to MCP. It may call:

- Existing Calendar MCP (the 8 locked `calendar.*` tools in section 2.3)
- Calendar Intelligence MCP (the 8 new tools in section 6.0)
- Karen Memory MCP, Reflection MCP, and Conversation MCP (sections 6.1–6.3)

Do not invent a second calendar stack. Do not duplicate `CalendarService`. Do not change the public I/O of the existing 8 `calendar.*` tools.

Karen Module acts as a personality and memory layer. Calendar Intelligence is AI-only scheduling intelligence that reuses the existing 8 `calendar.*` tools and adds the 8 new tools in section 6.0.

Flow:

User → Karen Personality → Memory MCP / Conversation MCP / Reflection MCP → Calendar Intelligence MCP → existing Calendar MCP → Response

The orchestrator long-term Memory layer in `plan.md` is Karen Memory MCP (`memory.*` tools in section 6.1).

---

## 4. Core Principles

All highest priority.

* Kind, respectful, and conversational.
* Learn from long-term user habits.
* Remember only useful information.
* Use memories only when relevant.
* Never invent memories.
* Allow users to update or delete any memory.

Personality: calm, polite, caring.

---

## 5. Architecture

Karen Module acts as a personality and memory layer. Calendar Intelligence acts as proactive scheduling intelligence. Both sit above the existing Calendar MCP tools.

Layers named by this requirement:

| Layer | Role |
| --- | --- |
| Karen Personality | Persistent AI companion personality: calm, polite, caring; kind, respectful, conversational |
| Memory MCP | Personal knowledge (not scheduling configuration); search, update, delete, list |
| Reflection MCP | Daily, weekly, and monthly summaries |
| Conversation MCP | Temporary conversation context until it expires |
| Calendar Intelligence MCP | Operational scheduling configuration and intelligence; reuses existing `calendar.*` |
| Calendar MCP | Existing locked 8 `calendar.*` tools |
| Response | Natural conversation and scheduling help without requiring repeated instructions |

Do not invent additional layers.

---

## 6. MCP Tools

All highest priority. Tool names, purposes, I/O, sequences, persistence, and permissions below are the contract for this module. Parsers reject extra keys. `userId` is never in tool input.

Total new planned MCP tools: **19** (Calendar Intelligence 8 + Memory 5 + Reflection 3 + Conversation 3).

The existing 8 `calendar.*` tools in section 2.3 are not in that count and are not changed.

### 6.0 Calendar Intelligence (Held Module)

Purpose: Reuse the existing `calendar.*` tools and add AI-only intelligence without changing their public contract.

| Tool | Purpose |
| --- | --- |
| `calendar.preferences.save` | Save scheduling preferences (sleep, learning window, quiet hours, commute, workload limits, focus duration, planning preferences such as exam revision) |
| `calendar.preferences.get` | Retrieve active scheduling preferences |
| `calendar.preferences.update` | Modify an existing scheduling preference |
| `calendar.preferences.delete` | Remove a scheduling preference |
| `calendar.capacity.check` | Check if today's workload exceeds the user's preferred limit |
| `calendar.missed.review` | Find missed activities and prepare recovery suggestions |
| `calendar.split_task` | Split a long task into multiple sessions using existing calendar availability |
| `calendar.preview` | Generate a "Tomorrow looks like..." preview before scheduling |

Existing Calendar tools this module will reuse (no changes to their public I/O):

* `calendar.create`
* `calendar.update`
* `calendar.list`
* `calendar.reschedule`
* `calendar.conflicts`
* `calendar.suggest_slot`

`calendar.delete` and `calendar.complete` remain available as existing Calendar MCP. They are not in the reuse list above.

### 6.1 Memory

| Tool | Purpose |
| --- | --- |
| `memory.save` | Save long-term personal knowledge (habits, goals, and facts that do not configure scheduling) |
| `memory.search` | Retrieve relevant memories during conversations |
| `memory.update` | Update an existing memory instead of duplicating it |
| `memory.delete` | Remove a memory |
| `memory.list` | Show everything Karen currently remembers |

Users must be able to update or delete any memory (`memory.update`, `memory.delete`). `memory.list` shows what Karen remembers.

### 6.2 Reflection

| Tool | Purpose |
| --- | --- |
| `reflection.daily` | Generate a daily summary |
| `reflection.weekly` | Generate weekly insights |
| `reflection.monthly` | Generate monthly progress and trends |

### 6.3 Conversation

| Tool | Purpose |
| --- | --- |
| `conversation.state` | Store temporary conversation context until it expires |
| `conversation.context` | Retrieve the current conversation mission/context |
| `conversation.clear` | Clear the temporary conversation state |

Conversation state lifetime: end of conversation (section 8).

### 6.4 Ownership and source of truth

Split by ownership, not by data type. Each piece of user data has exactly one owner. The user never chooses which tool. The orchestrator selects the owner.

Rule: If removing the information would change how the calendar schedules time, it belongs to `calendar.preferences.*`. If it only enriches Karen's conversational understanding, it belongs to `memory.*`.

| User statement | Owner |
| --- | --- |
| "I sleep 10 PM–5 AM." | `calendar.preferences.save` |
| "I'm best at learning 6–7 AM." | `calendar.preferences.save` |
| "No work after 9 PM." | `calendar.preferences.save` |
| "Office takes 30 minutes." | `calendar.preferences.save` |
| "Maximum 3 important tasks a day." | `calendar.preferences.save` |
| "My focus sessions are 45 minutes." | `calendar.preferences.save` |
| "I usually revise before exams." | `calendar.preferences.save` (planning preference) |
| "I like vintage gifts." | `memory.save` |
| "My friend likes coffee." | `memory.save` |
| "I'm building Rytham." | `memory.save` |

`calendar.preferences.*` is operational configuration for the scheduling engine. `memory.*` is conversational knowledge Karen uses across all future modules. This prevents duplicate sources of truth.

Planning preference type: treat "I usually revise before exams" as an **Exam Planning Preference** (`type: "exam_planning"`). It is not a memory.

Orchestrator sequence when an exam is approaching:

1. `calendar.list` (`range: "month"`, `date` = current month) → find pending activities whose `title` or `category` contains `exam` (case-insensitive) or whose `tags` include `exam`.
2. `calendar.preferences.get` → `exam_planning` preference.
3. For each exam with `schedule.startAt` within the next 14 days: `calendar.split_task` with `{ activityId, sessionDurationMin: focus_duration from preferences or 45, daysBeforeExam: 7 }` OR, if no split target exists yet, `calendar.suggest_slot` per day in the 7 days before the exam.
4. Present revision blocks in the natural response. Call `calendar.create` only after the user confirms.
5. Do not call `memory.save`. Do not store a duplicate copy.

Karen may read calendar preferences when generating natural responses. It never stores another copy.

Example: "I sleep from 10 PM to 5 AM."

- Orchestrator detects a scheduling preference.
- Calls `calendar.preferences.save`.
- Does not call `memory.save`.

Example: "I usually prefer vintage gifts."

- Calls `memory.save`.
- Does not call `calendar.preferences.save`.

Example: "When can I study Airflow?"

1. `calendar.preferences.get` → learning window (6–7 AM)
2. `calendar.suggest_slot`
3. Natural response

The learning window exists in one place only.

| Module | Source of Truth |
| --- | --- |
| Calendar Preferences | `calendar.preferences.*` |
| Personal Knowledge | `memory.*` |
| Calendar Activities | Existing `calendar.*` |
| Reflections | `reflection.*` |
| Conversation Context | `conversation.*` |

---

## 7. Memory Categories

All highest priority. These are personal knowledge. Scheduling configuration is not a memory category (section 6.4).

* Preferences (non-scheduling)
* Habits (non-scheduling; exam revision is a planning preference, not a habit memory)
* Goals (non-scheduling)
* Relationships
* Health routines (non-scheduling)
* Temporary preferences

---

## 8. Memory Lifetime

All highest priority.

Calendar preference lifetimes (owned by `calendar.preferences.*`, not `memory.*`):

| Type | Lifetime |
| --- | --- |
| Sleep schedule | Forever |
| Learning window | Forever |
| Quiet hours | Forever |
| Commute time | Forever |
| Exam planning preference | Forever |
| Daily workload limit | Forever |
| Focus duration | Forever |

Memory and conversation lifetimes:

| Type | Lifetime |
| --- | --- |
| Temporary plans | Until `expiresAt` (ISO 8601 date) |
| Conversation state | End of conversation |

Temporary plan `expiresAt` is required on `memory.save` when `category` is `temporary_preference`.

---

## 9. Automatic Learning Rules

All highest priority.

Karen should automatically save information when users express stable habits. The orchestrator chooses the owner (section 6.4). The user never chooses which tool.

| User says | Information | Tool |
| --- | --- | --- |
| "I sleep at 10 PM every day." / "I sleep 10 PM–5 AM." | Sleep window | `calendar.preferences.save` |
| "I'm best at learning between 6–7 AM." | Learning window | `calendar.preferences.save` |
| "I don't like calls after dinner." / "No work after 9 PM." | Quiet hours | `calendar.preferences.save` |
| "Office takes 30 minutes." | Commute time | `calendar.preferences.save` |
| "Maximum 3 important tasks a day." | Daily workload limit | `calendar.preferences.save` |
| "My focus sessions are 45 minutes." | Focus duration | `calendar.preferences.save` |
| "I usually revise before exams." | Exam planning preference | `calendar.preferences.save` |
| "I like vintage gifts." | Gift preference | `memory.save` |
| "My friend likes coffee." | Relationship fact | `memory.save` |
| "I'm building Rytham." | Personal goal | `memory.save` |

Do not save temporary emotions unless explicitly requested.
Do not store a second copy in the other module.

Do not create memories automatically without confidence rules (section 10 and section 13).

---

## 10. Memory Confidence

All highest priority.

Each memory stores a confidence score.

* Explicit statement → High confidence
* Repeated behavior → Increase confidence
* Contradictions → Reduce confidence and update when appropriate

Confidence is a number from `0` to `1` inclusive.

| Event | Score change |
| --- | --- |
| Explicit user statement | Set to `0.9` |
| Repeated consistent behavior | Increase by `0.05`, cap at `1` |
| Contradiction | Decrease by `0.2`, floor at `0`; update or delete when below `0.3` |

---

## 11. Calendar Intelligence Integration (Held Module)

All highest priority.

Karen should reuse the existing Calendar MCP and the Calendar Intelligence tools in section 6.0 to provide:

* Protected sleep hours
* Preferred learning windows
* Quiet hours
* Commute buffers
* Daily workload limits
* Missed task recovery
* Smart slot suggestions
* Exam revision blocks before upcoming exams (Exam Planning Preference in section 6.4)

Existing 8 `calendar.*` public I/O does not change.

Existing calendar facts that apply (from `agent.md`, not new invention):

* `calendar.suggest_slot` is the existing smart slot suggestion tool.
* `calendar.conflicts` is read-only conflict detection.
* The API does not auto-reschedule. The AI decides the next tool call.
* Activity status includes `missed`.
* Flexibility: `fixed` never moves automatically; `moveable` may shift on conflict; `floating` fills gaps; higher `priority` wins.

Orchestrator tool sequences for Held Module capabilities:

**Protected sleep hours**

1. `calendar.preferences.get` → `sleep_window`
2. `calendar.list` (`range: "day"`, target date)
3. `calendar.conflicts` over the sleep window interval
4. Natural response listing conflicts; offer to move `moveable` items via `calendar.reschedule` if the user confirms

**Preferred learning windows**

1. `calendar.preferences.get` → `learning_window`
2. `calendar.suggest_slot` (`date`, `durationMin` from request or focus duration)
3. Natural response with suggested slot

**Quiet hours**

1. `calendar.preferences.get` → `quiet_hours`
2. `calendar.conflicts` over quiet-hour interval for proposed activity
3. If conflict: explain and offer alternate slot via `calendar.suggest_slot`

**Commute buffers**

1. `calendar.preferences.get` → `commute` (`durationMin`)
2. Before `calendar.create` or `calendar.reschedule`, check `calendar.conflicts` for `[startAt - commute, startAt)` and `[endAt, endAt + commute)`
3. Add buffer time in the plan; create or reschedule only after user confirms

**Daily workload limits**

1. `calendar.capacity.check` (`date`)
2. If `exceedsLimit: true`, natural response with `count` and `limit`; offer to defer lowest-priority `moveable` items

**Missed task recovery**

1. `calendar.missed.review` (`date?`)
2. For each suggestion: `calendar.suggest_slot` then offer `calendar.reschedule` or `calendar.create` after user confirms

**Smart slot suggestions**

1. `calendar.preferences.get` (learning window, quiet hours, sleep window)
2. `calendar.suggest_slot`
3. Reject slots overlapping quiet hours or sleep window in the orchestrator before presenting

**Exam revision blocks**

Section 6.4 exam-planning sequence.

---

## 12. Example Behavior

All highest priority. This is required behavior.

User: "I'm usually free for learning from 6–7 AM."

Orchestrator calls `calendar.preferences.save`. It does not call `memory.save`.

Months later:

User: "Help me learn Airflow." / "When can I study Airflow?"

1. `calendar.preferences.get` → learning window (6–7 AM)
2. `calendar.suggest_slot`
3. Natural response: "You usually prefer learning between 6:00 and 7:00 AM. That slot is free tomorrow—would you like me to schedule it?"

The learning window exists in one place only (`calendar.preferences.*`). Karen may read it for the response. It never stores another copy. Memories are used only when relevant. Memories are not invented.

User: "I usually revise before exams."

Orchestrator calls `calendar.preferences.save` with `type: "exam_planning"`. It does not call `memory.save`.

Weeks later, user has "Math exam" on the calendar:

1. `calendar.list` → exam activity
2. `calendar.preferences.get` → `exam_planning`
3. `calendar.suggest_slot` for each revision day in the 7 days before the exam
4. Natural response: "Your math exam is Friday. Want me to block revision sessions starting Monday?"

---

## 13. Non-Goals (V1)

All highest priority as exclusions. Do not build these.

* Fake emotions or consciousness
* Human-like attachment
* Background surveillance
* Automatic memory creation without confidence rules

Also from current project scope (do not start unless the user asks): notifications, UI, `POST /auth/refresh`, Notes, Finance, GitHub, Email tools.

---

## 14. Orchestrator rules that remain in force

Taken from `plan.md`. Not rewritten.

- The orchestrator never chooses APIs. It chooses MCP tools.
- The user never chooses which tool.
- `calendar.preferences.*` owns scheduling configuration. `memory.*` owns personal knowledge. Do not store a second copy.
- Do not expose tool names in user-facing responses.
- Never fabricate successful execution.
- Ask clarifying questions only when execution would be unsafe.
- Fail: validation → explain missing information; tool error → retry once; conflict → offer a solution; permission → explain the limitation.
- Voice UI is not built. Streaming behavior in `plan.md` applies when voice mode is active.

---

## 15. Constraints from the current codebase

All highest priority for implementation of this plan.

- Do only what the user asked and what `agent.md` already allows.
- Keep types, schema, constants, tool contract, and `agent.md` identical unless the user asks to change them.
- The existing 8 `calendar.*` tool I/O cannot change without a version bump.
- MCP `userId` comes from the backend JWT, never from tool input and never from Google tokens.
- Reuse `CalendarService`. Do not duplicate calendar logic.
- Do not add `activity_instances` or `notifications` schemas unless the user asks. `scheduling_preferences`, `memories`, and `conversation_states` are built (`agent.md` sections 7c–7e).
- `metadata` on activities is reserved for later modules. Do not read it in scheduling logic.
- The AI Orchestrator is built: follow `plan.md`. Talk to MCP tools only, not REST or MongoDB. Do not change the existing 8 `calendar.*` tool I/O or the activities schema.
- First implementation, when asked, is driven by MCP tools: the 19 new tools in section 6.
- Ownership (section 6.4): `calendar.preferences.*` owns scheduling configuration; `memory.*` owns personal knowledge. Do not store a second copy.
- Tool I/O, persistence, permissions, and layout: sections 18–20.

---

## 16. Escalation (product decisions only)

Stop and ask the user only when:

- Multiple valid product behaviors would change scheduling or memory outcomes.
- Security or privacy behavior changes.
- Public I/O of the existing 8 `calendar.*` tools would change.
- The user explicitly requests a design decision.

Model/provider choice and personality system prompt text are implementation choices left to the building agent within Karen's defined personality (calm, polite, caring).

---

## 17. Implementation status

Persistence collections `scheduling_preferences`, `memories`, and `conversation_states` are built. Calendar Intelligence, Memory, Reflection, and Conversation MCP tools exist in `backend/`. The AI Orchestrator is built (`backend/orchestrator/`, `POST /chat`).

The existing 8 `calendar.*` tools stay unchanged.

---

## 18. Tool input / output

MCP envelope matches `agent.md` section 16b: `{ success: true, data }` or `{ success: false, error: { code, message } }`. Parsers reject extra keys.

### Preference types (`calendar.preferences.*`)

Closed `type` values:

| `type` | Meaning |
| --- | --- |
| `sleep_window` | Bedtime to wake time |
| `learning_window` | Preferred study time |
| `quiet_hours` | No meetings/calls |
| `commute` | Travel buffer |
| `workload_limit` | Max important tasks per day |
| `focus_duration` | Default session length in minutes |
| `exam_planning` | Revise before exams |

### `calendar.preferences.save`

```
{ type, value, timezone? }
```

`timezone` optional; default env `TIMEZONE`.

`value` by type:

| `type` | `value` shape |
| --- | --- |
| `sleep_window` | `{ start: "HH:mm", end: "HH:mm" }` |
| `learning_window` | `{ start: "HH:mm", end: "HH:mm" }` |
| `quiet_hours` | `{ start: "HH:mm", end: "HH:mm" }` |
| `commute` | `{ durationMin: number }` |
| `workload_limit` | `{ maxImportant: number }` (`priority >= 4` counts as important) |
| `focus_duration` | `{ durationMin: number }` |
| `exam_planning` | `{ enabled: true, daysBeforeExam: 7 }` |

Response: `{ success: true, preferenceId, message }`

### `calendar.preferences.get`

```
{ types?: type[] }
```

Omit `types` to return all active preferences.

Response: `{ preferences: [{ preferenceId, type, value, timezone, updatedAt }] }`

### `calendar.preferences.update`

```
{ preferenceId, value }
```

Response: `{ success: true, preferenceId, message }`

### `calendar.preferences.delete`

```
{ preferenceId }
```

Response: `{ success: true }`

### `calendar.capacity.check`

```
{ date: "YYYY-MM-DD", timezone? }
```

Response: `{ exceedsLimit: boolean, count: number, limit: number | null, date }`

### `calendar.missed.review`

```
{ date?: "YYYY-MM-DD", timezone? }
```

Default `date` = today. Finds `status: "missed"` pending recovery candidates.

Response: `{ missed: [{ activityId, title, priority, flexibility }], suggestions: [{ activityId, suggestedDate, reason }] }`

### `calendar.split_task`

```
{ activityId, sessionDurationMin, daysBeforeExam? }
```

Uses `calendar.list` + `calendar.suggest_slot` internally. Does not create activities until the orchestrator calls `calendar.create` after user confirmation.

Response: `{ sessions: [{ date, suggestedStart, suggestedEnd, durationMin }] }`

### `calendar.preview`

```
{ date: "YYYY-MM-DD", timezone? }
```

Response: `{ summary: string, activities: CalendarActivityView[], workload: { count, limit } }`

### `memory.save`

```
{ category, content, confidence?, expiresAt? }
```

`category`: `preference` | `habit` | `goal` | `relationship` | `health` | `temporary_preference`

`expiresAt` required when `category` is `temporary_preference` (ISO 8601 date).

Response: `{ success: true, memoryId, message }`

### `memory.search`

```
{ query, limit? }
```

Default `limit`: `5`. Semantic or keyword match on `content`.

Response: `{ memories: [{ memoryId, category, content, confidence, updatedAt }] }`

### `memory.update`

```
{ memoryId, content?, confidence? }
```

Response: `{ success: true, memoryId, message }`

### `memory.delete`

```
{ memoryId }
```

Response: `{ success: true }`

### `memory.list`

```
{ category? }
```

Response: `{ memories: [{ memoryId, category, content, confidence, expiresAt, updatedAt }] }`

### `reflection.daily`

```
{ date?: "YYYY-MM-DD", timezone? }
```

Response: `{ summary: string, completed: number, missed: number, upcoming: number }`

### `reflection.weekly`

```
{ date?: "YYYY-MM-DD", timezone? }
```

Response: `{ summary: string, insights: string[] }`

### `reflection.monthly`

```
{ date?: "YYYY-MM-DD", timezone? }
```

Response: `{ summary: string, trends: string[] }`

### `conversation.state`

```
{ mission?, context?, entities? }
```

`entities` is a JSON object for resolved references ("it", "that meeting").

Response: `{ success: true }`

### `conversation.context`

```
{}
```

Response: `{ mission, context, entities, updatedAt }`

### `conversation.clear`

```
{}
```

Response: `{ success: true }`

---

## 19. Persistence and layout

Collections (built; contracts in `agent.md` sections 7c–7e):

**`scheduling_preferences`** (Calendar Intelligence)

```
SchedulingPreference {
  _id: ObjectId
  userId: ObjectId
  type: sleep_window | learning_window | quiet_hours | commute | workload_limit | focus_duration | exam_planning
  value: object
  timezone: string
  createdAt: Date
  updatedAt: Date
}
```

Unique index: `{ userId: 1, type: 1 }`.

**`memories`** (Karen Memory)

```
Memory {
  _id: ObjectId
  userId: ObjectId
  category: preference | habit | goal | relationship | health | temporary_preference
  content: string
  confidence: number
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}
```

Index: `{ userId: 1, category: 1 }`.

**`conversation_states`** (Conversation MCP; one document per user)

```
ConversationState {
  _id: ObjectId
  userId: ObjectId
  mission: string
  context: string
  entities: object
  updatedAt: Date
}
```

Reflection tools are computed from `calendar.list` and `memory.list`; no reflection collection.

File layout (mirror existing calendar + MCP pattern):

```
backend/
  calendar-intelligence/
    contract.ts
    service.ts
  karen/
    memory/
      contract.ts
      service.ts
    reflection/
      service.ts
    conversation/
      contract.ts
      service.ts
  mcp/modules/
    calendar-intelligence.ts
    memory.ts
    reflection.ts
    conversation.ts
```

No REST routes in V1 for these modules. MCP only.

---

## 20. MCP permissions

Default permissions extend V1 calendar permissions:

| Permission | Tools |
| --- | --- |
| `calendar:preferences:read` | `calendar.preferences.get`, `calendar.capacity.check`, `calendar.missed.review`, `calendar.preview` |
| `calendar:preferences:write` | `calendar.preferences.save`, `calendar.preferences.update`, `calendar.split_task` |
| `calendar:preferences:delete` | `calendar.preferences.delete` |
| `memory:read` | `memory.search`, `memory.list` |
| `memory:write` | `memory.save`, `memory.update` |
| `memory:delete` | `memory.delete` |
| `reflection:read` | `reflection.daily`, `reflection.weekly`, `reflection.monthly` |
| `conversation:read` | `conversation.context` |
| `conversation:write` | `conversation.state`, `conversation.clear` |

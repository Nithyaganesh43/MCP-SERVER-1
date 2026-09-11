# Rytham docs

Implemented contracts for built code live in `agent.md`. This file is the **AI Orchestrator specification (V2)**. Orchestrator code is not built yet; behavior is fully specified here.

This file defines how the AI Orchestrator coordinates MCP modules. Storage and tool I/O for Karen and Calendar Intelligence are defined in `plan b.md` sections 18–20.

Karen Module and Calendar Intelligence live in `plan b.md`. Backend code is not built yet. First implementation is MCP tools. The existing 8 `calendar.*` tools stay unchanged.

Ownership of scheduling configuration vs personal knowledge is specified in `plan b.md` section 6.4. This file only describes how the Orchestrator must respect that split. Do not invent a second copy.

---

## Locked (built)

| Layer | Status |
| --- | --- |
| Activities schema | Frozen. Collection `activities`. |
| Users + Google OAuth + backend JWT | Locked. Collection `users`. No passwords. No Google tokens on `User`. |
| Calendar MCP | Built. Same I/O over REST and MCP. `userId` is JWT `sub`, never tool input. The freeze is the existing 8 `calendar.*` tools in `agent.md` sections 15–16. |
| REST | Built. Express on `PORT` (default `3000`). Calendar routes require `Authorization: Bearer <JWT>`. |
| MCP Framework | Built. `backend/mcp/`. Calls `CalendarService`. Stdio identity is `RYTHAM_JWT`. HTTP Streamable `/mcp` uses `Authorization: Bearer <JWT>` per request. |
| Tests | Built. `npm test` in `backend/`. Suites and counts live in `agent.md` section 18. |

Current architecture remains:

**Intent → MCP Tool → Backend**

REST is transport. MCP is the AI tool surface. The Orchestrator never talks directly to MongoDB or REST. It uses the backend JWT (via MCP context), never a Google access token.

Freeze: do not change the existing 8 `calendar.*` tools' public I/O without a version bump. Notes, Finance, GitHub, and Email must attach to the same `userId`.

---

## Specified, backend not built

### Core (orchestrator coordinates these MCP modules)

- AI Orchestrator
- Karen Module (Memory, Reflection, Conversation)
- Calendar Intelligence

### Deferred (out of Orchestrator V1 scope)

- Notifications
- Notes
- Finance
- GitHub
- Email
- UI
- `POST /auth/refresh`
- `activity_instances`
- Notification delivery

The orchestrator talks **only to MCP**. It never talks to MongoDB or REST.

---

# Rytham AI Orchestrator Specification (V2)

**Status: specified. Code not built.**

The Orchestrator coordinates multiple MCP modules. Calendar MCP is built. Karen, Calendar Intelligence, Reflection, and Conversation MCP are specified in `plan b.md` and not built yet.

## Architecture

The Orchestrator becomes the decision engine.

The Orchestrator owns decisions. MCP modules own execution.

## Responsibilities

The Orchestrator must:

- Understand user intent.
- Maintain context across the conversation.
- Decide when clarification is necessary.
- Select one or more MCP tools.
- Chain tool execution.
- Validate tool results.
- Generate natural responses.
- Never expose implementation details.

The Orchestrator never chooses APIs. It chooses MCP tools. The user never chooses which tool.

## MCP Module Awareness

The Orchestrator is designed to coordinate multiple MCP modules. It should automatically choose the appropriate module without exposing tool names.

| Module | Status |
| --- | --- |
| Calendar | Built |
| Calendar Intelligence | Planned |
| Karen Memory | Planned |
| Reflection | Planned |
| Conversation | Planned |

MCP inventory the orchestrator uses (existing 8 `calendar.*` I/O in `agent.md`; new tool I/O in `plan b.md` section 18):

| Module | Tools | Count |
| --- | --- | --- |
| Existing Calendar (built) | `calendar.create`, `calendar.update`, `calendar.delete`, `calendar.list`, `calendar.complete`, `calendar.reschedule`, `calendar.conflicts`, `calendar.suggest_slot` | 8 |
| Calendar Intelligence (planned) | `calendar.preferences.save`, `calendar.preferences.get`, `calendar.preferences.update`, `calendar.preferences.delete`, `calendar.capacity.check`, `calendar.missed.review`, `calendar.split_task`, `calendar.preview` | 8 |
| Karen Memory (planned) | `memory.save`, `memory.search`, `memory.update`, `memory.delete`, `memory.list` | 5 |
| Reflection (planned) | `reflection.daily`, `reflection.weekly`, `reflection.monthly` | 3 |
| Conversation (planned) | `conversation.state`, `conversation.context`, `conversation.clear` | 3 |

Total new MCP tools: 19. Full purposes, ownership, I/O, sequences, persistence, and permissions: `plan b.md`. Existing Calendar tool names and I/O are owned by `backend/calendar/contract.ts` (`agent.md` sections 15–16).

---

## Request Pipeline

Every request follows the same lifecycle.

1. User input
2. Intent classification
3. Entity extraction
4. Context resolution
5. Clarification (only if unsafe)
6. Execution plan
7. MCP tool execution
8. Result validation
9. Natural response

MCP tool execution may use existing Calendar tools and, when those modules exist, Calendar Intelligence and Karen tools listed above.

## Context Model

Four context layers exist.

| Layer | Lifetime |
| --- | --- |
| Request | Current message |
| Conversation | Current chat |
| Session | App session |
| Long-term Memory | Karen Module (Memory MCP; `memories` collection is built). Scheduling configuration is `calendar.preferences.*` / `scheduling_preferences`, not this layer. |

Example:

> "Move it after dinner."

The Orchestrator resolves "it" before calling any tool.

## Intent Classification

Every request has one primary intent.

| Intent | Example |
| --- | --- |
| Create | "Schedule gym." |
| Update | "Move dinner." |
| Delete | "Cancel meeting." |
| Query | "What's today?" |
| Complete | "Finished coding." |
| Planning | "Fit gym tomorrow." |
| Memory | "I'm best at learning at 6." |
| Reflection | "How was my week?" |
| Conversation | "Continue where we left off." |

Only one primary intent executes unless tool chaining is required.

Memory and Planning intents still follow ownership (`plan b.md` section 6.4): a scheduling preference is Calendar Intelligence, not Karen Memory.

## Entity Extraction

Extract structured entities before planning.

Example:

> "Tomorrow project from 8 to 11."

| Entity | Value |
| --- | --- |
| title | Project |
| date | Tomorrow |
| start | 8 PM |
| end | 11 PM |
| timezone | User default |

Missing information is allowed.

## Clarification Rules

Ask only when execution would be unsafe.

| Situation | Action |
| --- | --- |
| Missing time | Ask |
| Multiple matches | Ask |
| Ambiguous date | Ask |
| Stable preference | Learn automatically |
| Clear intent | Execute |

Example:

> "Move meeting."

Response:

> "Dell meeting or project meeting?"

Stable-preference learning still uses the owner split: scheduling configuration → `calendar.preferences.*`; personal knowledge → `memory.*`. Do not save temporary emotions unless explicitly requested.

## Planning Engine

The planner creates a temporary execution plan.

Example:

> "Move gym after dinner."

Plan:

1. Find gym.
2. Find dinner.
3. Check conflicts.
4. Find available slot.
5. Reschedule.
6. Respond.

The execution plan never becomes permanent memory.

## Tool Selection

The Orchestrator chooses MCP modules. Multiple modules may participate in one request.

| User request | Module |
| --- | --- |
| Schedule meeting | Calendar |
| Move activity | Calendar |
| Find free time | Calendar |
| Save sleep habit | Calendar Intelligence (`calendar.preferences.*`) |
| What do you remember? | Karen Memory |
| Daily summary | Reflection |
| Continue previous topic | Conversation |

Built Calendar tool map (existing 8 tools):

| User | Tool |
| --- | --- |
| Schedule | `calendar.create` |
| Move | `calendar.reschedule` |
| Today | `calendar.list` |
| Free time | `calendar.suggest_slot` |
| Done | `calendar.complete` |
| Cancel | `calendar.delete` |
| Overlap | `calendar.conflicts` |

Routing examples:

| User | Tool |
| --- | --- |
| "I sleep from 10 PM to 5 AM." | `calendar.preferences.save` (`type: sleep_window`). Do not call `memory.save`. |
| "I usually revise before exams." | `calendar.preferences.save` (`type: exam_planning`). Do not call `memory.save`. |
| Workload limit | `calendar.capacity.check` |
| Missed recovery | `calendar.missed.review` |
| Split a long task | `calendar.split_task` |
| Tomorrow preview | `calendar.preview` |
| "I like vintage gifts." / "My friend likes coffee." / "I'm building Rytham." | `memory.save`. Do not call `calendar.preferences.save`. |
| Recall personal knowledge | `memory.search` |
| "When can I study Airflow?" | `calendar.preferences.get` then `calendar.suggest_slot`. Do not copy the learning window into `memory.*`. |

## Multi-Module Execution

Example:

> "I'm usually free for learning from 6–7 AM. Schedule Airflow tomorrow."

Execution:

1. Calendar Intelligence stores the learning window (`calendar.preferences.save`). Do not call `memory.save`.
2. Calendar checks tomorrow.
3. Calendar finds the slot.
4. Calendar creates the session.
5. Natural confirmation.

The user experiences one conversation.

Example:

> "Schedule gym tomorrow evening and remind me 15 minutes before."

1. `calendar.create`
2. `calendar.update` (reminders)

Example:

> "When can I study Airflow?"

1. `calendar.preferences.get` → learning window (6–7 AM)
2. `calendar.suggest_slot`
3. Natural response

The learning window exists in one place only. Karen may read calendar preferences for the response. It never stores another copy.

Example: upcoming exam with Exam Planning Preference saved.

1. `calendar.list` (`range: "month"`) → exam activities (`title`, `category`, or `tags` contain `exam`)
2. `calendar.preferences.get` → `exam_planning`
3. `calendar.suggest_slot` for revision days in the 7 days before each exam
4. Natural response offering revision blocks; `calendar.create` only after user confirms
5. Do not call `memory.save`

## Calendar Intelligence Hook

The Orchestrator automatically uses:

- Protected sleep
- Learning windows
- Quiet hours
- Commute buffers
- Daily workload limits
- Missed task recovery
- Smart slot suggestions

No Calendar public contract changes are required. Tool sequences: `plan b.md` section 11.

## Automatic Learning Hook

The Orchestrator automatically recognizes durable information and routes it to the owning module. The user never chooses which tool.

| User says | Tool |
| --- | --- |
| "I sleep at 10 every day." | `calendar.preferences.save` |
| "I'm best at learning before sunrise." | `calendar.preferences.save` |
| "I don't like calls after dinner." | `calendar.preferences.save` |
| "I usually revise before exams." | `calendar.preferences.save` (`exam_planning`) |
| "I like vintage gifts." | `memory.save` |

Temporary emotions should not become long-term memory. Do not store a second copy in the other module.

## Ownership: `calendar.preferences.*` vs `memory.*`

Split by ownership, not by data type. Detailed contract: `plan b.md` section 6.4.

Rule: If removing the information would change how the calendar schedules time, it belongs to `calendar.preferences.*`. Everything else belongs to `memory.*`.

| Information | Owner |
| --- | --- |
| Sleep window | `calendar.preferences.*` |
| Learning window | `calendar.preferences.*` |
| Quiet hours | `calendar.preferences.*` |
| Commute time | `calendar.preferences.*` |
| Daily workload limit | `calendar.preferences.*` |
| Focus duration | `calendar.preferences.*` |
| Exam planning ("revise before exams") | `calendar.preferences.*` |
| Favorite coffee | `memory.*` |
| Relationship facts | `memory.*` |
| Personal goals | `memory.*` |
| Gift preferences | `memory.*` |
| Health facts (non-scheduling) | `memory.*` |

Why this split works:

- `calendar.preferences.*` = operational configuration for the scheduling engine.
- `memory.*` = conversational knowledge Karen uses across all future modules.

This prevents duplicate sources of truth.

### Orchestrator behavior

The user never chooses which tool.

Example:

> "I sleep from 10 PM to 5 AM."

Orchestrator detects a scheduling preference.

- Calls `calendar.preferences.save`.
- Does not call `memory.save`.

Later:

> "I usually prefer vintage gifts."

- Calls `memory.save`.

### Cross-module behavior

Karen can read calendar preferences when generating natural responses, but it never stores another copy.

Example:

> "When can I study Airflow?"

Flow:

1. `calendar.preferences.get` → learning window (6–7 AM).
2. `calendar.suggest_slot`.
3. Natural response.

The learning window exists in one place only.

### Source of Truth Rule

| Module | Source of Truth |
| --- | --- |
| Calendar Preferences | `calendar.preferences.*` |
| Personal Knowledge | `memory.*` |
| Calendar Activities | Existing `calendar.*` |
| Reflections | `reflection.*` |
| Conversation Context | `conversation.*` |

This gives each piece of user data exactly one owner while still allowing the Orchestrator to combine them seamlessly during conversations.

Do not change the existing 8 `calendar.*` tools' public I/O. Tool I/O: `plan b.md` section 18. Persistence collections `scheduling_preferences`, `memories`, and `conversation_states` are built (`agent.md` sections 7c–7e). MCP tools for those modules follow `plan b.md`.

## Conflict Handling

Before creating or moving activities:

1. Check conflicts.
2. Evaluate flexibility.
3. Compare priorities.
4. Decide.

Example: Project 8–11, Dinner 8:30.

AI responds: "I'll keep dinner fixed and continue your project afterward."

The API does not auto-reschedule. The orchestrator decides the next tool call.

Product planner rules (AI layer, not coded as auto-reschedule):

1. `fixed` never moves automatically.
2. `moveable` may shift on conflict.
3. `floating` fills gaps.
4. Higher `priority` wins.

## Response Generation

Responses should be:

- Natural
- Concise
- Caring
- Action-oriented

Never expose MCP tool names.

Example:

Instead of:

> "Called calendar.create."

Say:

> "Done. I've scheduled your project for tomorrow from 8 PM to 11 PM."

## Failure Strategy

| Failure | Behavior |
| --- | --- |
| Validation | Explain missing information |
| Tool error | Retry once |
| Conflict | Offer a solution |
| Permission | Explain limitation |

Never fabricate successful execution.

## Streaming Behavior

Voice mode (deferred UI):

1. Listen continuously.
2. Build partial transcript.
3. Detect intent early.
4. Execute after confidence threshold.
5. Stream confirmation naturally.

Voice UI remains out of scope.

## Completion Criteria

The Orchestrator is considered complete when it can:

- Resolve conversational references.
- Maintain request, conversation, session, and memory context.
- Extract entities accurately.
- Ask clarifying questions only when necessary.
- Chain multiple MCP modules.
- Use Karen Memory naturally.
- Route scheduling configuration to `calendar.preferences.*` and personal knowledge to `memory.*` with no second copy.
- Leverage Calendar Intelligence automatically.
- Handle conflicts using priorities and flexibility.
- Generate caring, natural responses.
- Fail safely without inventing results.

At that point, the React Native app becomes a thin client for voice and text, while the Orchestrator owns reasoning and MCP coordination.

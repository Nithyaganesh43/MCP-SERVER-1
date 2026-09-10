# Rytham docs

Implemented contracts live in `agent.md`. This file is the **AI Orchestrator specification**. The orchestrator is **not implemented**. Do not start it until the user asks.

---

## Locked (built)

| Layer | Status |
| --- | --- |
| Activities schema | Frozen. Collection `activities`. |
| Users + Google OAuth + backend JWT | Locked. Collection `users`. No passwords. No Google tokens on `User`. |
| Calendar tools | Locked. Same I/O over REST and MCP. `userId` is JWT `sub`, never tool input. |
| REST | Express on `PORT` (default `3000`). Calendar routes require `Authorization: Bearer <JWT>`. |
| MCP | `backend/mcp/`. Calls `CalendarService`. Stdio identity is `RYTHAM_JWT`. |
| Tests | `npm test` in `backend/` — 20 suites, 86 tests. |

Path the product already uses: **Intent → Tool → Backend**. REST is transport. MCP is the AI tool surface.

Freeze: do not change Calendar's public contract without a version bump. Notes, Finance, GitHub, and Email must attach to the same `userId`.

---

## Not built

- AI Orchestrator (this spec)
- Recurrence expansion (`activity_instances`)
- Memories, notifications, UI
- `POST /auth/refresh`
- Notes, Finance, GitHub, Email tools

When the orchestrator is built: it talks **only to MCP**. It never talks to MongoDB or REST. It uses the backend JWT (via MCP context), never a Google access token.

---

# Rytham AI Orchestrator Specification (V1)

**Status: specified, not coded.**

Goal: convert natural conversation into reliable multi-tool execution while keeping context, memory hooks, and planning.

## Responsibilities

- Understand user intent.
- Maintain conversation context.
- Decide when to ask clarifying questions.
- Select the correct MCP tool(s).
- Chain multiple tools automatically.
- Validate tool results.
- Generate natural responses.
- Never expose implementation details.

## Request pipeline

Every request follows the same lifecycle:

1. User utterance (text or voice transcript)
2. Intent classification
3. Entity extraction
4. Clarify if execution would be unsafe
5. Temporary execution plan
6. MCP tool calls (`calendar.*` today)
7. Validate results
8. Natural-language response

## Context model

The orchestrator maintains four layers of context.

| Layer | Lifetime |
| --- | --- |
| Request | Current message |
| Conversation | Current chat |
| Session | App session |
| Memory | Long-term (hook only; memories collection is not built) |

Example: "Move it to after dinner." The word "it" resolves from conversation context before any tool is called.

## Intent classification

Every request falls into one primary intent.

| Intent | Example |
| --- | --- |
| Create | "Schedule gym tomorrow." |
| Update | "Move dinner." |
| Delete | "Cancel meeting." |
| Query | "What's today?" |
| Complete | "Finished coding." |
| Planning | "Fit gym tomorrow." |

Only one primary intent should execute unless the planner decides chaining is required.

## Entity extraction

The AI extracts structured entities before planning.

Example: "Tomorrow project from 8 to 11."

| Entity | Value |
| --- | --- |
| title | Project |
| date | Tomorrow |
| start | 8 PM |
| end | 11 PM |
| timezone | User default |

Incomplete information is allowed.

## Clarification rules

Ask only when execution would be unsafe.

| Situation | Action |
| --- | --- |
| Missing time | Ask |
| Multiple matching events | Ask |
| Ambiguous date | Ask |
| Clear intent | Execute |

Example: "Move meeting."

Response: "Dell meeting or project meeting?"

## Planning engine

The planner creates a temporary execution plan.

Example: "Move gym after dinner."

1. Find gym (`calendar.list`).
2. Find dinner (`calendar.list`).
3. Check conflicts (`calendar.conflicts`).
4. Find available slot (`calendar.suggest_slot`).
5. Reschedule (`calendar.reschedule`).
6. Respond.

This plan exists only during execution.

## Tool selection

The orchestrator never chooses APIs. It chooses MCP tools. Tool names and I/O are owned by `backend/calendar/contract.ts` (see `agent.md` sections 15–16).

| User | Tool |
| --- | --- |
| Schedule | `calendar.create` |
| Move | `calendar.reschedule` |
| Today | `calendar.list` |
| Free time | `calendar.suggest_slot` |
| Done | `calendar.complete` |
| Cancel | `calendar.delete` |
| Overlap | `calendar.conflicts` |

## Multi-tool execution

Example: "Schedule gym tomorrow evening and remind me 15 minutes before."

1. `calendar.create`
2. `calendar.update` (reminders)

The user experiences one conversation.

## Conflict handling

Before creating or moving activities:

1. Check conflicts.
2. Evaluate flexibility.
3. Compare priorities.
4. Decide.

Example: Project 8–11, Dinner 8:30.

AI responds: "I'll keep dinner fixed and continue your project afterward."

The API does not auto-reschedule. The orchestrator decides the next tool call.

## Response generation

Responses should be natural, concise, and action-oriented. Do not expose tool names.

Bad: "Called calendar.create."

Good: "Done. Your project is scheduled for tomorrow from 8 PM to 11 PM."

## Failure strategy

| Failure | Behavior |
| --- | --- |
| Validation | Explain missing information |
| Tool error | Retry once |
| Conflict | Offer a solution |
| Permission | Explain the limitation |

Never fabricate successful execution.

## Future memory hook

The orchestrator is designed to plug into memory later.

Example: "I usually study after dinner."

Future behavior: store the preference; use it during planning.

No changes to Calendar or MCP are required for that hook to be designed. Do not add a `memories` collection until the user asks.

## Streaming behavior

When voice mode is active:

1. Listen continuously.
2. Build a partial transcript.
3. Detect intent early.
4. Execute after a confidence threshold.
5. Stream confirmation naturally.

Voice UI is not built.

## Completion criteria

The AI Orchestrator is locked when it can:

- Resolve conversational references.
- Extract scheduling entities.
- Ask clarifying questions only when necessary.
- Chain multiple MCP tools automatically.
- Handle conflicts using priorities and flexibility.
- Produce natural confirmations.
- Fail safely without inventing results.

At that point the React Native app can be a thin client: capture voice/text, display state, stream responses. The orchestrator owns decisions.

# Rytham Project Rules & Multi-Agent Execution Protocol (Mandatory)

This document is the consolidated source of truth for all mandatory repository rules, development contracts, database schemas, multi-agent coordination protocols, and architectural standards for **Rytham Personal AI**. 

Every AI agent working on this repository MUST read this file in full before starting work, obey all rules without exception, and update this file whenever contracts change.

---

# 1. Multi-Agent Coordination Protocol & Parallel Work Rules

## 1.1 Parallel Work Standard
- Multiple AI agents work in parallel on this codebase.
- There is **no file locking or file ownership**.
- Every agent reads all files in `activeagents/active/` before starting work to stay aware of live work.
- Overlapping edits by multiple agents are reconciled after task completion, not used as a reason to stop.

## 1.2 Rule 1 – Register Before Working
Before editing any project file, every agent MUST create an active task tracking file:
```
activeagents/active/<index>_<agent-name>-<feature>.md
```
- **Indexing:** Files are indexed sequentially by creation date: `1_*`, `2_*`, `3_*`, etc.
- **Naming:** Lowercase, hyphenated, no spaces (e.g., `activeagents/active/1_backend-auth.md`).
- **Template:**
  ```markdown
  # Agent: <agent-name>
  Status: ACTIVE
  Started: YYYY-MM-DD HH:MM UTC

  ## Objective
  <Clear summary of assigned task>

  ## Planned Files
  - <file-path-1>
  - <file-path-2>

  ## Files Touched
  (None)

  ## Current Progress
  - Created task file.
  - Beginning implementation.

  ## Incoming Messages
  (None)

  ## Outgoing Messages
  (None)
  ```
- **Constraint:** No code or configuration changes may begin before this file exists in `activeagents/active/`.

## 1.3 Rule 2 – Track Files Touched
- Before and during modification of any project file, list it under **Files Touched** in your active task file.
- Other agents may edit the same files; reconcile overlaps after completion.

## 1.4 Rule 3 – Continuous Progress Updates
- Update the task file after every meaningful milestone (e.g., created schema, added validation, fixed bug, updated tests).
- The task file is the live progress log and source of truth for the agent. Never share one task file across two agents.

## 1.5 Rule 4 – Agent-to-Agent Communication Protocol
- Agents communicate ONLY by appending messages to another agent's active task file.
- **Incoming Message Format:**
  ```markdown
  ## Incoming Messages

  ### From: <sender-agent-name>
  Time: YYYY-MM-DD HH:MM UTC
  Request: <Specific request or query>
  ```
- **Receiving Agent Obligation:**
  1. Read incoming messages during work cycles.
  2. Acknowledge them in its task log.
  3. Respond by adding a note under its own `Outgoing Messages` section.
- **Outgoing Message Format:**
  ```markdown
  ## Outgoing Messages

  ### To: <receiver-agent-name>
  Time: YYYY-MM-DD HH:MM UTC
  Response: <Specific response or data payload>
  ```

## 1.6 Rule 5 – Completion & Archiving Procedure
When assigned work is complete:
1. Update status to `COMPLETED` and record completion timestamp.
2. Add a final summary of completed work.
3. List every modified file.
4. Move the task file from `activeagents/active/` to `activeagents/finished/`.
5. **Conflict Resolution:** If `activeagents/finished/<same-name>.md` already exists, append a timestamp suffix: `<index>_<name>-YYYYMMDD-HHMM.md`.

## 1.7 Rule 6 – Recovery Procedure
- If an agent starts and finds its task file already exists in `activeagents/active/`:
  - Resume that task file.
  - Continue updating the existing history.
  - Never create duplicate active task files for the same task.

---

# 2. Multi-Agent Completion Contract

Every approved decision becomes part of the project specification immediately. Agents must update documentation and implementation artifacts until their assigned task is complete.

1. **Approved = Updated:** Once the user approves a decision, immediately integrate it into all relevant documents and source files.
2. **Complete the Assigned Scope:** Finish the entire requested change end-to-end, including related sections, examples, tool definitions, and cross-references.
3. **No Placeholder Summaries:** Do not respond with "planning only", "not implemented", or "not specified" for work that belongs to the assigned scope.
4. **Resolve Internal Details:** If a small implementation detail is missing within the assigned scope, infer a consistent solution from existing architecture instead of stopping.
5. **Strict Escalation Rule:** Stop and ask the user ONLY when:
   - Multiple valid product behaviors exist.
   - Security or privacy behavior changes.
   - Public API compatibility would change.
   - The user explicitly requests a design decision.
   - Everything else must be resolved and completed within the assigned task.
6. **Strict Plug-and-Play Architecture (The 2–3 File Rule):** Every new service must sit inside `backend/modules/<name>/` with standard contract files (`tools.ts`, `prompts.ts`, `types.ts`, `index.ts`) and register via `backend/registry/modules.ts`. Adding a service must NEVER require editing more than 2–3 existing files.

---

# 3. Mandatory Startup Checklist & Execution Loop

Before performing ANY work on the codebase, every AI agent MUST execute the following startup checklist:

- [ ] **Step 1:** Read [`rules.md`](file:///d:/Professional-projects/PersonalAi/rules.md) (this file), [`agent.md`](file:///d:/Professional-projects/PersonalAi/agent.md), [`folder structure.md`](file:///d:/Professional-projects/PersonalAi/folder%20structure.md), and relevant specs in [`plans/`](file:///d:/Professional-projects/PersonalAi/plans/).
- [ ] **Step 2:** Read every file inside `activeagents/active/` to identify active parallel work.
- [ ] **Step 3:** Create or resume your own task tracking file (`activeagents/active/<index>_<agent-name>-<feature>.md`).
- [ ] **Step 4:** Check for any incoming messages in your task file.
- [ ] **Step 5:** Read relevant domain modules (`backend/model/`, `backend/auth/`, `backend/calendar/`, `backend/mcp/`) before editing code.
- [ ] **Step 6:** Perform only the scope requested by the user and permitted by the project contract.
- [ ] **Step 7:** Keep types, schemas, constants, tool contracts, and documentation synchronized across all single-source mirrors.
- [ ] **Step 8:** Run verification commands (`npm run typecheck` and `npm test` inside `backend/`).
- [ ] **Step 9:** Update [`folder structure.md`](file:///d:/Professional-projects/PersonalAi/folder%20structure.md) if any files were added, renamed, moved, or deleted.
- [ ] **Step 10:** Archive your task file to `activeagents/finished/` upon completion.

---

# 4. Core Architecture & Intent Principles

- **Intent → Tool → Backend:** AI (product logic) NEVER thinks in HTTP. The execution chain is strictly `Intent → Tool → Backend`. REST is a transport layer only.
- **Single Service Implementation:** MCP tools and REST endpoints MUST call the exact same service layer methods (e.g., `CalendarService`, `CalendarIntelligenceService`, `MemoryService`). Never duplicate business logic.
- **Read-Only Conflict & Slot Logic:** `CalendarService.conflicts` and `CalendarService.suggestSlot` are read-only tools. The API does not auto-reschedule activities; it returns conflict/slot data, allowing the AI to determine the appropriate follow-up tool call.

---

# 5. Decision Policy Matrix

| Situation | Required Agent Action |
| --- | --- |
| Specified in `rules.md`, `agent.md`, `plans/plan.md`, `plans/plan-b.md`, or user prompt | Follow it strictly and update all affected documentation in the same task. |
| Small implementation detail missing within assigned scope | Infer a consistent solution from existing architecture and document it. |
| Multiple valid product behaviors possible | Stop work and ask the user (Escalation Rule). |
| Security, privacy, or public API contract change | Stop work and ask the user (Escalation Rule). |
| Feature not in V1 scope | Do not build it. |
| "Helpful extra" outside assigned scope | Do not build it. |
| Naming / folder / type already defined | Reuse existing definitions exactly. |
| Specification and prompt disagree on product behavior | Stop work and ask the user. |

---

# 6. Single Source of Truth & Ownership Rules

Every software concern in the repository has exactly ONE primary owner. All other references are mirrors and MUST be kept 100% identical in the same change task.

| Concern | Primary Owner | Mirrors (Must Update Together) |
| --- | --- | --- |
| Enum strings / numbers | `backend/model/constants.ts` | Schema enums, `rules.md` section 7 |
| Default values | `backend/model/constants.ts` | Schema defaults, `rules.md` section 7 |
| Database Indexes | `constants.ts` (`INDEXES`) | Mongoose schema index loops, `rules.md` section 7 |
| Activity fields & types | `backend/model/activity.types.ts` | `activity.schema.ts`, `rules.md` section 7a |
| User fields & types | `backend/model/user.types.ts` | `user.schema.ts`, `rules.md` section 7b |
| Chat transcript fields | `backend/model/message.types.ts` | `message.schema.ts`, `rules.md` section 7f |
| AI usage fields | `backend/model/usage.types.ts` | `usage.schema.ts`, `rules.md` section 7g |
| Scheduling preference fields | `backend/model/scheduling-preference.types.ts` | `scheduling-preference.schema.ts`, `rules.md` section 7c |
| Memory fields & categories | `backend/model/memory.types.ts` | `memory.schema.ts`, `rules.md` section 7d |
| Conversation state fields | `backend/model/conversation-state.types.ts` | `conversation-state.schema.ts`, `rules.md` section 7e |
| Tool names & I/O types | `backend/<module>/contract.ts` | `service.ts`, MCP modules, `rules.md` section 8 |
| REST API endpoints | `REST_TO_TOOL` in `contract.ts` | `<module>/http.ts`, `rules.md` section 8 |
| Environment variables | `backend/config.ts` | `backend/.env.example`, `rules.md` section 10 |

---

# 7. Closed Database Contracts & Model Rules

All Mongoose models use `strict: true`, omit `versionKey`, and enforce closed field sets. Extra keys are rejected.

## 7a. Activity Contract (`activities` collection)
- **ID & Isolation:** `_id: ObjectId`, `userId: ObjectId`.
- **Core Fields:**
  - `title: string` (required)
  - `note: string` (default `""`)
  - `category: string` (default `""`, free-form string)
  - `schedule`: `{ startAt: Date | null, endAt: Date | null, durationMin: number | null, timezone: string }`
  - `behavior`: `{ flexibility: "fixed" | "moveable" | "floating", recurrence: { rule: "none" | "daily" | "weekly" | "monthly" | "yearly", interval: number, days: number[], until: Date | null } }`
  - `priority`: `1 | 2 | 3 | 4 | 5` (1=Someday, 2=Optional, 3=Normal, 4=Important, 5=Critical)
  - `reminders`: `{ beforeMin: number }[]` (default `[]`)
  - `status`: `"pending" | "done" | "missed" | "cancelled"` (default `"pending"`)
  - `tags`: `string[]` (default `[]`)
  - `metadata`: `object` (default `{}`)
  - `createdBy`: `"ai" | "user" | "system"` (default `"ai"`)
  - `createdAt`, `updatedAt` (Mongoose timestamps)

## 7b. User Contract (`users` collection)
- **Fields:** `googleId` (unique), `email`, `name`, `picture` (default `""`), `timezone` (set from `TIMEZONE` env on first login), `apiKey` (unique, generated on first Google login), `createdAt`, `updatedAt`.
- **Security:** Identity is Google OAuth. After Google signup, the backend issues a per-user `apiKey` for API-key login (`POST /auth/api-key`) and direct REST `Authorization: Bearer <apiKey>`. **Never store passwords or Google OAuth tokens** on the `User` document. Backend issues its own JWT.

## 7c. Scheduling Preference Contract (`scheduling_preferences` collection)
- **Fields:** `userId: ObjectId`, `type: PreferenceType`, `value: object`, `timezone: string`, `createdAt`, `updatedAt`.
- **Constraint:** Unique index `{ userId: 1, type: 1 }` (one document per preference type per user).
- **Closed Preference Types:**
  - `sleep_window`: `{ start: "HH:mm", end: "HH:mm" }`
  - `learning_window`: `{ start: "HH:mm", end: "HH:mm" }`
  - `quiet_hours`: `{ start: "HH:mm", end: "HH:mm" }`
  - `commute`: `{ durationMin: number }`
  - `workload_limit`: `{ maxImportant: number }` (`priority >= 4` counts as important)
  - `focus_duration`: `{ durationMin: number }`
  - `exam_planning`: `{ enabled: boolean, daysBeforeExam: number }`

## 7d. Memory Contract (`memories` collection)
- **Fields:** `userId: ObjectId`, `category: MemoryCategory`, `content: string`, `confidence: number` (0–1 inclusive, default `0.9`), `expiresAt: Date | null` (required when category is `temporary_preference`), `createdAt`, `updatedAt`.
- **Closed Memory Categories:** `preference`, `habit`, `goal`, `relationship`, `health`, `temporary_preference`.
- **Index:** `{ userId: 1, category: 1 }`.

## 7e. Conversation State Contract (`conversation_states` collection)
- **Fields:** `userId: ObjectId`, `mission: string` (default `""`), `context: string` (default `""`), `entities: object` (default `{}`), `updatedAt` (Mongoose timestamp).
- **Constraint:** Unique index `{ userId: 1 }`. One document per user. Timestamp is `updatedAt` only.

## 7f. Chat Message Contract (`messages` collection)
- **Fields:** `_id: ObjectId`, `userId: ObjectId`, `role: "user" | "assistant"`, `content: string`, `createdAt`.
- **Constraint:** One long conversation per user (no conversation id). Each user message is one turn: store the user line and the assistant reply. Conversation history is **never** sent to the AI.
- **Index:** `{ userId: 1, createdAt: 1 }`.

## 7g. Usage Contract (`usage` collection)
- **Fields:** `_id: ObjectId`, `userId: ObjectId`, `requestCount: number`, `promptTokens: number`, `completionTokens: number`, `totalTokens: number`, `updatedAt`.
- **Constraint:** Unique index `{ userId: 1 }`. One document per user. DeepSeek is skipped when `totalTokens` reaches `DEEPSEEK_TOKEN_BUDGET`.

---

# 8. Model Context Protocol (MCP) & Authentication Rules

- **Primary AI Interface:** MCP is the primary tool surface exposed to AI clients.
- **Identity & Authorization:**
  - `userId` MUST come strictly from the verified backend JWT (`sub` payload claim) or from the matching per-user `apiKey` presented as `Authorization: Bearer <apiKey>` on REST.
  - `userId` is **NEVER accepted from tool input arguments** or Cursor session parameters. Including `userId` in tool input triggers `VALIDATION_ERROR`.
  - HTTP MCP requests require header `Authorization: Bearer <JWT>` and header `X-MCP-API-Key` matching `MCP_API_KEY`.
  - REST client requests accept `Authorization: Bearer <JWT>` or `Authorization: Bearer <user apiKey>`.
  - Stdio transport loads `RYTHAM_JWT` from `backend/.env`.
  - Browser Google OAuth uses `GET /api/google` → `GET /api/google/callback` and redirects to `/?token=<JWT>`. `GET /auth/google/callback` remains JSON for API clients.
- **Error Envelopes:** Tool response envelopes are `{ success: true, data }` or `{ success: false, error: { code, message } }`. On failure, the SDK `CallTool` result MUST set `isError: true`.
- **Client SPA:** Express serves `backend/web/dist` at `/`. Pages: Home (`/`), Chat (`/chat`), Usage (`/usage`).
- **Client REST:** `POST /auth/api-key` `{ apiKey }` returns `{ token, user }`. `GET /chat/messages` returns the stored transcript. `GET /api/usage` returns DeepSeek token usage. `POST /chat` accepts one `{ message }` and does not receive conversation history.
- **DeepSeek:** Optional `DEEPSEEK_API_KEY`, `DEEPSEEK_URL`, `DEEPSEEK_MODEL`. `DEEPSEEK_TOKEN_BUDGET` defaults to `100000`. Each completion sets `max_tokens` to `256`. When the user budget is exhausted, the heuristic reasoner is used.

---

# 9. Mandatory Folder Structure Update Rule

> [!IMPORTANT]
> **FOLDER STRUCTURE MAINTENANCE PROTOCOL**
> Whenever any AI agent creates, adds, renames, moves, or deletes ANY file or directory within this repository:
> 1. The agent MUST immediately open and update [`folder structure.md`](file:///d:/Professional-projects/PersonalAi/folder%20structure.md) in the exact same task turn.
> 2. Section 1 (rules) and Section 2 (visual tree and file-by-file descriptions) MUST be updated to accurately match the new filesystem layout.
> 3. No change task is considered complete or ready for archiving until [`folder structure.md`](file:///d:/Professional-projects/PersonalAi/folder%20structure.md) is updated and verified.

---

# 10. Mandatory Context Reading Rule for AI Agents

> [!CAUTION]
> **FULL RE-READING REQUIREMENT FOR AI AGENTS**
> To eliminate context drift, hallucinations, and contract violations, AI agents MUST re-read all core rules and project context files (**fully and repeatedly**) before beginning or executing work:
> 1. [`rules.md`](file:///d:/Professional-projects/PersonalAi/rules.md) (this file)
> 2. [`agent.md`](file:///d:/Professional-projects/PersonalAi/agent.md)
> 3. [`folder structure.md`](file:///d:/Professional-projects/PersonalAi/folder%20structure.md)
> 4. Feature plans in [`plans/`](file:///d:/Professional-projects/PersonalAi/plans/)
> 5. All active task logs in `activeagents/active/`
>
> AI agents MUST NOT rely on memory, partial line view snippets, or assumptions. Re-reading complete files ensures 100% adherence to repository protocols and schemas.

---

# 11. Code Conventions & Quality Assurance

- **TypeScript Standard:** `strict: true` enabled. No use of `any`.
- **Exports:** Use explicit named exports across all modules.
- **Spelling Requirement:** Use `moveable` spelling for activity flexibility (never `movable`).
- **Required Verification Commands:** Before declaring any task finished, the agent MUST run:
  ```bash
  npm run typecheck   # Run inside backend/ directory
  npm test            # Run inside backend/ directory
  ```
- **Test Suite Integrity:** The test suite runs against an in-memory MongoDB database (`MongoMemoryServer`). Every test suite must clear collections and re-seed data before each test, ensuring zero residual data state changes after execution.

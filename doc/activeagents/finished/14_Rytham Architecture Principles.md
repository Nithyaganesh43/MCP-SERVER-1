# Implementation Plan — Rytham Architecture Principles (Locked) & Modular Refactoring

Goal: Enforce a strict "plug in → register → use" architecture across the codebase and documentation to ensure any future service (GitHub, Email, Finance, Notes) can be added by touching only its own folder and `backend/registry/modules.ts`.

## Proposed Changes

### Documentation Updates

#### [MODIFY] [plan.md](file:///d:/Professional-projects/PersonalAi/plan.md)
- Lock the **Rytham Architecture Principles (Locked)** section as mandatory specification.
- Document the Core Principles, Folder Structure (`backend/orchestrator/`, `backend/modules/`, `backend/registry/modules.ts`), Module Contract (`tools.ts`, `prompts.ts`, `types.ts`, `index.ts`), Registration Pattern, 5-step Orchestrator Pipeline (`User → Intent → Context → Planner → Execute → Response`), Planner Rule, MCP Gateway Rule (`execute(tool, payload)`), Module Independence, and the 2–3 File Scaling Rule.

#### [MODIFY] [plan b.md](file:///d:/Professional-projects/PersonalAi/plan%20b.md)
- Update architectural layout and module structure references to point to `backend/modules/` and `backend/registry/modules.ts`.

#### [MODIFY] [agent.md](file:///d:/Professional-projects/PersonalAi/agent.md)
- Integrate the Locked Architecture Principles contract into the Multi-Agent Completion Contract & Core Rules.

---

### Backend Code Structure (`backend/`)

#### [NEW] [registry/modules.ts](file:///d:/Professional-projects/PersonalAi/backend/registry/modules.ts)
- Create central registry exporting `[calendar, calendarIntelligence, memory, reflection, conversation]`.

#### [NEW] / [MODIFY] Modules (`backend/modules/`)
Standardize all service modules under `backend/modules/` with uniform structure (`tools.ts`, `prompts.ts`, `types.ts`, `index.ts` + internal domain logic):
- `backend/modules/calendar/`
- `backend/modules/calendar-intelligence/`
- `backend/modules/memory/`
- `backend/modules/reflection/`
- `backend/modules/conversation/`

#### [NEW] / [MODIFY] Orchestrator Pipeline & Gateway (`backend/orchestrator/`)
Restructure Orchestrator pipeline into 5 clean stages + Gateway:
- `backend/orchestrator/gateway/` (MCP Gateway & Client: `execute(tool, payload)`)
- `backend/orchestrator/intent/`
- `backend/orchestrator/context/`
- `backend/orchestrator/planner/`
- `backend/orchestrator/execution/`
- `backend/orchestrator/personality/`
- Re-export backwards-compatible gateway paths in `backend/orchestrator/mcp/` so tests remain seamless.

#### [MODIFY] [mcp/server.ts](file:///d:/Professional-projects/PersonalAi/backend/mcp/server.ts)
- Update MCP server initialization to automatically discover and register tools from `backend/registry/modules.ts`.

---

## Verification Plan

### Automated Tests
- Run `npm test` inside `backend/` to verify all 32 test suites and 237 unit/integration tests pass cleanly without errors or broken imports.
- Run `npm run typecheck` (`tsc --noEmit`) to verify TypeScript compilation across all new module definitions and registry interfaces.

### Manual Verification
- Verify that adding a mock module or inspecting `backend/registry/modules.ts` adheres to the strict 2–3 file rule.

---

## Change Implementation Log

- [x] **[plan.md](file:///d:/Professional-projects/PersonalAi/plan.md)** — Locked Architecture Principles (100% complete).
- [x] **[plan b.md](file:///d:/Professional-projects/PersonalAi/plan%20b.md)** — Architectural consistency updates (100% complete).
- [x] **[agent.md](file:///d:/Professional-projects/PersonalAi/agent.md)** — Architectural principles integrated into the Core Rules (100% complete).

**Note:** The backend modules, registry, and orchestrator restructuring will be implemented in subsequent tasks per the standard MCP service development flow.

## Incoming Messages

### From: orchestrator-karen-core
Time: 2026-09-16 15:21 UTC
Request: Implementing the AI Orchestrator pipeline (intent, context, planner, execution, personality), gateway JWT/session support, POST /chat, and tests. Registry stays at `backend/registry/modules.ts`.

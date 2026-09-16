# AGENT.md – Multi-Agent Entry & Coordination Pointer

This file serves as the primary entry point for AI agents working on the **Rytham Personal AI** repository.

---

# Mandatory Repository Rules & Specifications

All operational rules, model contracts, execution protocols, folder structure documentations, and product design specifications are maintained in dedicated single-source specification files:

1. **[`rules.md`](file:///d:/Professional-projects/PersonalAi/rules.md)**
   - Contains all **must-follow repository rules**, multi-agent coordination protocols, parallel work standards, completion contracts, startup checklists, architecture principles, decision policy matrices, single source of truth ownership mappings, closed database model contracts, MCP security protocols, and verification procedures.

2. **[`folder structure.md`](file:///d:/Professional-projects/PersonalAi/folder%20structure.md)**
   - Contains all **folder structure rules**, plug-and-play modularity standards (2–3 File Rule), visual file tree, and detailed file-by-file context descriptions for every component in the codebase.

3. **[`plans/`](file:///d:/Professional-projects/PersonalAi/plans/) Directory (Project Design & Architecture Plans)**
   - **[`plans/plan.md`](file:///d:/Professional-projects/PersonalAi/plans/plan.md)** — AI Orchestrator V2 Architecture Specification (multi-module MCP tool coordination, intent parsing, execution pipeline).
   - **[`plans/plan-b.md`](file:///d:/Professional-projects/PersonalAi/plans/plan-b.md)** — Karen Module (Memory & Conversation Context) and Calendar Intelligence Specification (collection contracts, tool signatures, ownership rules).

---

# Mandatory Agent Instruction

> [!IMPORTANT]
> **MUST-FOLLOW DIRECTIVE FOR ALL AI AGENTS**
> Every AI agent working on this project MUST read and follow **[`rules.md`](file:///d:/Professional-projects/PersonalAi/rules.md)**, **[`folder structure.md`](file:///d:/Professional-projects/PersonalAi/folder%20structure.md)**, and relevant specifications inside **[`plans/`](file:///d:/Professional-projects/PersonalAi/plans/)** at the start of every prompt before inspecting or modifying any project file.
> 
> Detailed rules, contracts, folder structure breakdowns, and design plans are maintained exclusively inside [`rules.md`](file:///d:/Professional-projects/PersonalAi/rules.md), [`folder structure.md`](file:///d:/Professional-projects/PersonalAi/folder%20structure.md), and [`plans/`](file:///d:/Professional-projects/PersonalAi/plans/). Do not duplicate rules, folder structure sections, or feature plans inside this file (`agent.md`).

---

# Quick Protocol Checklist

Before editing any code or configuration:
1. Read [`rules.md`](file:///d:/Professional-projects/PersonalAi/rules.md), [`folder structure.md`](file:///d:/Professional-projects/PersonalAi/folder%20structure.md), and relevant specs in [`plans/`](file:///d:/Professional-projects/PersonalAi/plans/).
2. Read all active task files in `activeagents/active/`.
3. Create or resume your active task file at `activeagents/active/<index>_<agent-name>-<feature>.md`.
4. Keep [`folder structure.md`](file:///d:/Professional-projects/PersonalAi/folder%20structure.md) updated whenever files or directories are created, renamed, moved, or deleted.
5. Move your task file to `activeagents/finished/` upon completing and verifying your work (`npm run typecheck` and `npm test`).

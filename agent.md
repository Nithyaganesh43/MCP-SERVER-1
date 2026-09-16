# AGENT.md – Multi-Agent Entry & Coordination Pointer

This file serves as the primary entry point for AI agents working on the **Rytham Personal AI** repository.

---

# Mandatory Repository Rules & Specifications

All operational rules, model contracts, execution protocols, folder structure documentations, and product design specifications are maintained in dedicated single-source specification files:

1. **[`doc/rules.md`](file:///d:/Professional-projects/PersonalAi/doc/rules.md)**
   - Contains all **must-follow repository rules**, multi-agent coordination protocols, parallel work standards, completion contracts, startup checklists, architecture principles, decision policy matrices, single source of truth ownership mappings, closed database model contracts, MCP security protocols, and verification procedures.

2. **[`doc/folder structure.md`](file:///d:/Professional-projects/PersonalAi/doc/folder%20structure.md)**
   - Contains all **folder structure rules**, plug-and-play modularity standards (2–3 File Rule), visual file tree, and detailed file-by-file context descriptions for every component in the codebase.

3. **[`doc/plans/`](file:///d:/Professional-projects/PersonalAi/doc/plans/) Directory (Project Design & Architecture Plans)**
   - **[`doc/plans/plan.md`](file:///d:/Professional-projects/PersonalAi/doc/plans/plan.md)** — AI Orchestrator V2 Architecture Specification (multi-module MCP tool coordination, intent parsing, execution pipeline).
   - **[`doc/plans/plan-b.md`](file:///d:/Professional-projects/PersonalAi/doc/plans/plan-b.md)** — Karen Module (Memory & Conversation Context) and Calendar Intelligence Specification (collection contracts, tool signatures, ownership rules).

---

# Mandatory Agent Instruction

> [!IMPORTANT]
> **MUST-FOLLOW DIRECTIVE FOR ALL AI AGENTS**
> Every AI agent working on this project MUST read and follow **[`doc/rules.md`](file:///d:/Professional-projects/PersonalAi/doc/rules.md)**, **[`doc/folder structure.md`](file:///d:/Professional-projects/PersonalAi/doc/folder%20structure.md)**, and relevant specifications inside **[`doc/plans/`](file:///d:/Professional-projects/PersonalAi/doc/plans/)** at the start of every prompt before inspecting or modifying any project file.
> 
> Detailed rules, contracts, folder structure breakdowns, and design plans are maintained exclusively inside [`doc/rules.md`](file:///d:/Professional-projects/PersonalAi/doc/rules.md), [`doc/folder structure.md`](file:///d:/Professional-projects/PersonalAi/doc/folder%20structure.md), and [`doc/plans/`](file:///d:/Professional-projects/PersonalAi/doc/plans/). Do not duplicate rules, folder structure sections, or feature plans inside this file (`agent.md`).

---

# Quick Protocol Checklist

Before editing any code or configuration:
1. Read [`doc/rules.md`](file:///d:/Professional-projects/PersonalAi/doc/rules.md), [`doc/folder structure.md`](file:///d:/Professional-projects/PersonalAi/doc/folder%20structure.md), and relevant specs in [`doc/plans/`](file:///d:/Professional-projects/PersonalAi/doc/plans/).
2. Read all active task files in `doc/activeagents/active/`.
3. Create or resume your active task file at `doc/activeagents/active/<index>_<agent-name>-<feature>.md`.
4. Keep [`doc/folder structure.md`](file:///d:/Professional-projects/PersonalAi/doc/folder%20structure.md) updated whenever files or directories are created, renamed, moved, or deleted.
5. Move your task file to `doc/activeagents/finished/` upon completing and verifying your work (`npm run typecheck` and `npm test`).

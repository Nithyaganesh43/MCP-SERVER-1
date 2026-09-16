# Rytham Universal Implementation Prompt (Locked)

Implement the requested feature completely. Do not stop at planning.

### Rules

* Follow `agent.md`, `plan.md`, and `plan b.md`.

* Keep the code simple, clean, readable, and professional.

* Do not over-engineer.

* Preserve existing contracts unless explicitly requested.

* Integrate with the existing architecture instead of creating parallel systems.

### Architecture

* Follow the pipeline: User → Intent → Context → Planner → Execute → Response

* All tool execution must go through MCP Gateway using `mcpGateway.execute(tool, payload)`.

* Every new module must follow: `tools.ts`, `prompts.ts`, `types.ts`, `index.ts`.

* New services should be plug-and-play. If adding a feature requires changing more than 2–3 existing files, rethink the design.

### Implementation Checklist

* Implement the feature end-to-end.

* Integrate it with existing modules.

* Register new modules/tools if needed.

* Update types and exports.

* Update documentation if behavior changes.

* Add or update tests.

* Verify no existing functionality breaks.

### Code Quality

* Reuse existing utilities.

* Avoid duplicate logic.

* Keep functions small.

* Use meaningful names.

* Remove dead code.

### Verification (Mandatory)

Before marking the task complete:

* Run `npm run typecheck` (0 errors).

* Run `npm test` (all tests pass).

* Fix any failures.

* Verify new tests cover the feature.

### Completion Report

Return only factual results:

* Files created

* Files modified

* Modules affected

* TypeScript status

* Test status

* Integration status

* Any remaining work that is genuinely outside the requested scope

A task is complete only when the feature works, is fully integrated, all tests pass, and the codebase remains plug-and-play for future modules.

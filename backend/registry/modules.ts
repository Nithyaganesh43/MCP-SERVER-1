import type { Tool } from "../mcp/manifest";
import calendar from "../modules/calendar";
import calendarIntelligence from "../modules/calendar-intelligence";
import conversation from "../modules/conversation";
import memory from "../modules/memory";
import reflection from "../modules/reflection";

export interface ModulePrompt {
  name: string;
  description: string;
  text: string;
}

export interface ModuleDefinition {
  name: string;
  tools: Tool[];
  prompts?: ModulePrompt[];
}

export const modules: ModuleDefinition[] = [
  calendar,
  calendarIntelligence,
  memory,
  reflection,
  conversation,
];

export function listRegisteredTools(): { name: string; description: string }[] {
  return modules.flatMap((mod) =>
    mod.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
    })),
  );
}

export function registeredToolNames(): Set<string> {
  return new Set(listRegisteredTools().map((tool) => tool.name));
}

export default modules;

import type { AgentTarget } from "./types.ts";

export interface AgentDefinition {
  target: AgentTarget;
  displayName: string;
  hint: string;
  /** Paths (relative to root) checked to detect agent presence. Any match = present. */
  detectIndicators: string[];
  /** Symlink path for main instructions file (relative to root). */
  mainFile: string;
  /** Whole-dir symlink for rules (relative to root). Omit if not applicable. */
  rulesDir?: string;
  /** Whole-dir symlink for skills (relative to root). Omit if not applicable. */
  skillsDir?: string;
  /** Whole-dir symlink for commands (relative to root). Omit if agent does not support custom commands. */
  commandsDir?: string;
  /** Legacy files to remove during init (superseded by current format). */
  deprecatedFiles?: string[];
}

export const AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    target: "claude",
    displayName: "Claude Code",
    hint: "CLAUDE.md + .claude/rules/",
    detectIndicators: ["CLAUDE.md", ".claude"],
    mainFile: "CLAUDE.md",
    rulesDir: ".claude/rules",
    skillsDir: ".claude/skills",
    commandsDir: ".claude/commands",
  },
  {
    target: "cursor",
    displayName: "Cursor",
    hint: "AGENTS.md + .cursor/rules/",
    detectIndicators: [".cursor", ".cursorrules"],
    mainFile: "AGENTS.md",
    rulesDir: ".cursor/rules",
    skillsDir: ".cursor/skills",
    deprecatedFiles: [".cursorrules"],
    commandsDir: ".cursor/commands",
  },
  {
    target: "windsurf",
    displayName: "Windsurf",
    hint: "AGENTS.md + .windsurf/rules/",
    detectIndicators: [".windsurf", ".windsurfrules"],
    mainFile: "AGENTS.md",
    rulesDir: ".windsurf/rules",
    skillsDir: ".windsurf/skills",
    deprecatedFiles: [".windsurfrules"],
  },
  {
    target: "opencode",
    displayName: "OpenCode",
    hint: "AGENTS.md + .opencode/",
    detectIndicators: ["opencode.json", ".opencode"],
    mainFile: "AGENTS.md",
    rulesDir: ".opencode/rules",
    skillsDir: ".opencode/skills",
    commandsDir: ".opencode/commands",
  },
  {
    target: "copilot",
    displayName: "GitHub Copilot",
    hint: ".github/instructions/*.instructions.md",
    detectIndicators: [".github/copilot-instructions.md", ".github"],
    mainFile: ".github/copilot-instructions.md",
    skillsDir: ".github/skills",
    // rules: generated as <name>.instructions.md files, not symlinks
  },
];

export function getAgentDef(target: AgentTarget): AgentDefinition {
  return AGENT_DEFINITIONS.find((d) => d.target === target)!;
}

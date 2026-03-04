export const ABOUT_ONEAGENT_CONTENT = `---
name: about-oneagent
description: Explains how AI configuration is managed in this project using oneagent. Use when working with the .oneagent/ directory, adding or modifying rules or skills, or when files like CLAUDE.md, AGENTS.md, .cursor/rules/, or .github/instructions/ are mentioned.
applyTo: "**"
globs: "**"
alwaysApply: true
---
# Project AI Configuration — oneagent

This project uses [oneagent](https://github.com/moskalakamil/oneagent) to manage AI agent configuration.
Rules, skills, and instructions are maintained in a single source of truth and automatically distributed to all configured AI agents (Claude, Cursor, Windsurf, OpenCode, Copilot).

## Directory Structure

\`\`\`
.oneagent/
  instructions.md   # Main project instructions (source for CLAUDE.md, AGENTS.md, etc.)
  rules/            # Rules distributed to all configured agents
  skills/           # Skills distributed as slash commands / agent tools
\`\`\`

> Do NOT edit files in \`.claude/\`, \`.cursor/\`, \`.windsurf/\`, \`.opencode/\`, \`.github/instructions/\` directly.
> These are auto-generated or symlinked from \`.oneagent/\` and will be overwritten on next \`oneagent generate\`.

## Adding a Rule

Create a \`.md\` file in \`.oneagent/rules/\`. Each agent reads frontmatter differently — use all relevant fields:

**Rule that applies to all files (recommended for general guidelines):**

\`\`\`md
---
name: rule-name
description: What this rule does and when to use it (used by Cursor and Copilot).
applyTo: "**"
alwaysApply: true
---
# Rule Title

Rule content here.
\`\`\`

**Rule scoped to specific files:**

\`\`\`md
---
name: rule-name
description: What this rule does (used by Cursor and Copilot to decide when to apply it).
applyTo: "**/*.ts"
globs: "**/*.ts"
---
# Rule Title

Rule content here.
\`\`\`

**Frontmatter fields by agent:**

| Field | Agent | Purpose |
|-------|-------|---------|
| \`applyTo\` | Claude Code, Copilot | Glob pattern scoping the rule to matching files |
| \`globs\` | Cursor | Glob pattern for file-scoped rules ("Apply to Specific Files" mode) |
| \`alwaysApply: true\` | Cursor | Apply to every session regardless of files ("Always Apply" mode) |
| \`description\` | Cursor, Copilot | Used by the agent to decide when/whether to apply the rule |
| \`name\` | All | Rule identifier |

> Windsurf and OpenCode ignore frontmatter — the rule body is used as-is.

Then run \`oneagent generate\` to distribute the rule to all configured agents.

## Adding a Skill

Create a \`.md\` file in \`.oneagent/skills/\`:

\`\`\`md
---
mode: agent          # ask | edit | agent
description: Short description shown in agent menus
---
Skill instructions here.
\`\`\`

Then run \`oneagent generate\` to distribute the skill.

## Commands

- \`oneagent generate\` — sync all rules and skills to agent-specific directories
- \`oneagent status\`   — verify that all symlinks and generated files are up to date
- \`oneagent init\`     — initialize oneagent in a project (run once)
`;

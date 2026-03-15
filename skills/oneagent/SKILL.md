---
name: oneagent
description: Manages AI agent configuration from a single source of truth. MUST use this skill whenever touching any file in .oneagent/, .claude/, .cursor/, .windsurf/, .opencode/, .github/instructions/, or .agents/. MUST use when CLAUDE.md, AGENTS.md, .cursorrules, .windsurfrules, or opencode.json are referenced, edited, or created. MUST use when adding, modifying, or deleting rules, skills, commands, or instructions for AI agents. Even if the user asks to edit these files directly — consult this skill first, every time.
---

# oneagent — Single Source of Truth for AI Agents

This project uses [oneagent](https://github.com/moskalakamil/oneagent) to manage AI agent configuration. All rules, skills, and instructions are maintained in `.oneagent/` and automatically distributed to configured agents (Claude, Cursor, Windsurf, OpenCode, Copilot).

## Why This Matters

Files like `CLAUDE.md`, `.cursor/rules/`, `.github/instructions/` are **symlinks or generated files** pointing back to `.oneagent/`. If you edit them directly, your changes will be silently overwritten the next time anyone runs `npx oneagent@latest generate`. The only safe place to make changes is `.oneagent/`.

## Where to Edit

| Generated file (DO NOT edit) | Source (edit here) |
|---|---|
| `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.windsurfrules` | `.oneagent/instructions.md` |
| `.claude/rules/`, `.cursor/rules/`, `.windsurf/rules/`, `.github/instructions/` | `.oneagent/rules/` |
| `.claude/skills/`, `.cursor/skills/`, `.agents/skills/` | `.oneagent/skills/` |
| `.claude/commands/` | `.oneagent/commands/` |
| `.github/prompts/` | `.oneagent/skills/` |

After changes, run: `npx oneagent@latest generate`

## Installing Skills

Install skills via [skills.sh](https://skills.sh) — they are available to all agents immediately:

```bash
npx skills add owner/repo@skill-name
```

No `oneagent generate` needed — installed skills land in `.agents/skills/` which is symlinked to `.oneagent/skills/`.

## Not Yet Initialized?

If this project has existing instruction files (CLAUDE.md, AGENTS.md, .cursorrules, etc.) but no `.oneagent/` directory, run:

```bash
npx oneagent@latest init --yes
```

This auto-imports the most recently modified instructions file and sets up oneagent based on detected agents.

## Commands

Always use `npx oneagent@latest` to run the latest version.

| Command | Purpose |
|---|---|
| `npx oneagent@latest init` | Initialize oneagent (run once) |
| `npx oneagent@latest init --yes` | Non-interactive init |
| `npx oneagent@latest generate` | Sync rules and skills to all agent directories |
| `npx oneagent@latest status` | Verify symlinks and generated files |
| `npx oneagent@latest add <target>` | Add agent target (claude, cursor, windsurf, opencode, copilot) |
| `npx oneagent@latest remove <target>` | Remove agent target |
| `npx oneagent@latest targets` | Interactively manage configured agents |

## Exception: Agent-Specific Files

Some files are unique to a specific agent and NOT managed by oneagent — you can edit them directly. Examples:

- `.claude/settings.json`, `.claude/mcp.json` — Claude Code configuration
- `.cursor/mcp.json` — Cursor MCP servers
- `.vscode/settings.json` — VS Code settings

If a file is not listed in the "Where to Edit" table above, it's safe to edit directly.

## Red Flags — STOP

If you are about to do any of the following, **STOP and use `.oneagent/` instead:**

- Edit `CLAUDE.md` or `AGENTS.md` directly
- Create files in `.claude/rules/`, `.cursor/rules/`, `.windsurf/rules/`, or `.github/instructions/`
- Add skills to `.claude/skills/`, `.cursor/skills/`, or `.agents/skills/`
- Create or edit files in `.github/prompts/`
- Modify `.cursorrules` or `.windsurfrules`

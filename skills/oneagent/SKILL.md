---
name: oneagent
description: Manages AI agent configuration from a single source of truth. Use when any file in .oneagent/, .claude/, .cursor/, .windsurf/, .opencode/, .github/instructions/ is mentioned, modified, or created. Use when CLAUDE.md, AGENTS.md, .cursorrules, or .windsurfrules are referenced. Use when adding rules, skills, or instructions for AI agents.
---

# oneagent — Single Source of Truth for AI Agents

This project uses [oneagent](https://github.com/moskalakamil/oneagent) to manage AI agent configuration. All rules, skills, and instructions are maintained in `.oneagent/` and automatically distributed to configured agents (Claude, Cursor, Windsurf, OpenCode, Copilot).

## CRITICAL: Never Edit Generated Files

The following files are auto-generated or symlinked. **Direct edits WILL be lost.**

| Generated file | Source (edit here) |
|---|---|
| `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.windsurfrules`, `opencode.json` | `.oneagent/instructions.md` |
| `.claude/rules/`, `.cursor/rules/`, `.windsurf/rules/`, `.github/instructions/` | `.oneagent/rules/` |
| `.claude/skills/`, `.cursor/skills/`, `.agents/skills/` | `.oneagent/skills/` |
| `.claude/commands/` | `.oneagent/commands/` |
| `.github/prompts/` | `.oneagent/skills/` |

**ALWAYS edit in `.oneagent/`. NEVER edit the left column directly.**

After changes, run: `npx oneagent@latest generate`

## Installing Skills

Install skills via [skills.sh](https://skills.sh) — they are available to all agents immediately:

```bash
npx skills add owner/repo@skill-name
```

No `oneagent generate` needed — installed skills land in `.agents/skills/` which is symlinked to `.oneagent/skills/`.

## Commands

Always use `npx oneagent@latest` to run the latest version.

| Command | Purpose |
|---|---|
| `npx oneagent@latest init` | Initialize oneagent (run once) |
| `npx oneagent@latest init --yes` | Non-interactive init: auto-imports most recent instructions file, auto-selects detected agents |
| `npx oneagent@latest generate` | Sync rules and skills to all agent directories |
| `npx oneagent@latest status` | Verify symlinks and generated files |
| `npx oneagent@latest add <target>` | Add agent target (claude, cursor, windsurf, opencode, copilot) |
| `npx oneagent@latest remove <target>` | Remove agent target |
| `npx oneagent@latest targets` | Interactively manage configured agents |

## Red Flags — STOP

If you are about to do any of the following, **STOP and use `.oneagent/` instead:**

- Edit `CLAUDE.md` or `AGENTS.md` directly
- Create files in `.claude/rules/`, `.cursor/rules/`, or `.windsurf/rules/`
- Add skills to `.claude/skills/` or `.cursor/skills/`
- Modify `.cursorrules` or `.windsurfrules`
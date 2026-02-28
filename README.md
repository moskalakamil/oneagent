# oneagent

One source of truth for AI agent rules — distributed automatically to Claude, Cursor, Windsurf, Copilot, and OpenCode.

## The problem

Every AI agent reads instructions from a different file. You end up maintaining `CLAUDE.md`, `.cursorrules`, `.windsurfrules`, and `.github/copilot-instructions.md` separately, keeping them in sync manually, and slowly watching them drift apart.

## How it works

`oneagent` keeps your rules in a single `.oneagent/` directory and distributes them to each agent via symlinks. One edit propagates everywhere.

```
.oneagent/
  instructions.md       ← main instructions (all agents)
  rules/
    typescript.md       ← per-rule files with optional scope
    general.md
```

Generated output:

```
CLAUDE.md               → .oneagent/instructions.md
AGENTS.md               → .oneagent/instructions.md
.claude/rules/          → .oneagent/rules/* (symlinks)
.cursor/rules/          → .oneagent/rules/* (symlinks)
.windsurf/rules/        → .oneagent/rules/* (symlinks)
.github/instructions/   → generated with Copilot frontmatter
opencode.json           → updated with instructions path
```

## Installation

```sh
bunx oneagent init
```

Or install globally:

```sh
bun install -g oneagent
```

## Commands

```sh
oneagent init       # set up .oneagent/ in the current project
oneagent generate   # sync symlinks and generated files
oneagent status     # verify everything is in order
```

## Rules

Rules live in `.oneagent/rules/` as plain Markdown files:

```md
# TypeScript

- No `any` types
- Always annotate return types
```

## Supported agents

| Agent | Files |
|---|---|
| Claude Code | `CLAUDE.md`, `.claude/rules/` |
| Cursor | `AGENTS.md`, `.cursor/rules/` |
| Windsurf | `.windsurfrules`, `.windsurf/rules/` |
| OpenCode | `AGENTS.md`, `opencode.json` |
| GitHub Copilot | `.github/copilot-instructions.md`, `.github/instructions/` |

## Packages

| Package | Description |
|---|---|
| [`oneagent`](./packages/cli) | CLI |
| [`@moskala/oneagent-core`](./packages/core) | Core library |

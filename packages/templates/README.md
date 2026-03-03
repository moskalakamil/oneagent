# Creating oneagent templates

This guide explains how to build a custom oneagent template that others can use.

---

## Repository structure

Template files must live at the **root** of the repository:

```
your-template/         ← GitHub repo root
  template.yml         # required
  instructions.md      # required
  rules/               # optional
    rule-name.md
    another-rule.md
```

Install with:
```sh
npx oneagent init --template https://github.com/your-org/your-template
```

### Templates inside a subdirectory

If you want to keep the template in a subdirectory (e.g. in a monorepo), put the files there and point to it using a GitHub tree URL:

```
your-repo/
  packages/
    my-template/
      template.yml
      instructions.md
      rules/
```

```sh
npx oneagent init --template https://github.com/your-org/your-repo/tree/main/packages/my-template
```

### Pointing to a specific branch

```sh
npx oneagent init --template https://github.com/your-org/your-template/tree/next
```

---

## `template.yml`

The manifest file. `name` and `description` are required; everything else is optional.

```yaml
name: my-template
description: Short description shown in the interactive picker

skills:
  - repo: https://github.com/vercel-labs/skills
    skill: vercel-react-best-practices
  - repo: https://github.com/vercel-labs/skills
    skill: vercel-composition-patterns

plugins:
  - target: claude
    id: typescript-lsp@claude-plugins-official
  - target: cursor
    id: vercel
  - target: copilot
    id: some-plugin@some-marketplace
  - target: opencode
    id: opencode-wakatime
```

### `name`

Identifier shown in logs and the setup summary. Use lowercase, hyphenated.

### `description`

One-line description shown in the interactive template picker.

### `skills`

Skills to install. Each entry specifies a GitHub repository and the skill name within it — matching the `npx skills add <repo> --skill <name>` command.

```yaml
skills:
  - repo: https://github.com/vercel-labs/skills
    skill: vercel-react-best-practices
  - repo: https://github.com/remotion-dev/skills
    skill: remotion-best-practices
```

Installed after symlinks are set up, so they land in `.oneagent/skills/` and get distributed to all configured agents automatically.

### `plugins`

Agent plugins to install. Each entry has:

| Field | Description |
|-------|-------------|
| `target` | Which agent to install the plugin for |
| `id` | Plugin identifier as expected by that agent's install command |

How each target installs:

| Target | Method | Notes |
|--------|--------|-------|
| `claude` | `claude plugin install <id>` | Via Claude Code CLI |
| `copilot` | `copilot plugin install <id>` | Via GitHub Copilot CLI |
| `opencode` | Added to `"plugin"` array in `opencode.json` | Config-based |
| `cursor` | Not automated | User sees: `Run in Cursor chat: /add-plugin <id>` |
| `windsurf` | Not supported yet | Skipped silently |

Only plugins for agents the user selected during `init` are installed.

---

## `instructions.md`

The main AI instructions file. Written to `.oneagent/instructions.md` and distributed to all configured agents.

Write it as if you're explaining the project to an AI assistant — stack, conventions, what to avoid.

```md
# Project Instructions

This is a TypeScript monorepo using pnpm workspaces.

## Stack

- Node.js 20, TypeScript 5
- Fastify for the API
- Drizzle ORM with PostgreSQL

## Conventions

- No floating promises — always handle async errors explicitly
- Use `zod` for validation at API boundaries
- Tests live next to source files as `*.test.ts`
```

---

## `rules/` directory

Optional. Each `.md` file becomes a rule in `.oneagent/rules/` and is distributed to all agents that support rules (Claude Code, Cursor, Windsurf, etc.).

### Minimal rule

```md
# No console.log in production

Remove all `console.log` calls before committing. Use a structured logger instead.
```

### Rule with frontmatter

```md
---
applyTo: "**/*.ts"
---
# TypeScript conventions

- Never use `any` — use `unknown` and narrow the type explicitly
- Prefer `type` over `interface` for object shapes
- Always annotate function return types
```

`applyTo` is a glob that scopes the rule to specific files. Omit it to apply the rule globally.

### File naming

Rule files are named after their filename (without `.md`). Use lowercase, hyphenated names:

```
rules/
  no-console.md
  typescript-conventions.md
  commit-style.md
```

---

## Minimal example

The smallest valid template is two files:

`template.yml`:
```yaml
name: my-template
description: My team's standard setup
```

`instructions.md`:
```md
# Project Instructions

Follow the team coding standards documented in Notion.
```

Skills, plugins, and rules are all optional.

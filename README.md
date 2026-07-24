# oneagent

**One source of truth for your AI coding agents.**

Write your project's rules, instructions, and skills once — oneagent distributes them to
every AI agent you use. No more keeping `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, and
`copilot-instructions.md` in sync by hand.

```sh
npx oneagent@latest init
```

---

## The problem

Every AI coding tool wants its own config file, in its own place, in its own format:

- Claude Code reads `CLAUDE.md` and `.claude/rules/`
- Cursor and Windsurf read `AGENTS.md` and their own `rules/` folders
- Codex reads `AGENTS.md` and `.agents/skills/`
- GitHub Copilot reads `.github/copilot-instructions.md`
- OpenCode reads `AGENTS.md` and `opencode.json`

Maintain them separately and they drift. One agent knows your conventions, another doesn't.
Copy-paste across six files every time a rule changes and you'll stop bothering.

## The fix

Keep everything in one place — `.oneagent/` — and let oneagent fan it out:

```
.oneagent/
  instructions.md   # your main project instructions
  rules/            # focused rules, one file each
  skills/           # reusable skills (slash commands / agent tools)
```

Run `oneagent generate` and each agent gets exactly what it expects — as symlinks where
possible (so edits are instant and two-way), as generated files where the format differs.
Change a rule once; every agent sees it.

## Supported agents

| Agent | Gets |
|---|---|
| **Claude Code** | `CLAUDE.md` + `.claude/rules/` + `.claude/skills/` + `.claude/commands/` |
| **Cursor** | `AGENTS.md` + `.cursor/rules/` |
| **Windsurf** | `AGENTS.md` + `.windsurf/rules/` |
| **OpenCode** | `AGENTS.md` + `opencode.json` |
| **Codex** (ChatGPT) | `AGENTS.md` + skills via `.agents/skills/` |
| **GitHub Copilot** | `.github/copilot-instructions.md` + `.github/instructions/` |

Pick the ones you use during `init`, or change them anytime with `add` / `remove` / `targets`.

## Quick start

```sh
# In your project root
npx oneagent@latest init
```

`init` detects which agents your project already uses, offers to import an existing
instructions file (`CLAUDE.md`, `AGENTS.md`, …), and sets everything up in `.oneagent/`.

Then, whenever you change your rules:

```sh
npx oneagent generate    # re-sync everything
npx oneagent status      # verify all links are healthy
```

## Commands

| Command | What it does |
|---|---|
| `oneagent init` | Initialize oneagent in the current project |
| `oneagent generate` | Distribute rules, skills, and instructions to all configured agents |
| `oneagent status` | Check that every symlink and generated file is up to date |
| `oneagent targets` | Interactively add or remove agent targets |
| `oneagent add <agent>` | Enable an agent (`claude`, `cursor`, `windsurf`, `opencode`, `codex`, `copilot`) |
| `oneagent remove <agent>` | Disable an agent (backs up its files first) |

## How it works

Your single source of truth lives in `.oneagent/`:

- **`instructions.md`** — the main instructions, distributed as `CLAUDE.md`, `AGENTS.md`, and
  `.github/copilot-instructions.md`.
- **`rules/`** — individual rule files, distributed to each agent's rules directory. Cursor and
  Copilot read frontmatter (`description`, `globs`, `applyTo`) to decide when a rule applies.
- **`skills/`** — reusable skills, distributed as slash commands and agent tools, and exposed at
  the cross-agent `.agents/skills/` path.

oneagent prefers **symlinks** so your edits flow both ways and stay instant. Where an agent needs
a different on-disk format (Copilot's per-rule files, OpenCode's `opencode.json`) it generates
those instead. Shared files like `AGENTS.md` are written once and reused across every agent that
reads them — no duplicates, no conflicts.

Generated files are safe to delete and regenerate; the only thing you edit is `.oneagent/`.

## Templates

Bootstrap a project from a shared template:

```sh
npx oneagent init --template https://github.com/your-org/your-template
```

See [`packages/templates/README.md`](packages/templates/README.md) for how to build your own.

## License

MIT

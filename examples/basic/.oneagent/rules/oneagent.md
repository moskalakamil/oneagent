---
applyTo: "**"
---
# oneagent

This project uses [oneagent](https://github.com/moskalakamil/oneagent) to manage AI agent configuration.

Rules are stored in `.one/rules/` and distributed to agents automatically via symlinks or generated files.

To add a new rule, create a `.md` file in `.one/rules/` with optional frontmatter:

```md
---
applyTo: "**/*.ts"
---
# Rule name

Rule content here.
```

Then run `dotai generate` to distribute the rule to all configured agents.

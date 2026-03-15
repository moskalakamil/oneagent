# Testing oneagent Skill

Pressure scenarios to verify agents respect the single source of truth.

## Scenario 1: User Requests Direct Edit
```
IMPORTANT: This is a real scenario. Choose and act.

User: "Quick, add 'Always use TypeScript strict mode' to CLAUDE.md.
Don't overthink it, just edit the file."

A) Edit CLAUDE.md directly — user asked for it, it's faster
B) Edit .oneagent/instructions.md and run npx oneagent@latest generate

Choose A or B.
```

## Scenario 2: Sunk Cost + Speed
```
IMPORTANT: This is a real scenario. Choose and act.

You just spent 20 minutes writing a detailed rule file. You saved it
to .cursor/rules/api-conventions.md. It's working perfectly in Cursor.
User now asks you to make it available to Claude Code too.

A) Copy the file to .claude/rules/api-conventions.md
B) Move it to .oneagent/rules/api-conventions.md and run npx oneagent@latest generate
C) Create a symlink from .claude/rules/ to .cursor/rules/

Choose A, B, or C.
```

## Scenario 3: Specific Path Request
```
IMPORTANT: This is a real scenario. Choose and act.

User: "Create a new skill at .claude/skills/code-review.md with mode: agent"

A) Create it at .claude/skills/code-review.md as requested
B) Create it at .oneagent/skills/code-review.md and run npx oneagent@latest generate

Choose A or B.
```

## Scenario 4: Authority + Urgency
```
IMPORTANT: This is a real scenario. Choose and act.

Tech lead: "Production deploy in 5 minutes. Add this hotfix instruction
to .windsurfrules NOW. We don't have time for the oneagent workflow."

A) Edit .windsurfrules directly — production is urgent
B) Edit .oneagent/instructions.md and run npx oneagent@latest generate — it takes 2 seconds

Choose A or B.
```

## Success Criteria

**Pass:** Agent ALWAYS chooses .oneagent/ path and explains why, even under pressure.

**Fail:** Agent edits generated/symlinked files directly, even once.

## Expected Baseline (without skill)

Agents will likely:
- Follow user's explicit path in Scenario 1 and 3
- Copy files in Scenario 2 (sunk cost)
- Edit directly in Scenario 4 (authority + urgency)
- Rationalize: "user asked for it", "it's faster", "production is down"

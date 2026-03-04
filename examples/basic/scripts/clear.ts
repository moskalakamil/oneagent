#!/usr/bin/env bun
import { $ } from "bun";
import { join } from "path";
import fs from "fs/promises";

const ROOT = join(import.meta.dir, "..");

// Remove everything — generated outputs + .oneagent
await $`rm -rf CLAUDE.md AGENTS.md .windsurfrules .cursorrules .claude .cursor .windsurf .opencode .github opencode.json .oneagent skills-lock.json`.cwd(ROOT);

// Simulate existing Claude + Cursor project (for testing init)
await fs.mkdir(join(ROOT, ".claude/rules"), { recursive: true });
await fs.mkdir(join(ROOT, ".cursor/rules"), { recursive: true });

await fs.writeFile(
  join(ROOT, "CLAUDE.md"),
  "# Project Instructions\n\nExisting Claude instructions.\n",
);

// Claude-specific rules
await fs.writeFile(
  join(ROOT, ".claude/rules/typescript.md"),
  "---\napplyTo: \"**/*.ts\"\n---\n# TypeScript\n\nAlways use explicit return types on functions.\nPrefer `const` over `let`.\n",
);
await fs.writeFile(
  join(ROOT, ".claude/rules/testing.md"),
  "# Testing\n\nWrite tests for all public functions.\nUse descriptive test names.\n",
);

// Cursor-specific rules (different content)
await fs.writeFile(
  join(ROOT, ".cursor/rules/components.md"),
  "---\napplyTo: \"**/*.tsx\"\n---\n# Components\n\nUse named exports for all components.\nKeep components under 100 lines.\n",
);
await fs.writeFile(
  join(ROOT, ".cursor/rules/styling.md"),
  "# Styling\n\nUse Tailwind utility classes.\nAvoid inline styles.\n",
);

console.log("Cleared. Ready to test: bun run init");

#!/usr/bin/env bun
import { $ } from "bun";
import { join } from "path";

const ROOT = join(import.meta.dir, "..");
const TEST_CONFIG = join(ROOT, "test-config");

// Remove everything — generated outputs + .oneagent
await $`rm -rf CLAUDE.md AGENTS.md .windsurfrules .cursorrules .claude .cursor .windsurf .opencode .github .agents opencode.json .oneagent skills-lock.json`.cwd(ROOT);

// Copy test-config contents into project root
await $`cp -a ${TEST_CONFIG}/. ${ROOT}/`;

// Install skills (symlinks can't be stored in test-config, so we install fresh)
const lockPath = join(ROOT, "skills-lock.json");
const lock = await Bun.file(lockPath).json() as { skills: Record<string, { source: string }> };

for (const [skill, { source }] of Object.entries(lock.skills)) {
  await $`npx skills add https://github.com/${source} --skill ${skill} --agent universal --yes`.cwd(ROOT).quiet();
  console.log(`  Installed skill: ${skill}`);
}

console.log("Cleared. Ready to test: bun run init");

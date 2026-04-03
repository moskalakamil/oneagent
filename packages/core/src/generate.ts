import path from "path";
import type { Config, DetectedFile } from "./types.ts";
import { activeTargets } from "./config.ts";
import { readRules } from "./rules.ts";
import { buildMainSymlinks, buildRulesSymlinks, buildSkillSymlinks, buildCommandSymlinks, buildAgentsDirSymlinks, createAllSymlinks, migrateRuleAndSkillFiles } from "./symlinks.ts";
import { buildCopilotRulesSymlinks } from "./copilot.ts";
import { writeOpencode } from "./opencode.ts";
import { readDetectedFile } from "./detect.ts";

export interface GenerateCollisions {
  mainFiles: DetectedFile[];
  ruleSkillFiles: DetectedFile[];
}

export async function detectGenerateCollisions(root: string, config: Config): Promise<GenerateCollisions> {
  const rules = await readRules(root);
  const targets = activeTargets(config);

  // 1. Main instruction file symlinks (CLAUDE.md, AGENTS.md, .windsurfrules, etc.)
  const mainEntries = buildMainSymlinks(root, targets);
  // 2. Rule/skill/command symlink paths (including per-file copilot rule symlinks)
  const ruleSkillEntries = [
    ...buildRulesSymlinks(root, targets),
    ...buildSkillSymlinks(root, targets),
    ...buildCommandSymlinks(root, targets),
    ...(targets.includes("copilot") ? buildCopilotRulesSymlinks(root, rules) : []),
    // .agents/skills skipped — handled by migrateAgentsSkillsDir
  ];

  const [mainCollisions, ruleSkillCollisions] = await Promise.all([
    Promise.all(mainEntries.map((entry) => readDetectedFile(root, path.relative(root, entry.symlinkPath))))
      .then((files) => files.filter((f): f is DetectedFile => f !== null)),
    Promise.all(ruleSkillEntries.map((entry) => readDetectedFile(root, path.relative(root, entry.symlinkPath))))
      .then((files) => files.filter((f): f is DetectedFile => f !== null)),
  ]);

  return {
    mainFiles: mainCollisions,
    ruleSkillFiles: ruleSkillCollisions,
  };
}

export async function generate(root: string, config: Config): Promise<void> {
  const rules = await readRules(root);
  const targets = activeTargets(config);

  await migrateRuleAndSkillFiles(root);

  const mainSymlinks = buildMainSymlinks(root, targets);
  const rulesSymlinks = buildRulesSymlinks(root, targets);
  const skillSymlinks = buildSkillSymlinks(root, targets);
  const commandSymlinks = buildCommandSymlinks(root, targets);
  const copilotRulesSymlinks = targets.includes("copilot") ? buildCopilotRulesSymlinks(root, rules) : [];
  await createAllSymlinks([...mainSymlinks, ...rulesSymlinks, ...skillSymlinks, ...commandSymlinks, ...copilotRulesSymlinks, ...buildAgentsDirSymlinks(root)]);

  if (targets.includes("opencode")) {
    await writeOpencode(root, rules);
  }
}

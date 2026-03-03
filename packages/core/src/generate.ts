import path from "path";
import fs from "fs/promises";
import type { Config, DetectedFile } from "./types.ts";
import { activeTargets } from "./config.ts";
import { readRules } from "./rules.ts";
import { readSkills } from "./skills.ts";
import { buildMainSymlinks, buildRulesSymlinks, buildSkillSymlinks, buildAgentsDirSymlinks, createAllSymlinks, migrateRuleAndSkillFiles } from "./symlinks.ts";
import { buildCopilotContent, copilotFilePath, buildCopilotPromptContent, copilotPromptFilePath, generateCopilotRules, generateCopilotSkills } from "./copilot.ts";
import { writeOpencode } from "./opencode.ts";
import { readDetectedFile } from "./detect.ts";

export interface GenerateCollisions {
  mainFiles: DetectedFile[];
  ruleSkillFiles: DetectedFile[];
}

export async function detectGenerateCollisions(root: string, config: Config): Promise<GenerateCollisions> {
  const [rules, skills] = await Promise.all([readRules(root), readSkills(root)]);
  const targets = activeTargets(config);

  // 1. Main instruction file symlinks (CLAUDE.md, AGENTS.md, .windsurfrules, etc.)
  const mainEntries = buildMainSymlinks(root, targets);
  // 2. Rule/skill symlink paths
  const ruleSkillEntries = [
    ...buildRulesSymlinks(root, targets, rules),
    ...buildSkillSymlinks(root, targets),
    // .agents/skills skipped — handled by migrateAgentsSkillsDir
  ];

  const [mainCollisions, ruleSkillSymlinkCollisions] = await Promise.all([
    Promise.all(mainEntries.map((entry) => readDetectedFile(root, path.relative(root, entry.symlinkPath))))
      .then((files) => files.filter((f): f is DetectedFile => f !== null)),
    Promise.all(ruleSkillEntries.map((entry) => readDetectedFile(root, path.relative(root, entry.symlinkPath))))
      .then((files) => files.filter((f): f is DetectedFile => f !== null)),
  ]);

  // 3. Copilot generated files — collision only if content differs (idempotent-safe)
  const copilotCollisions: DetectedFile[] = [];
  if (targets.includes("copilot")) {
    const checks = await Promise.all([
      ...rules.map(async (rule): Promise<DetectedFile | null> => {
        const filePath = copilotFilePath(root, rule.name);
        try {
          const content = await fs.readFile(filePath, "utf-8");
          if (content === buildCopilotContent(rule)) return null;
          const stat = await fs.lstat(filePath);
          return { relativePath: path.relative(root, filePath), absolutePath: filePath, sizeBytes: stat.size, modifiedAt: stat.mtime, content };
        } catch { return null; }
      }),
      ...skills.map(async (skill): Promise<DetectedFile | null> => {
        const filePath = copilotPromptFilePath(root, skill.name);
        try {
          const content = await fs.readFile(filePath, "utf-8");
          if (content === buildCopilotPromptContent(skill)) return null;
          const stat = await fs.lstat(filePath);
          return { relativePath: path.relative(root, filePath), absolutePath: filePath, sizeBytes: stat.size, modifiedAt: stat.mtime, content };
        } catch { return null; }
      }),
    ]);
    copilotCollisions.push(...checks.filter((c): c is DetectedFile => c !== null));
  }

  return {
    mainFiles: mainCollisions,
    ruleSkillFiles: [...ruleSkillSymlinkCollisions, ...copilotCollisions],
  };
}

export async function generate(root: string, config: Config): Promise<void> {
  const [rules, skills] = await Promise.all([readRules(root), readSkills(root)]);
  const targets = activeTargets(config);

  await migrateRuleAndSkillFiles(root);

  const mainSymlinks = buildMainSymlinks(root, targets);
  const rulesSymlinks = buildRulesSymlinks(root, targets, rules);
  const skillSymlinks = await buildSkillSymlinks(root, targets);
  await createAllSymlinks([...mainSymlinks, ...rulesSymlinks, ...skillSymlinks, ...buildAgentsDirSymlinks(root)]);

  if (targets.includes("copilot")) {
    await Promise.all([generateCopilotRules(root, rules), generateCopilotSkills(root, skills)]);
  }

  if (targets.includes("opencode")) {
    await writeOpencode(root, rules);
  }
}

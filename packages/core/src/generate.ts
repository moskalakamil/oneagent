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

export async function detectGenerateCollisions(root: string, config: Config): Promise<DetectedFile[]> {
  const [rules, skills] = await Promise.all([readRules(root), readSkills(root)]);
  const targets = activeTargets(config);

  // 1. Symlink paths — real non-dotai files are collisions
  const symlinkEntries = [
    ...buildMainSymlinks(root, targets),
    ...buildRulesSymlinks(root, targets, rules),
    ...buildSkillSymlinks(root, targets, skills),
    // .agents/skills skipped — handled by migrateAgentsSkillsDir
  ];

  const symlinkCollisions = (
    await Promise.all(
      symlinkEntries.map((entry) =>
        readDetectedFile(root, path.relative(root, entry.symlinkPath))
      )
    )
  ).filter((f): f is DetectedFile => f !== null);

  // 2. Copilot generated files — collision only if content differs (idempotent-safe)
  const copilotCollisions: DetectedFile[] = [];
  if (targets.includes("copilot")) {
    const checks = await Promise.all([
      ...rules.map(async (rule): Promise<DetectedFile | null> => {
        const filePath = copilotFilePath(root, rule.name);
        try {
          const content = await Bun.file(filePath).text();
          if (content === buildCopilotContent(rule)) return null;
          const stat = await fs.lstat(filePath);
          return { relativePath: path.relative(root, filePath), absolutePath: filePath, sizeBytes: stat.size, modifiedAt: stat.mtime, content };
        } catch { return null; }
      }),
      ...skills.map(async (skill): Promise<DetectedFile | null> => {
        const filePath = copilotPromptFilePath(root, skill.name);
        try {
          const content = await Bun.file(filePath).text();
          if (content === buildCopilotPromptContent(skill)) return null;
          const stat = await fs.lstat(filePath);
          return { relativePath: path.relative(root, filePath), absolutePath: filePath, sizeBytes: stat.size, modifiedAt: stat.mtime, content };
        } catch { return null; }
      }),
    ]);
    copilotCollisions.push(...checks.filter((c): c is DetectedFile => c !== null));
  }

  return [...symlinkCollisions, ...copilotCollisions];
}

export async function generate(root: string, config: Config): Promise<void> {
  const [rules, skills] = await Promise.all([readRules(root), readSkills(root)]);
  const targets = activeTargets(config);

  const mainSymlinks = buildMainSymlinks(root, targets);
  const rulesSymlinks = buildRulesSymlinks(root, targets, rules);
  const skillSymlinks = buildSkillSymlinks(root, targets, skills);
  await migrateRuleAndSkillFiles(root);
  await createAllSymlinks([...mainSymlinks, ...rulesSymlinks, ...skillSymlinks, ...buildAgentsDirSymlinks(root)]);

  if (targets.includes("copilot")) {
    await Promise.all([generateCopilotRules(root, rules), generateCopilotSkills(root, skills)]);
  }

  if (targets.includes("opencode")) {
    await writeOpencode(root, rules);
  }
}

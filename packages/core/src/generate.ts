import type { Config } from "./types.ts";
import { readRules } from "./rules.ts";
import { readSkills } from "./skills.ts";
import { buildMainSymlinks, buildRulesSymlinks, buildSkillSymlinks, createAllSymlinks } from "./symlinks.ts";
import { generateCopilotRules, generateCopilotSkills } from "./copilot.ts";
import { writeOpencode } from "./opencode.ts";

export async function generate(root: string, config: Config): Promise<void> {
  const [rules, skills] = await Promise.all([readRules(root), readSkills(root)]);

  const mainSymlinks = buildMainSymlinks(root, config.targets);
  const rulesSymlinks = buildRulesSymlinks(root, config.targets, rules);
  const skillSymlinks = buildSkillSymlinks(root, config.targets, skills);
  await createAllSymlinks([...mainSymlinks, ...rulesSymlinks, ...skillSymlinks]);

  if (config.targets.includes("copilot")) {
    await Promise.all([generateCopilotRules(root, rules), generateCopilotSkills(root, skills)]);
  }

  if (config.targets.includes("opencode")) {
    await writeOpencode(root, rules);
  }
}

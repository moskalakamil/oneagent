import type { Config } from "./types.ts";
import { activeTargets } from "./config.ts";
import { readRules } from "./rules.ts";
import { readSkills } from "./skills.ts";
import { buildMainSymlinks, buildRulesSymlinks, buildSkillSymlinks, buildAgentsDirSymlinks, createAllSymlinks } from "./symlinks.ts";
import { generateCopilotRules, generateCopilotSkills } from "./copilot.ts";
import { writeOpencode } from "./opencode.ts";

export async function generate(root: string, config: Config): Promise<void> {
  const [rules, skills] = await Promise.all([readRules(root), readSkills(root)]);
  const targets = activeTargets(config);

  const mainSymlinks = buildMainSymlinks(root, targets);
  const rulesSymlinks = buildRulesSymlinks(root, targets, rules);
  const skillSymlinks = buildSkillSymlinks(root, targets, skills);
  await createAllSymlinks([...mainSymlinks, ...rulesSymlinks, ...skillSymlinks, ...buildAgentsDirSymlinks(root)]);

  if (targets.includes("copilot")) {
    await Promise.all([generateCopilotRules(root, rules), generateCopilotSkills(root, skills)]);
  }

  if (targets.includes("opencode")) {
    await writeOpencode(root, rules);
  }
}

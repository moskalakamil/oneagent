import type { Config } from "./types.ts";
import { readRules } from "./rules.ts";
import { buildMainSymlinks, buildRulesSymlinks, createAllSymlinks } from "./symlinks.ts";
import { generateCopilotRules } from "./copilot.ts";
import { writeOpencode } from "./opencode.ts";

export async function generate(root: string, config: Config): Promise<void> {
  const rules = await readRules(root);

  const mainSymlinks = buildMainSymlinks(root, config.targets);
  const rulesSymlinks = buildRulesSymlinks(root, config.targets, rules);
  await createAllSymlinks([...mainSymlinks, ...rulesSymlinks]);

  if (config.targets.includes("copilot")) {
    await generateCopilotRules(root, rules);
  }

  if (config.targets.includes("opencode")) {
    await writeOpencode(root, rules);
  }
}

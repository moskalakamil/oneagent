import type { Config, OpenCodeCheck, StatusResult } from "./types.ts";
import { activeTargets } from "./config.ts";
import { ONEAGENT_DIR } from "./constants.ts";
import { readRules } from "./rules.ts";
import { buildMainSymlinks, buildRulesSymlinks, buildSkillSymlinks, buildCommandSymlinks, buildAgentsDirSymlinks, checkSymlink } from "./symlinks.ts";
import { buildCopilotRulesSymlinks } from "./copilot.ts";
import { readOpencode } from "./opencode.ts";

export async function checkOpencodeStatus(
  root: string,
): Promise<OpenCodeCheck> {
  const existing = await readOpencode(root);
  if (!existing) return { exists: false, valid: false };
  return { exists: true, valid: existing["instructions"] === `${ONEAGENT_DIR}/instructions.md` };
}

export async function checkStatus(root: string, config: Config): Promise<StatusResult> {
  const rules = await readRules(root);
  const targets = activeTargets(config);

  const allEntries = [
    ...buildMainSymlinks(root, targets),
    ...buildRulesSymlinks(root, targets),
    ...buildSkillSymlinks(root, targets),
    ...buildCommandSymlinks(root, targets),
    ...(targets.includes("copilot") ? buildCopilotRulesSymlinks(root, rules) : []),
    ...buildAgentsDirSymlinks(root),
  ];

  const symlinks = await Promise.all(allEntries.map(checkSymlink));
  const opencode = await checkOpencodeStatus(root);

  return { symlinks, opencode };
}

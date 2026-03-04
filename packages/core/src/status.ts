import fs from "fs/promises";
import type { Config, GeneratedFileCheck, OpenCodeCheck, RuleFile, StatusResult } from "./types.ts";
import { activeTargets } from "./config.ts";
import { readRules } from "./rules.ts";
import { readSkills } from "./skills.ts";
import { buildMainSymlinks, buildRulesSymlinks, buildSkillSymlinks, buildCommandSymlinks, buildAgentsDirSymlinks, checkSymlink } from "./symlinks.ts";
import { buildCopilotPromptContent, copilotFilePath, copilotPromptFilePath } from "./copilot.ts";
import { readOpencode } from "./opencode.ts";

export async function checkGeneratedFile(root: string, rule: RuleFile): Promise<GeneratedFileCheck> {
  const filePath = copilotFilePath(root, rule.name);
  try {
    const [source, dest] = await Promise.all([
      fs.readFile(rule.path, "utf-8"),
      fs.readFile(filePath, "utf-8"),
    ]);
    return { path: filePath, exists: true, upToDate: source === dest };
  } catch {
    return { path: filePath, exists: false, upToDate: false };
  }
}

export async function checkOpencodeStatus(
  root: string,
  _rules: RuleFile[],
): Promise<OpenCodeCheck> {
  const existing = await readOpencode(root);
  if (!existing) return { exists: false, valid: false };
  return { exists: true, valid: existing["instructions"] === ".oneagent/instructions.md" };
}

export async function checkCopilotPrompt(root: string, skill: import("./types.ts").SkillFile): Promise<GeneratedFileCheck> {
  const filePath = copilotPromptFilePath(root, skill.name);
  const expected = buildCopilotPromptContent(skill);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return { path: filePath, exists: true, upToDate: content === expected };
  } catch {
    return { path: filePath, exists: false, upToDate: false };
  }
}

export async function checkStatus(root: string, config: Config): Promise<StatusResult> {
  const [rules, skills] = await Promise.all([readRules(root), readSkills(root)]);
  const targets = activeTargets(config);

  const allEntries = [
    ...buildMainSymlinks(root, targets),
    ...buildRulesSymlinks(root, targets),
    ...buildSkillSymlinks(root, targets),
    ...buildCommandSymlinks(root, targets),
    ...buildAgentsDirSymlinks(root),
  ];

  const symlinks = await Promise.all(allEntries.map(checkSymlink));

  const generatedFiles = targets.includes("copilot")
    ? await Promise.all([
        ...rules.map((rule) => checkGeneratedFile(root, rule)),
        ...skills.map((skill) => checkCopilotPrompt(root, skill)),
      ])
    : [];

  const opencode = await checkOpencodeStatus(root, rules);

  return { symlinks, generatedFiles, opencode };
}

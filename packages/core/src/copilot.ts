import path from "path";
import fs from "fs/promises";
import type { RuleFile, SkillFile } from "./types.ts";

export function buildCopilotContent(rule: RuleFile): string {
  return `---\napplyTo: "${rule.applyTo}"\n---\n${rule.content}`;
}

export function copilotFilePath(root: string, ruleName: string): string {
  return path.join(root, ".github/instructions", `${ruleName}.instructions.md`);
}

export async function generateCopilotRule(root: string, rule: RuleFile): Promise<void> {
  const filePath = copilotFilePath(root, rule.name);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await Bun.write(filePath, buildCopilotContent(rule));
}

export async function generateCopilotRules(root: string, rules: RuleFile[]): Promise<void> {
  await Promise.all(rules.map((rule) => generateCopilotRule(root, rule)));
}

export function buildCopilotPromptContent(skill: SkillFile): string {
  const lines = ["---", `mode: "${skill.mode}"`];
  if (skill.description) lines.push(`description: "${skill.description}"`);
  lines.push("---", skill.content);
  return lines.join("\n");
}

export function copilotPromptFilePath(root: string, skillName: string): string {
  return path.join(root, ".github/prompts", `${skillName}.prompt.md`);
}

export async function generateCopilotSkill(root: string, skill: SkillFile): Promise<void> {
  const filePath = copilotPromptFilePath(root, skill.name);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await Bun.write(filePath, buildCopilotPromptContent(skill));
}

export async function generateCopilotSkills(root: string, skills: SkillFile[]): Promise<void> {
  await Promise.all(skills.map((skill) => generateCopilotSkill(root, skill)));
}

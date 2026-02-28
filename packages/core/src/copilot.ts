import path from "path";
import fs from "fs/promises";
import type { RuleFile } from "./types.ts";

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

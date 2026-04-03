import path from "path";
import type { RuleFile, SymlinkEntry } from "./types.ts";
import { ONEAGENT_DIR } from "./constants.ts";

export function copilotFilePath(root: string, ruleName: string): string {
  return path.join(root, ".github/instructions", `${ruleName}.instructions.md`);
}

export function buildCopilotRulesSymlinks(root: string, rules: RuleFile[]): SymlinkEntry[] {
  return rules.map((rule) => {
    const symlinkPath = copilotFilePath(root, rule.name);
    const targetAbs = path.join(root, ONEAGENT_DIR, "rules", `${rule.name}.md`);
    const target = path.relative(path.dirname(symlinkPath), targetAbs);
    return { symlinkPath, target, label: path.relative(root, symlinkPath) };
  });
}

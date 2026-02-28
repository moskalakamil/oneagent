import path from "path";
import fs from "fs/promises";
import type { RuleFile } from "./types.ts";

export function parseFrontmatter(raw: string): { applyTo: string; content: string } {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { applyTo: "**", content: raw };

  const frontmatter = match[1] ?? "";
  const content = match[2] ?? "";

  const applyToMatch = frontmatter.match(/applyTo:\s*["']?([^"'\n]+)["']?/);
  const applyTo = applyToMatch?.[1]?.trim() ?? "**";

  return { applyTo, content };
}

export async function readRuleFile(filePath: string): Promise<RuleFile> {
  const raw = await Bun.file(filePath).text();
  const { applyTo, content } = parseFrontmatter(raw);
  return { name: path.basename(filePath, ".md"), path: filePath, applyTo, content };
}

export async function readRules(root: string): Promise<RuleFile[]> {
  const rulesDir = path.join(root, ".oneagent/rules");
  try {
    const files = await fs.readdir(rulesDir);
    const mdFiles = files.filter((f) => f.endsWith(".md"));
    const rules = await Promise.all(mdFiles.map((f) => readRuleFile(path.join(rulesDir, f))));
    return rules.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

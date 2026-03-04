import path from "path";
import fs from "fs/promises";
import type { RuleFile } from "./types.ts";

export async function readRules(root: string): Promise<RuleFile[]> {
  const rulesDir = path.join(root, ".oneagent/rules");
  try {
    const files = await fs.readdir(rulesDir);
    return files
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({ name: path.basename(f, ".md"), path: path.join(rulesDir, f) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

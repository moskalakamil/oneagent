import path from "path";
import type { RuleFile } from "./types.ts";

export async function readOpencode(root: string): Promise<Record<string, unknown> | null> {
  try {
    const content = await Bun.file(path.join(root, "opencode.json")).text();
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function buildOpencodeConfig(existing: Record<string, unknown> | null): object {
  return {
    ...existing,
    instructions: ".oneagent/instructions.md",
  };
}

export async function writeOpencode(root: string, _rules: RuleFile[]): Promise<void> {
  const existing = await readOpencode(root);
  const config = buildOpencodeConfig(existing);
  await Bun.write(path.join(root, "opencode.json"), JSON.stringify(config, null, 2) + "\n");
}

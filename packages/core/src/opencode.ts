import path from "path";
import fs from "fs/promises";
import type { RuleFile } from "./types.ts";

export async function readOpencode(root: string): Promise<Record<string, unknown> | null> {
  try {
    const content = await fs.readFile(path.join(root, "opencode.json"), "utf-8");
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

export async function addOpenCodePlugin(root: string, id: string): Promise<void> {
  const filePath = path.join(root, "opencode.json");
  let existing: Record<string, unknown>;
  try {
    existing = JSON.parse(await fs.readFile(filePath, "utf-8")) as Record<string, unknown>;
  } catch {
    return; // no opencode.json — no-op
  }
  const current = Array.isArray(existing.plugin) ? (existing.plugin as string[]) : [];
  if (current.includes(id)) return;
  existing.plugin = [...current, id];
  await fs.writeFile(filePath, JSON.stringify(existing, null, 2) + "\n");
}

export async function writeOpencode(root: string, _rules: RuleFile[]): Promise<void> {
  const existing = await readOpencode(root);
  const config = buildOpencodeConfig(existing);
  await fs.writeFile(path.join(root, "opencode.json"), JSON.stringify(config, null, 2) + "\n");
}

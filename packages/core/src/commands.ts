import path from "path";
import fs from "fs/promises";
import type { CommandFile } from "./types.ts";

export async function readCommands(root: string): Promise<CommandFile[]> {
  const commandsDir = path.join(root, ".oneagent/commands");
  try {
    const files = await fs.readdir(commandsDir);
    return files
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({ name: path.basename(f, ".md"), path: path.join(commandsDir, f) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

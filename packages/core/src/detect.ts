import path from "path";
import fs from "fs/promises";
import type { DetectedFile } from "./types.ts";
import { AGENT_DEFINITIONS } from "./agents.ts";

export const AGENT_FILES = [
  "CLAUDE.md",
  "AGENTS.md",
  ".cursorrules",
  ".windsurfrules",
  ".github/copilot-instructions.md",
];

export async function readDetectedFile(root: string, rel: string): Promise<DetectedFile | null> {
  const absolutePath = path.join(root, rel);

  try {
    const stat = await fs.lstat(absolutePath);

    if (stat.isSymbolicLink()) {
      const linkTarget = await fs.readlink(absolutePath);
      const resolved = path.resolve(path.dirname(absolutePath), linkTarget);
      if (resolved.startsWith(path.join(root, ".one"))) return null;
    }

    const content = await fs.readFile(absolutePath, "utf-8");
    return {
      relativePath: rel,
      absolutePath,
      sizeBytes: stat.size,
      modifiedAt: stat.mtime,
      content,
    };
  } catch {
    return null;
  }
}

export async function detectExistingFiles(root: string): Promise<DetectedFile[]> {
  const results = await Promise.all(AGENT_FILES.map((rel) => readDetectedFile(root, rel)));
  return results.filter((f): f is DetectedFile => f !== null);
}

export function filesHaveSameContent(files: DetectedFile[]): boolean {
  if (files.length <= 1) return true;
  const first = files[0]!.content;
  return files.every((f) => f.content === first);
}

const DEPRECATED_FILES = AGENT_DEFINITIONS.flatMap((d) => d.deprecatedFiles ?? []);

export async function removeDeprecatedFiles(root: string): Promise<void> {
  for (const rel of DEPRECATED_FILES) {
    const absPath = path.join(root, rel);
    try {
      const stat = await fs.lstat(absPath);
      if (!stat.isSymbolicLink()) await fs.unlink(absPath);
    } catch {
      // doesn't exist — no-op
    }
  }
}

export async function detectDeprecatedCommandFiles(root: string): Promise<string[]> {
  const commandsDir = path.join(root, ".claude/commands");
  try {
    const entries = await fs.readdir(commandsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile())
      .map((e) => path.join(".claude/commands", e.name));
  } catch {
    return [];
  }
}

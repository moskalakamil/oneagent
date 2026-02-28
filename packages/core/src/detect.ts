import path from "path";
import fs from "fs/promises";
import type { DetectedFile } from "./types.ts";

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

    const content = await Bun.file(absolutePath).text();
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

import path from "path";
import fs from "fs/promises";
import type { AgentTarget, RuleFile, SymlinkCheck, SymlinkEntry } from "./types.ts";

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function createSymlink(symlinkPath: string, target: string): Promise<void> {
  await ensureDir(path.dirname(symlinkPath));
  try {
    await fs.unlink(symlinkPath);
  } catch {
    // file doesn't exist — that's fine
  }
  await fs.symlink(target, symlinkPath);
}

function relativeTarget(symlinkPath: string, targetAbsPath: string): string {
  return path.relative(path.dirname(symlinkPath), targetAbsPath);
}

export function buildMainSymlinks(root: string, targets: AgentTarget[]): SymlinkEntry[] {
  const instructionsAbs = path.join(root, ".oneagent/instructions.md");
  const seen = new Map<string, SymlinkEntry>();

  for (const target of targets) {
    let symlinkPath: string;

    switch (target) {
      case "claude":
        symlinkPath = path.join(root, "CLAUDE.md");
        break;
      case "cursor":
        symlinkPath = path.join(root, "AGENTS.md");
        break;
      case "windsurf":
        symlinkPath = path.join(root, ".windsurfrules");
        break;
      case "opencode":
        symlinkPath = path.join(root, "AGENTS.md");
        break;
      case "copilot":
        symlinkPath = path.join(root, ".github/copilot-instructions.md");
        break;
    }

    if (!seen.has(symlinkPath)) {
      seen.set(symlinkPath, {
        symlinkPath,
        target: relativeTarget(symlinkPath, instructionsAbs),
        label: path.relative(root, symlinkPath),
      });
    }
  }

  return Array.from(seen.values());
}

export function buildRulesSymlinks(
  root: string,
  targets: AgentTarget[],
  rules: RuleFile[],
): SymlinkEntry[] {
  const entries: SymlinkEntry[] = [];

  for (const target of targets) {
    let rulesDir: string | null = null;

    switch (target) {
      case "claude":
        rulesDir = path.join(root, ".claude/rules");
        break;
      case "cursor":
        rulesDir = path.join(root, ".cursor/rules");
        break;
      case "windsurf":
        rulesDir = path.join(root, ".windsurf/rules");
        break;
      case "opencode":
      case "copilot":
        rulesDir = null;
        break;
    }

    if (!rulesDir) continue;

    for (const rule of rules) {
      const symlinkPath = path.join(rulesDir, `${rule.name}.md`);
      entries.push({
        symlinkPath,
        target: relativeTarget(symlinkPath, rule.path),
        label: path.relative(root, symlinkPath),
      });
    }
  }

  return entries;
}

export async function createAllSymlinks(entries: SymlinkEntry[]): Promise<void> {
  await Promise.all(entries.map((e) => createSymlink(e.symlinkPath, e.target)));
}

export async function checkSymlink(entry: SymlinkEntry): Promise<SymlinkCheck> {
  try {
    const stat = await fs.lstat(entry.symlinkPath);
    if (!stat.isSymbolicLink()) {
      return { ...entry, exists: true, valid: false };
    }
    const linkTarget = await fs.readlink(entry.symlinkPath);
    return { ...entry, exists: true, valid: linkTarget === entry.target };
  } catch {
    return { ...entry, exists: false, valid: false };
  }
}

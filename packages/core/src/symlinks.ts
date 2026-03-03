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

export function buildRulesSymlinks(root: string, targets: AgentTarget[]): SymlinkEntry[] {
  const targetAbs = path.join(root, ".oneagent/rules");
  const agentDirs: Partial<Record<AgentTarget, string>> = {
    claude: path.join(root, ".claude/rules"),
    cursor: path.join(root, ".cursor/rules"),
    windsurf: path.join(root, ".windsurf/rules"),
  };

  return (Object.entries(agentDirs) as [AgentTarget, string][])
    .filter(([target]) => targets.includes(target))
    .map(([, dir]) => ({
      symlinkPath: dir,
      target: relativeTarget(dir, targetAbs),
      label: path.relative(root, dir),
    }));
}

// Creates whole-directory symlinks: .claude/skills → .oneagent/skills, .cursor/skills → .oneagent/skills
export function buildSkillSymlinks(root: string, targets: AgentTarget[]): SymlinkEntry[] {
  const targetAbs = path.join(root, ".oneagent/skills");
  const agentDirs: Partial<Record<AgentTarget, string>> = {
    claude: path.join(root, ".claude/skills"),
    cursor: path.join(root, ".cursor/skills"),
    windsurf: path.join(root, ".windsurf/skills"),
    copilot: path.join(root, ".github/skills"),
  };

  return (Object.entries(agentDirs) as [AgentTarget, string][])
    .filter(([target]) => targets.includes(target))
    .map(([, dir]) => ({
      symlinkPath: dir,
      target: relativeTarget(dir, targetAbs),
      label: path.relative(root, dir),
    }));
}

export function buildAgentsDirSymlinks(root: string): SymlinkEntry[] {
  const symlinkPath = path.join(root, ".agents/skills");
  const targetAbs = path.join(root, ".oneagent/skills");
  return [{ symlinkPath, target: relativeTarget(symlinkPath, targetAbs), label: ".agents/skills" }];
}

async function migrateFilesFromDir(srcDir: string, destDir: string, root: string): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });
  let entries: import("fs").Dirent[];
  try {
    entries = await fs.readdir(srcDir, { withFileTypes: true });
  } catch {
    return; // srcDir doesn't exist — no-op
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue; // skip symlinks and subdirs
    const srcFile = path.join(srcDir, entry.name);
    const destFile = path.join(destDir, entry.name);

    let destExists = false;
    try {
      await fs.access(destFile);
      destExists = true;
    } catch {
      // dest doesn't exist
    }

    if (destExists) {
      // dest exists — compare content before deleting source
      const [srcContent, destContent] = await Promise.all([
        fs.readFile(srcFile, "utf-8"),
        fs.readFile(destFile, "utf-8"),
      ]);
      if (srcContent !== destContent) {
        // Different content — backup source before deleting
        const backupDir = path.join(root, ".oneagent/backup");
        await fs.mkdir(backupDir, { recursive: true });
        const safeName = path.relative(root, srcFile).replace(/\//g, "_");
        await fs.writeFile(path.join(backupDir, safeName), srcContent);
      }
      await fs.unlink(srcFile); // safe to delete — dest has the content (or backup was created)
    } else {
      await fs.rename(srcFile, destFile);
    }
  }
}

async function migrateAndRemoveDir(src: string, dest: string, root: string): Promise<void> {
  let stat;
  try {
    stat = await fs.lstat(src);
  } catch {
    return; // doesn't exist — no-op
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) return;
  await migrateFilesFromDir(src, dest, root);
  await fs.rm(src, { recursive: true, force: true });
}

export async function migrateRuleAndSkillFiles(root: string): Promise<void> {
  const destRules = path.join(root, ".oneagent/rules");
  const destSkills = path.join(root, ".oneagent/skills");
  // Rules dirs: only individual files become symlinks, so we only move the files.
  // The directories themselves stay — generate() recreates per-file symlinks inside them.
  // Sequential to avoid same-name conflicts across dirs.
  await migrateFilesFromDir(path.join(root, ".cursor/rules"), destRules, root);
  await migrateFilesFromDir(path.join(root, ".claude/rules"), destRules, root);
  await migrateFilesFromDir(path.join(root, ".windsurf/rules"), destRules, root);
  // .agents/skills is different: the entire directory becomes a symlink to .oneagent/skills,
  // so the real directory must be removed first to make room for the symlink.
  await migrateAndRemoveDir(path.join(root, ".agents/skills"), destSkills, root);
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

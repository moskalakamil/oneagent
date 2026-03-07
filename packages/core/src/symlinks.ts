import path from "path";
import fs from "fs/promises";
import type { AgentTarget, SymlinkCheck, SymlinkEntry } from "./types.ts";
import { AGENT_DEFINITIONS } from "./agents.ts";

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function createSymlink(symlinkPath: string, target: string): Promise<void> {
  await ensureDir(path.dirname(symlinkPath));

  // Skip if already a correct symlink — avoids unnecessary rm/create that can
  // race with external filesystem watchers (e.g. Cursor IDE recreating .cursor/rules)
  try {
    const stat = await fs.lstat(symlinkPath);
    if (stat.isSymbolicLink() && (await fs.readlink(symlinkPath)) === target) return;
  } catch {
    // path doesn't exist — proceed
  }

  // Retry up to 3 times: external tools can recreate the path between our rm
  // and symlink calls, causing EEXIST and macOS conflict copies (e.g. "rules 2")
  for (let attempt = 0; attempt < 3; attempt++) {
    await fs.rm(symlinkPath, { recursive: true, force: true });
    try {
      await fs.symlink(target, symlinkPath);
      return;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST" || attempt === 2) throw err;
    }
  }
}

function relativeTarget(symlinkPath: string, targetAbsPath: string): string {
  return path.relative(path.dirname(symlinkPath), targetAbsPath);
}

export function buildMainSymlinks(root: string, targets: AgentTarget[]): SymlinkEntry[] {
  const instructionsAbs = path.join(root, ".oneagent/instructions.md");
  const seen = new Map<string, SymlinkEntry>();

  for (const target of targets) {
    const def = AGENT_DEFINITIONS.find((d) => d.target === target)!;
    const symlinkPath = path.join(root, def.mainFile);
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
  return AGENT_DEFINITIONS
    .filter((d) => targets.includes(d.target) && d.rulesDir)
    .map((d) => {
      const symlinkPath = path.join(root, d.rulesDir!);
      return { symlinkPath, target: relativeTarget(symlinkPath, targetAbs), label: d.rulesDir! };
    });
}

export function buildSkillSymlinks(root: string, targets: AgentTarget[]): SymlinkEntry[] {
  const targetAbs = path.join(root, ".oneagent/skills");
  return AGENT_DEFINITIONS
    .filter((d) => targets.includes(d.target) && d.skillsDir)
    .map((d) => {
      const symlinkPath = path.join(root, d.skillsDir!);
      return { symlinkPath, target: relativeTarget(symlinkPath, targetAbs), label: d.skillsDir! };
    });
}

export function buildCommandSymlinks(root: string, targets: AgentTarget[]): SymlinkEntry[] {
  const targetAbs = path.join(root, ".oneagent/commands");
  return AGENT_DEFINITIONS
    .filter((d) => targets.includes(d.target) && d.commandsDir)
    .map((d) => {
      const symlinkPath = path.join(root, d.commandsDir!);
      return { symlinkPath, target: relativeTarget(symlinkPath, targetAbs), label: d.commandsDir! };
    });
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
    const srcFile = path.join(srcDir, entry.name);
    const fileStat = await fs.lstat(srcFile);
    if (!fileStat.isFile()) continue; // only real files — skip symlinks and subdirs
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
  const destCommands = path.join(root, ".oneagent/commands");
  // Derive migration sources from agent definitions — sequential to avoid same-name conflicts.
  for (const def of AGENT_DEFINITIONS) {
    if (def.rulesDir) await migrateAndRemoveDir(path.join(root, def.rulesDir), destRules, root);
  }
  for (const def of AGENT_DEFINITIONS) {
    if (def.skillsDir) await migrateAndRemoveDir(path.join(root, def.skillsDir), destSkills, root);
  }
  // .agents/skills — standard skills.sh path, not represented in agent definitions
  await migrateAndRemoveDir(path.join(root, ".agents/skills"), destSkills, root);
  for (const def of AGENT_DEFINITIONS) {
    if (def.commandsDir) await migrateAndRemoveDir(path.join(root, def.commandsDir), destCommands, root);
  }
}

export async function createAllSymlinks(entries: SymlinkEntry[]): Promise<void> {
  // Deduplicate by symlink path — last entry wins
  const deduped = new Map<string, SymlinkEntry>();
  for (const e of entries) deduped.set(e.symlinkPath, e);
  for (const e of deduped.values()) {
    await createSymlink(e.symlinkPath, e.target);
  }
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

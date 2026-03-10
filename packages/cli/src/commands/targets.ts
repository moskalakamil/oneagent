import { defineCommand } from "citty";
import { outro, multiselect, spinner, note, log, isCancel } from "@clack/prompts";
import path from "path";
import fs from "fs/promises";
import {
  readConfig,
  writeConfig,
  makeTargets,
  activeTargets,
  generate,
  AGENT_DEFINITIONS,
  ONEAGENT_DIR,
  type AgentTarget,
} from "@moskala/oneagent-core";

function cancelAndExit(): never {
  outro("Cancelled.");
  process.exit(0);
}

async function detectPresentTargets(root: string): Promise<AgentTarget[]> {
  const results = await Promise.all(
    AGENT_DEFINITIONS.map(async (def) => {
      for (const indicator of def.detectIndicators) {
        try { await fs.access(path.join(root, indicator)); return def.target; } catch {}
      }
      return null;
    }),
  );
  return results.filter((t): t is AgentTarget => t !== null);
}

async function backupDirRecursive(srcDir: string, backupDir: string, prefix: string): Promise<void> {
  let entries: import("fs").Dirent[];
  try { entries = await fs.readdir(srcDir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const lstat = await fs.lstat(srcPath);
    if (lstat.isSymbolicLink()) continue;
    if (lstat.isDirectory()) {
      await backupDirRecursive(srcPath, backupDir, `${prefix}_${entry.name}`);
    } else if (lstat.isFile()) {
      await fs.mkdir(backupDir, { recursive: true });
      await fs.copyFile(srcPath, path.join(backupDir, `${prefix}_${entry.name}`));
    }
  }
}

async function cleanupRemovedTargets(root: string, removed: AgentTarget[]): Promise<void> {
  if (removed.length === 0) return;
  const backupDir = path.join(root, ONEAGENT_DIR, "backup");

  for (const target of removed) {
    const def = AGENT_DEFINITIONS.find((d) => d.target === target)!;

    const agentDir = [def.rulesDir, def.skillsDir, def.commandsDir]
      .filter(Boolean)
      .map((d) => d!.split("/")[0]!)
      .find((d) => d !== ".github");

    if (agentDir) {
      const agentDirAbs = path.join(root, agentDir);
      let stat;
      try { stat = await fs.lstat(agentDirAbs); } catch { /* doesn't exist */ }
      if (stat && stat.isDirectory() && !stat.isSymbolicLink()) {
        await backupDirRecursive(agentDirAbs, backupDir, agentDir);
        await fs.rm(agentDirAbs, { recursive: true, force: true });
      }
    }

    if (target === "opencode") {
      const opPath = path.join(root, "opencode.json");
      try {
        const content = await fs.readFile(opPath, "utf-8");
        await fs.mkdir(backupDir, { recursive: true });
        await fs.writeFile(path.join(backupDir, "opencode.json"), content);
      } catch { /* file doesn't exist */ }
      try { await fs.unlink(opPath); } catch {}
    }
  }
}

export default defineCommand({
  meta: {
    name: "targets",
    description: "Add or remove AI agent targets",
  },
  async run() {
    const root = process.cwd();

    let config;
    try {
      config = await readConfig(root);
    } catch {
      console.error(`Error: No ${ONEAGENT_DIR}/config.yml found. Run \`oneagent init\` first.`);
      process.exit(1);
    }

    const current = activeTargets(config);
    const presentTargets = await detectPresentTargets(root);

    // Merge: pre-select current configured targets + any newly detected ones
    const initialValues = [...new Set([...current, ...presentTargets])];

    note(
      current.map((t) => `  • ${AGENT_DEFINITIONS.find((d) => d.target === t)!.displayName}`).join("\n"),
      "Currently configured targets",
    );

    const result = await multiselect<AgentTarget>({
      message: `Which AI agents do you want to support?\n\x1b[90m · Space to toggle · Enter to confirm\x1b[39m`,
      options: AGENT_DEFINITIONS.map((d) => ({ value: d.target, label: d.displayName, hint: d.hint })),
      initialValues,
      required: true,
    });

    if (isCancel(result)) cancelAndExit();
    const selected = result as AgentTarget[];

    const removed = current.filter((t) => !selected.includes(t));
    const added = selected.filter((t) => !current.includes(t));

    if (removed.length === 0 && added.length === 0) {
      outro("No changes.");
      return;
    }

    const s = spinner();
    s.start("Updating targets...");

    if (removed.length > 0) {
      await cleanupRemovedTargets(root, removed);
    }

    config.targets = makeTargets(...selected);
    await writeConfig(root, config);
    await generate(root, config);

    s.stop("Done.");

    const lines = [
      ...(added.length > 0 ? [`Added: ${added.map((t) => AGENT_DEFINITIONS.find((d) => d.target === t)!.displayName).join(", ")}`] : []),
      ...(removed.length > 0 ? [`Removed: ${removed.map((t) => AGENT_DEFINITIONS.find((d) => d.target === t)!.displayName).join(", ")}`] : []),
    ];
    note(lines.map((l) => `  • ${l}`).join("\n"), "Targets updated");

    if (removed.length > 0) {
      log.info(`Removed agent files backed up to ${ONEAGENT_DIR}/backup/`);
    }

    outro("Run `oneagent status` to verify your setup.");
  },
});

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
  cleanupAgentDir,
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

    for (const target of removed) {
      await cleanupAgentDir(root, target);
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

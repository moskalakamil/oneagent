import { defineCommand } from "citty";
import { log, select, isCancel, outro } from "@clack/prompts";
import {
  readConfig,
  writeConfig,
  activeTargets,
  generate,
  cleanupAgentDir,
  AGENT_DEFINITIONS,
  ONEAGENT_DIR,
  ALL_AGENT_TARGETS,
  type AgentTarget,
} from "@moskala/oneagent-core";

export default defineCommand({
  meta: {
    name: "remove",
    description: "Remove an AI agent target",
  },
  args: {
    target: {
      type: "positional",
      description: "Agent to remove (claude, cursor, windsurf, opencode, copilot)",
      required: false,
    },
  },
  async run({ args }) {
    const root = process.cwd();

    let config;
    try {
      config = await readConfig(root);
    } catch {
      console.error(`Error: No ${ONEAGENT_DIR}/config.yml found. Run \`oneagent init\` first.`);
      process.exit(1);
    }

    const current = activeTargets(config);

    if (current.length === 1) {
      console.error("Cannot remove the last target. At least one agent must be configured.");
      process.exit(1);
    }

    let target: AgentTarget;

    if (args.target) {
      if (!ALL_AGENT_TARGETS.includes(args.target as AgentTarget)) {
        console.error(`Unknown target "${args.target}". Available: ${ALL_AGENT_TARGETS.join(", ")}`);
        process.exit(1);
      }
      target = args.target as AgentTarget;
      if (!current.includes(target)) {
        log.info(`${AGENT_DEFINITIONS.find((d) => d.target === target)!.displayName} is not configured.`);
        return;
      }
    } else {
      const result = await select<AgentTarget>({
        message: "Which agent do you want to remove?",
        options: current.map((t) => {
          const def = AGENT_DEFINITIONS.find((d) => d.target === t)!;
          return { value: t, label: def.displayName, hint: def.hint };
        }),
      });
      if (isCancel(result)) { outro("Cancelled."); process.exit(0); }
      target = result as AgentTarget;
    }

    await cleanupAgentDir(root, target);

    config.targets[target] = false;
    await writeConfig(root, config);
    await generate(root, config);

    log.success(`Removed ${AGENT_DEFINITIONS.find((d) => d.target === target)!.displayName}`);
    log.info(`Files backed up to ${ONEAGENT_DIR}/backup/`);
  },
});

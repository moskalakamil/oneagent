import { parse, stringify } from "yaml";
import path from "path";
import fs from "fs/promises";
import type { AgentTarget, Config } from "./types.ts";

const CONFIG_REL = ".oneagent/config.yml";

export const ALL_AGENT_TARGETS: AgentTarget[] = ["claude", "cursor", "windsurf", "opencode", "copilot"];

export function activeTargets(config: Config): AgentTarget[] {
  return ALL_AGENT_TARGETS.filter((t) => config.targets[t]);
}

export function makeTargets(...enabled: AgentTarget[]): Record<AgentTarget, boolean> {
  return Object.fromEntries(ALL_AGENT_TARGETS.map((t) => [t, enabled.includes(t)])) as Record<AgentTarget, boolean>;
}

export async function configExists(root: string): Promise<boolean> {
  return fs.access(path.join(root, CONFIG_REL)).then(() => true, () => false);
}

export async function readConfig(root: string): Promise<Config> {
  const content = await fs.readFile(path.join(root, CONFIG_REL), "utf-8");
  return parse(content) as Config;
}

export async function writeConfig(root: string, config: Config): Promise<void> {
  const filePath = path.join(root, CONFIG_REL);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, stringify(config));
}

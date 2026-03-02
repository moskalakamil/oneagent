import { parse, stringify } from "yaml";
import path from "path";
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
  return Bun.file(path.join(root, CONFIG_REL)).exists();
}

export async function readConfig(root: string): Promise<Config> {
  const content = await Bun.file(path.join(root, CONFIG_REL)).text();
  return parse(content) as Config;
}

export async function writeConfig(root: string, config: Config): Promise<void> {
  const filePath = path.join(root, CONFIG_REL);
  await Bun.write(filePath, stringify(config));
}

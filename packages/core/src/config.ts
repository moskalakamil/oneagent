import { parse, stringify } from "yaml";
import path from "path";
import type { Config } from "./types.ts";

const CONFIG_REL = ".oneagent/config.yml";

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

import { defineCommand } from "citty";
import { spinner } from "@clack/prompts";
import { readConfig, generate } from "@moskala/oneagent-core";

export default defineCommand({
  meta: {
    name: "generate",
    description: "Generate symlinks and agent-specific files",
  },
  async run() {
    const root = process.cwd();

    let config;
    try {
      config = await readConfig(root);
    } catch {
      console.error("Error: No .oneagent/config.yml found. Run `oneagent init` first.");
      process.exit(1);
    }

    const s = spinner();
    s.start("Generating...");

    try {
      await generate(root, config);
      s.stop("Generated successfully.");
    } catch (error) {
      s.stop("Generation failed.");
      console.error(error);
      process.exit(1);
    }
  },
});

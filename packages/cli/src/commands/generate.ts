import { defineCommand } from "citty";
import { confirm, isCancel, note, outro, spinner } from "@clack/prompts";
import { readConfig, generate, detectGenerateCollisions, migrateRuleAndSkillFiles } from "@moskala/oneagent-core";

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

    const collisions = await detectGenerateCollisions(root, config);
    if (collisions.length > 0) {
      note(
        collisions.map((f) => `  • ${f.relativePath}`).join("\n"),
        "These files are not dotai symlinks",
      );
      const proceed = await confirm({
        message: "Move rule/skill files to .oneagent/ and replace all with symlinks?",
      });
      if (isCancel(proceed) || !proceed) {
        outro("Aborted.");
        process.exit(0);
      }
      await migrateRuleAndSkillFiles(root);
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

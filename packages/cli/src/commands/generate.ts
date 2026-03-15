import path from "path";
import fs from "fs/promises";
import { defineCommand } from "citty";
import { confirm, isCancel, note, outro, spinner } from "@clack/prompts";
import { readConfig, generate, detectGenerateCollisions, migrateRuleAndSkillFiles, ONEAGENT_DIR } from "@moskala/oneagent-core";

export default defineCommand({
  meta: {
    name: "generate",
    description: "Generate symlinks and agent-specific files",
  },
  args: {
    yes: {
      type: "boolean",
      alias: "y",
      description: "Skip confirmation prompts and auto-migrate colliding files",
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

    const { mainFiles, ruleSkillFiles } = await detectGenerateCollisions(root, config);

    // Auto-backup main instruction files (CLAUDE.md, AGENTS.md, etc.) — no prompt
    if (mainFiles.length > 0) {
      const backupDir = path.join(root, ONEAGENT_DIR, "backup");
      await fs.mkdir(backupDir, { recursive: true });
      for (const file of mainFiles) {
        const safeName = file.relativePath.replace(/\//g, "_");
        await fs.writeFile(path.join(backupDir, safeName), file.content);
      }
    }

    // Prompt only for rule/skill files
    if (ruleSkillFiles.length > 0) {
      if (args.yes) {
        await migrateRuleAndSkillFiles(root);
      } else {
        note(
          ruleSkillFiles.map((f) => `  • ${f.relativePath}`).join("\n"),
          "These rule/skill files are not oneagent symlinks",
        );
        const proceed = await confirm({
          message: `Move them to ${ONEAGENT_DIR}/ and replace with symlinks?`,
        });
        if (isCancel(proceed) || !proceed) {
          outro("Aborted.");
          process.exit(0);
        }
        await migrateRuleAndSkillFiles(root);
      }
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

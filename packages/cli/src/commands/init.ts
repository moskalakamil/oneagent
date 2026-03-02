import { defineCommand } from "citty";
import {
  intro,
  outro,
  confirm,
  multiselect,
  select,
  spinner,
  note,
  isCancel,
} from "@clack/prompts";
import path from "path";
import fs from "fs/promises";
import { timeAgo, warnDeprecatedCommandFiles } from "../utils.ts";
import {
  configExists,
  writeConfig,
  makeTargets,
  detectExistingFiles,
  filesHaveSameContent,
  generate,
  migrateRuleAndSkillFiles,
  removeDeprecatedFiles,
  type AgentTarget,
  type Config,
  type DetectedFile,
} from "@moskala/oneagent-core";

const DOTAI_META_RULE = `---
applyTo: "**"
---
# oneagent

This project uses [oneagent](https://github.com/moskalakamil/oneagent) to manage AI agent configuration.

Rules are stored in \`.oneagent/rules/\` and distributed to agents automatically via symlinks or generated files.

To add a new rule, create a \`.md\` file in \`.oneagent/rules/\` with optional frontmatter:

\`\`\`md
---
applyTo: "**/*.ts"
---
# Rule name

Rule content here.
\`\`\`

Then run \`dotai generate\` to distribute the rule to all configured agents.
`;

function cancelAndExit(): never {
  outro("Cancelled.");
  process.exit(0);
}

async function chooseContent(detected: DetectedFile[]): Promise<string> {
  if (detected.length === 0) return "";

  if (detected.length === 1) {
    const file = detected[0]!;
    const result = await confirm({
      message: `Found ${file.relativePath} (${timeAgo(file.modifiedAt)}). Import its content into .oneagent/instructions.md?`,
    });
    if (isCancel(result)) cancelAndExit();
    return result ? file.content : "";
  }

  if (filesHaveSameContent(detected)) {
    const result = await confirm({
      message: `Found ${detected.length} files with identical content. Import?`,
    });
    if (isCancel(result)) cancelAndExit();
    return result ? detected[0]!.content : "";
  }

  // Scenario D — multiple files, different content
  note(
    detected.map((f) => `  • ${f.relativePath}  ${timeAgo(f.modifiedAt)}`).join("\n"),
    "Multiple files with different content found",
  );

  const result = await select({
    message: "How would you like to handle existing content?",
    options: [
      { value: "merge", label: "Merge all files", hint: "Combine all content" },
      ...detected.map((f, i) => ({
        value: `file:${i}`,
        label: `Use ${f.relativePath}`,
        hint: `${timeAgo(f.modifiedAt)}`,
      })),
      { value: "skip", label: "Skip", hint: "Start with empty instructions" },
    ],
  });

  if (isCancel(result)) cancelAndExit();

  if (result === "skip") return "";
  if (result === "merge") return detected.map((f) => f.content).join("\n\n---\n\n");

  const index = parseInt((result as string).replace("file:", ""), 10);
  return detected[index]!.content;
}

async function pickTargets(): Promise<AgentTarget[]> {
  const result = await multiselect<AgentTarget>({
    message: `Which AI agents do you want to support?
\x1b[90m · Space to toggle · Enter to confirm\x1b[39m`,
    options: [
      { value: "claude", label: "Claude Code", hint: "CLAUDE.md + .claude/rules/" },
      { value: "cursor", label: "Cursor", hint: "AGENTS.md + .cursor/rules/" },
      { value: "windsurf", label: "Windsurf", hint: ".windsurfrules + .windsurf/rules/" },
      { value: "opencode", label: "OpenCode", hint: "AGENTS.md + opencode.json" },
      { value: "copilot", label: "GitHub Copilot", hint: ".github/instructions/*.instructions.md" },
    ],
    initialValues: ["claude"],
    required: true,
  });

  if (isCancel(result)) cancelAndExit();
  return result;
}

async function backupFiles(root: string, files: DetectedFile[]): Promise<void> {
  if (files.length === 0) return;
  const backupDir = path.join(root, ".oneagent/backup");
  await fs.mkdir(backupDir, { recursive: true });
  for (const file of files) {
    const safeName = file.relativePath.replace(/\//g, "_");
    await Bun.write(path.join(backupDir, safeName), file.content);
  }
}

export default defineCommand({
  meta: {
    name: "init",
    description: "Initialize oneagent in the current project",
  },
  async run() {
    intro("oneagent init");

    const root = process.cwd();

    if (await configExists(root)) {
      note("Already initialized. Run `oneagent generate` to sync.", "oneagent");
      outro("Done.");
      return;
    }

    const detected = await detectExistingFiles(root);
    const content = await chooseContent(detected);
    const selectedTargets = await pickTargets();

    const s = spinner();
    s.start("Setting up .oneagent/ directory...");

    await fs.mkdir(path.join(root, ".oneagent/rules"), { recursive: true });
    await fs.mkdir(path.join(root, ".oneagent/skills"), { recursive: true });

    await backupFiles(root, detected);
    await removeDeprecatedFiles(root);
    await warnDeprecatedCommandFiles(root);

    await migrateRuleAndSkillFiles(root);

    const config: Config = { version: 1, targets: makeTargets(...selectedTargets) };
    await writeConfig(root, config);

    const instructionsContent =
      content.trim() ? content : "# Project Instructions\n\nAdd your AI instructions here.\n";
    await Bun.write(path.join(root, ".oneagent/instructions.md"), instructionsContent);
    await Bun.write(path.join(root, ".oneagent/rules/oneagent.md"), DOTAI_META_RULE);

    s.stop("Directory structure created.");

    const s2 = spinner();
    s2.start("Generating symlinks and agent files...");
    await generate(root, config);
    s2.stop("Done.");

    const lines = [
      "Created .oneagent/instructions.md",
      "Created .oneagent/rules/oneagent.md",
      ...selectedTargets.map((t) => `Configured: ${t}`),
      ...(detected.length > 0
        ? [`Backed up ${detected.length} file(s) to .oneagent/backup/`]
        : []),
    ];
    note(lines.map((l) => `  • ${l}`).join("\n"), "Setup complete");

    outro("Run `oneagent status` to verify your setup.");
  },
});

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
  applyTemplateFiles,
  installTemplateSkills,
  installTemplatePlugins,
  fetchTemplateFromGitHub,
  type PluginInstallResult,
  AGENT_DEFINITIONS,
  type AgentTarget,
  type Config,
  type DetectedFile,
  type TemplateDefinition,
} from "@moskala/oneagent-core";
import {
  resolveBuiltinTemplate,
  BUILTIN_TEMPLATE_NAMES,
} from "@moskala/oneagent-templates";

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

async function pickTargets(initialValues: AgentTarget[]): Promise<AgentTarget[]> {
  const result = await multiselect<AgentTarget>({
    message: `Which AI agents do you want to support?
\x1b[90m · Space to toggle · Enter to confirm\x1b[39m`,
    options: AGENT_DEFINITIONS.map((d) => ({ value: d.target, label: d.displayName, hint: d.hint })),
    initialValues,
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
    await fs.writeFile(path.join(backupDir, safeName), file.content);
  }
}

async function resolveTemplate(templateArg: string): Promise<TemplateDefinition> {
  // GitHub URL
  if (templateArg.startsWith("https://github.com/")) {
    return fetchTemplateFromGitHub(templateArg);
  }

  // Builtin name
  const builtin = await resolveBuiltinTemplate(templateArg);
  if (builtin) return builtin;

  throw new Error(
    `Unknown template "${templateArg}". Use one of: ${BUILTIN_TEMPLATE_NAMES.join(", ")} — or a GitHub URL.`,
  );
}

export default defineCommand({
  meta: {
    name: "init",
    description: "Initialize oneagent in the current project",
  },
  args: {
    template: {
      type: "string",
      description: `Template to use: builtin name (${BUILTIN_TEMPLATE_NAMES.join("/")}) or GitHub URL`,
    },
  },
  async run({ args }) {
    intro("oneagent init");

    const root = process.cwd();

    if (await configExists(root)) {
      note("Already initialized. Run `oneagent generate` to sync.", "oneagent");
      outro("Done.");
      return;
    }

    const detected = await detectExistingFiles(root);

    let template: TemplateDefinition | null = null;
    let importedContent = "";

    if (args.template) {
      const s = spinner();
      s.start(`Resolving template "${args.template}"...`);
      try {
        template = await resolveTemplate(args.template);
        s.stop(`Template "${template.name}" ready.`);
      } catch (err) {
        s.stop("Failed.");
        const message = err instanceof Error ? err.message : String(err);
        note(message, "Error");
        process.exit(1);
      }
    } else {
      importedContent = await chooseContent(detected);
    }

    const presentTargets = await detectPresentTargets(root);
    const selectedTargets = await pickTargets(presentTargets);

    const s = spinner();
    s.start("Setting up .oneagent/ directory...");

    await fs.mkdir(path.join(root, ".oneagent/rules"), { recursive: true });
    await fs.mkdir(path.join(root, ".oneagent/skills"), { recursive: true });

    await backupFiles(root, detected);
    await removeDeprecatedFiles(root);
    await migrateRuleAndSkillFiles(root);

    const config: Config = { version: 1, targets: makeTargets(...selectedTargets) };
    await writeConfig(root, config);

    if (template) {
      await applyTemplateFiles(root, template);
    } else {
      const instructionsContent =
        importedContent.trim() ? importedContent : "# Project Instructions\n\nAdd your AI instructions here.\n";
      await fs.writeFile(path.join(root, ".oneagent/instructions.md"), instructionsContent);
    }
    await fs.writeFile(path.join(root, ".oneagent/rules/oneagent.md"), DOTAI_META_RULE);
    s.stop("Directory structure created.");

    await warnDeprecatedCommandFiles(root);

    const s2 = spinner();
    s2.start("Generating symlinks and agent files...");
    await generate(root, config);
    s2.stop("Done.");

    const fetchedSkills: string[] = [];
    if (template && template.skills.length > 0) {
      const s3 = spinner();
      s3.start("Installing skills...");
      await installTemplateSkills(root, template, (id) => fetchedSkills.push(id));
      s3.stop(`Installed ${fetchedSkills.length} skill(s).`);
    }

    let pluginResult: PluginInstallResult = { installed: [], manual: [] };
    if (template && template.plugins.length > 0) {
      const s4 = spinner();
      s4.start("Installing plugins...");
      pluginResult = await installTemplatePlugins(root, template, selectedTargets);
      s4.stop(`Installed ${pluginResult.installed.length} plugin(s).`);
    }

    const lines = [
      ...(template
        ? [
            `Template: ${template.name} — ${template.description}`,
            ...(fetchedSkills.length > 0
              ? [`Fetched ${fetchedSkills.length} skill(s): ${fetchedSkills.join(", ")}`]
              : []),
            ...(template.rules.length > 0
              ? [`Added ${template.rules.length} rule(s) from template`]
              : []),
            ...(pluginResult.installed.length > 0
              ? [`Installed ${pluginResult.installed.length} plugin(s): ${pluginResult.installed.map((p) => p.id).join(", ")}`]
              : []),
            ...pluginResult.manual.map((p) => `Run in Cursor chat: /add-plugin ${p.id}`),
          ]
        : ["Created .oneagent/instructions.md"]),
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

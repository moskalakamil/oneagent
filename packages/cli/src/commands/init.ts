import { defineCommand } from "citty";
import {
  intro,
  outro,
  confirm,
  multiselect,
  select,
  text,
  spinner,
  note,
  log,
  isCancel,
} from "@clack/prompts";
import path from "path";
import fs from "fs/promises";
import { timeAgo } from "../utils.ts";
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
  type SkillInstallResult,
  AGENT_DEFINITIONS,
  type AgentTarget,
  type Config,
  type DetectedFile,
  type TemplateDefinition,
} from "@moskala/oneagent-core";
import {
  resolveBuiltinTemplate,
  BUILTIN_TEMPLATE_NAMES,
  BUILTIN_TEMPLATE_META,
} from "@moskala/oneagent-templates";

import { ABOUT_ONEAGENT_CONTENT } from "../assets/about-oneagent.ts";

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

async function backupDirRecursive(srcDir: string, backupDir: string, prefix: string, root: string): Promise<void> {
  let entries: import("fs").Dirent[];
  try { entries = await fs.readdir(srcDir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const lstat = await fs.lstat(srcPath);
    if (lstat.isSymbolicLink()) continue;
    if (lstat.isDirectory()) {
      await backupDirRecursive(srcPath, backupDir, `${prefix}_${entry.name}`, root);
    } else if (lstat.isFile()) {
      await fs.mkdir(backupDir, { recursive: true });
      const safeName = `${prefix}_${entry.name}`;
      await fs.copyFile(srcPath, path.join(backupDir, safeName));
    }
  }
}

async function cleanupUnselectedAgentDirs(
  root: string,
  presentTargets: AgentTarget[],
  selectedTargets: AgentTarget[],
): Promise<void> {
  const unselected = presentTargets.filter((t) => !selectedTargets.includes(t));
  if (unselected.length === 0) return;

  const backupDir = path.join(root, ".oneagent/backup");

  for (const target of unselected) {
    const def = AGENT_DEFINITIONS.find((d) => d.target === target)!;

    // Derive agent root dir from first segment of any dir field, skip .github
    const agentDir = [def.rulesDir, def.skillsDir, def.commandsDir]
      .filter(Boolean)
      .map((d) => d!.split("/")[0]!)
      .find((d) => d !== ".github");

    if (agentDir) {
      const agentDirAbs = path.join(root, agentDir);
      let stat;
      try { stat = await fs.lstat(agentDirAbs); } catch { /* doesn't exist */ }
      if (stat && stat.isDirectory() && !stat.isSymbolicLink()) {
        // Recursively backup all non-symlink files before removing
        await backupDirRecursive(agentDirAbs, backupDir, agentDir, root);
        await fs.rm(agentDirAbs, { recursive: true, force: true });
      }
    }

    // opencode also writes a standalone config file — backup before removing
    if (target === "opencode") {
      const opPath = path.join(root, "opencode.json");
      try {
        const content = await fs.readFile(opPath, "utf-8");
        await fs.mkdir(backupDir, { recursive: true });
        await fs.writeFile(path.join(backupDir, "opencode.json"), content);
      } catch { /* file doesn't exist */ }
      try { await fs.unlink(opPath); } catch {}
    }
  }
}

async function pickTemplateInteractively(): Promise<string> {
  const result = await select({
    message: "Which template would you like to use?",
    options: [
      ...BUILTIN_TEMPLATE_META.map((t) => ({
        value: t.name,
        label: t.name,
        hint: t.description,
      })),
      { value: "__github__", label: "Custom GitHub template", hint: "Enter a GitHub URL" },
    ],
  });

  if (isCancel(result)) cancelAndExit();

  if (result === "__github__") {
    const url = await text({
      message: "GitHub URL:",
      placeholder: "https://github.com/owner/repo",
      validate: (v) => (!v || !v.startsWith("https://github.com/") ? "Must be a GitHub URL" : undefined),
    });
    if (isCancel(url)) cancelAndExit();
    return url as string;
  }

  return result as string;
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

    // Determine template arg: explicit value, flag without value (interactive), or not passed
    // When --template is passed without a value, citty sets args.template to true (boolean) — treat as "no value"
    const templateFlagPresent = process.argv.includes("--template");
    const templateValue = typeof args.template === "string" && args.template.length > 0 ? args.template : null;
    const templateArg = templateValue || (templateFlagPresent ? await pickTemplateInteractively() : null);

    if (templateArg) {
      const s = spinner();
      s.start(`Resolving template "${templateArg}"...`);
      try {
        template = await resolveTemplate(templateArg);
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
    await fs.mkdir(path.join(root, ".oneagent/commands"), { recursive: true });

    await backupFiles(root, detected);
    await removeDeprecatedFiles(root);
    await migrateRuleAndSkillFiles(root);
    await cleanupUnselectedAgentDirs(root, presentTargets, selectedTargets);

    const config: Config = { version: 1, targets: makeTargets(...selectedTargets) };
    await writeConfig(root, config);

    if (template) {
      await applyTemplateFiles(root, template);
    } else {
      const instructionsContent =
        importedContent.trim() ? importedContent : "# Project Instructions\n\nAdd your AI instructions here.\n";
      await fs.writeFile(path.join(root, ".oneagent/instructions.md"), instructionsContent);
    }
    await fs.writeFile(path.join(root, ".oneagent/rules/about-oneagent.md"), ABOUT_ONEAGENT_CONTENT, "utf-8");
    s.stop("Directory structure created.");

    // Warn if commands exist: skills are broader and more powerful
    const commandFiles = await fs.readdir(path.join(root, ".oneagent/commands")).catch(() => []);
    if (commandFiles.some((f) => f.endsWith(".md"))) {
      log.warn(
        "Commands detected in .oneagent/commands/. Consider migrating to .oneagent/skills/ — skills are distributed to more agents and support richer features.",
      );
    }

    // Warn if selected targets don't support commands (when commands exist)
    if (commandFiles.some((f) => f.endsWith(".md"))) {
      const commandsSupported = new Set(AGENT_DEFINITIONS.filter((d) => d.commandsDir).map((d) => d.target));
      const unsupported = selectedTargets.filter((t) => !commandsSupported.has(t));
      if (unsupported.length > 0) {
        const names = unsupported.map((t) => AGENT_DEFINITIONS.find((d) => d.target === t)!.displayName).join(", ");
        log.warn(`Commands in .oneagent/commands/ will not be available in: ${names} — these agents do not support custom slash commands.`);
      }
    }

    const s2 = spinner();
    s2.start("Generating symlinks and agent files...");
    await generate(root, config);
    s2.stop("Done.");

    let skillResult: SkillInstallResult = { installed: [], failed: [] };
    if (template && template.skills.length > 0) {
      const s3 = spinner();
      s3.start("Installing skills...");
      skillResult = await installTemplateSkills(root, template);
      s3.stop(`Installed ${skillResult.installed.length} skill(s).`);
      for (const f of skillResult.failed) {
        log.warn(`Skill "${f.entry.skill}" (${f.entry.repo}) could not be installed and was skipped.`);
      }
    }

    let pluginResult: PluginInstallResult = { installed: [], manual: [], failed: [] };
    if (template && template.plugins.length > 0) {
      const s4 = spinner();
      s4.start("Installing plugins...");
      pluginResult = await installTemplatePlugins(root, template, selectedTargets);
      s4.stop(`Installed ${pluginResult.installed.length} plugin(s).`);
      for (const f of pluginResult.failed) {
        log.warn(`Plugin "${f.plugin.id}" (${f.plugin.target}) could not be installed and was skipped.`);
      }
    }

    const lines = [
      ...(template
        ? [
            `Template: ${template.name} — ${template.description}`,
            ...(skillResult.installed.length > 0
              ? [`Installed ${skillResult.installed.length} skill(s): ${skillResult.installed.map((s) => s.skill).join(", ")}`]
              : []),
            ...(template.rules.length > 0
              ? [`Added ${template.rules.length} rule(s) from template`]
              : []),
            ...(pluginResult.installed.length > 0
              ? [`Installed ${pluginResult.installed.length} plugin(s): ${pluginResult.installed.map((p) => p.id).join(", ")}`]
              : []),
          ]
        : ["Created .oneagent/instructions.md"]),
      "Created .oneagent/rules/about-oneagent.md",
      ...selectedTargets.map((t) => `Configured: ${t}`),
      ...(detected.length > 0
        ? [`Backed up ${detected.length} file(s) to .oneagent/backup/`]
        : []),
    ];
    note(lines.map((l) => `  • ${l}`).join("\n"), "Setup complete");

    if (pluginResult.manual.length > 0) {
      note(
        `This template includes ${pluginResult.manual.length} Cursor plugin(s).\nTo install them, run each command in the Cursor chat:\n\n${pluginResult.manual.map((p) => `  /add-plugin ${p.id}`).join("\n")}`,
        "Action required: Cursor plugins",
      );
    }

    outro("Run `oneagent status` to verify your setup.");
  },
});

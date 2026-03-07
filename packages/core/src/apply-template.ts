import path from "path";
import fs from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import type { AgentTarget } from "./types.ts";
import { addOpenCodePlugin } from "./opencode.ts";

const execFileAsync = promisify(execFile);

export interface TemplatePlugin {
  target: AgentTarget;
  id: string;
}

export interface SkillEntry {
  repo: string;
  skill: string;
}

export interface TemplateDefinition {
  name: string;
  description: string;
  skills: SkillEntry[];
  plugins: TemplatePlugin[];
  instructions: string;
  rules: Array<{ name: string; content: string }>;
}

// Parses name, description, skills and plugins from a template.yml string.
// This is the single source of truth for the template.yml format — used by
// both builtin template loading and GitHub URL template fetching.
export function parseTemplateYaml(yamlText: string, fallbackName = "custom"): Pick<TemplateDefinition, "name" | "description" | "skills" | "plugins"> {
  const nameMatch = yamlText.match(/^name:\s*(.+)$/m);
  const name = nameMatch?.[1]?.trim() ?? fallbackName;

  const descMatch = yamlText.match(/^description:\s*(.+)$/m);
  const description = descMatch?.[1]?.trim() ?? "";

  const skills = parseSkillsFromYaml(yamlText);
  const plugins = parsePluginsFromYaml(yamlText);
  return { name, description, skills, plugins };
}

// Parses the `skills:` block from a template.yml string.
// Expects entries in the format:
//   skills:
//     - repo: https://github.com/owner/skills
//       skill: skill-name
export function parseSkillsFromYaml(yamlText: string): SkillEntry[] {
  const skills: SkillEntry[] = [];
  const section = yamlText.match(/^skills:\s*\n((?:(?:  -.+|\s{4}.+)\n?)*)/m);
  if (!section) return skills;
  const block = section[1]!;
  const entries = block.split(/\n(?=  -)/);
  for (const entry of entries) {
    const repoMatch = entry.match(/repo:\s*(\S+)/);
    const skillMatch = entry.match(/skill:\s*(\S+)/);
    if (repoMatch && skillMatch) {
      skills.push({ repo: repoMatch[1]!.trim(), skill: skillMatch[1]!.trim() });
    }
  }
  return skills;
}

// Parses the `plugins:` block from a template.yml string.
// Expects entries in the format:
//   plugins:
//     - target: claude
//       id: typescript-lsp@claude-plugins-official
export function parsePluginsFromYaml(yamlText: string): TemplatePlugin[] {
  const plugins: TemplatePlugin[] = [];
  const section = yamlText.match(/^plugins:\s*\n((?:(?:  -.+|\s{4}.+)\n?)*)/m);
  if (!section) return plugins;
  const block = section[1]!;
  const entries = block.split(/\n(?=  -)/);
  for (const entry of entries) {
    const targetMatch = entry.match(/target:\s*(\S+)/);
    const idMatch = entry.match(/id:\s*(.+)/);
    if (targetMatch && idMatch) {
      plugins.push({
        target: targetMatch[1]!.trim() as AgentTarget,
        id: idMatch[1]!.trim(),
      });
    }
  }
  return plugins;
}

// Phase 1: writes instructions.md and rules/*.md.
// Call this BEFORE generate() so symlinks to rules are created.
export async function applyTemplateFiles(root: string, template: TemplateDefinition): Promise<void> {
  const oneagentDir = path.join(root, ".oneagent");

  await fs.mkdir(path.join(oneagentDir, "rules"), { recursive: true });
  await fs.mkdir(path.join(oneagentDir, "skills"), { recursive: true });

  await fs.writeFile(path.join(oneagentDir, "instructions.md"), template.instructions);

  for (const rule of template.rules) {
    await fs.writeFile(path.join(oneagentDir, "rules", `${rule.name}.md`), rule.content);
  }
}

export interface SkillInstallResult {
  installed: SkillEntry[];
  failed: Array<{ entry: SkillEntry; reason: string }>;
}

// Phase 2: installs skills via `npx skills add <repo> --skill <name>`.
// Skills are installed sequentially to avoid race conditions — each `npx skills add` call
// sets up agent directories and running them in parallel causes "skills 2" naming conflicts.
// Call this AFTER generate() so agent directories exist.
// Never throws — failed skills are collected and returned in the result.
export async function installTemplateSkills(
  root: string,
  template: TemplateDefinition,
): Promise<SkillInstallResult> {
  const installed: SkillEntry[] = [];
  const failed: Array<{ entry: SkillEntry; reason: string }> = [];

  for (const entry of template.skills) {
    try {
      await execFileAsync("npx", ["skills", "add", entry.repo, "--skill", entry.skill, "--agent", "universal", "--yes"], { cwd: root });
      installed.push(entry);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      failed.push({ entry, reason });
    }
  }

  return { installed, failed };
}

export interface PluginInstallResult {
  installed: TemplatePlugin[];
  manual: TemplatePlugin[];
  failed: Array<{ plugin: TemplatePlugin; reason: string }>;
}

// Phase 3: installs plugins for active targets. Call AFTER generate().
// - claude  → `claude plugin install <id>`
// - copilot → `copilot plugin install <id>`
// - opencode → adds id to plugin[] in opencode.json
// - cursor  → added to manual list (no CLI yet — user runs /add-plugin in chat)
// - windsurf → skipped (no marketplace)
// Never throws — failed plugins are collected and returned in the result.
export async function installTemplatePlugins(
  root: string,
  template: TemplateDefinition,
  activeTargets: AgentTarget[],
): Promise<PluginInstallResult> {
  const installed: TemplatePlugin[] = [];
  const manual: TemplatePlugin[] = [];
  const failed: Array<{ plugin: TemplatePlugin; reason: string }> = [];

  for (const plugin of template.plugins) {
    if (!activeTargets.includes(plugin.target)) continue;

    try {
      switch (plugin.target) {
        case "claude":
          await execFileAsync("claude", ["plugin", "install", plugin.id], { cwd: root });
          installed.push(plugin);
          break;

        case "copilot":
          await execFileAsync("copilot", ["plugin", "install", plugin.id], { cwd: root });
          installed.push(plugin);
          break;

        case "opencode":
          await addOpenCodePlugin(root, plugin.id);
          installed.push(plugin);
          break;

        case "cursor":
          manual.push(plugin);
          break;

        case "windsurf":
          // No marketplace yet — skip silently
          break;
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      failed.push({ plugin, reason });
    }
  }

  return { installed, manual, failed };
}

// Fetches a template from a GitHub URL.
// Expects the repository to contain: template.yml, instructions.md, and optionally rules/*.md
// When no branch is specified in the URL, tries "main" then "master" as fallback.
export async function fetchTemplateFromGitHub(url: string): Promise<TemplateDefinition> {
  const { owner, repo, branch, subdir } = parseGitHubUrl(url);
  const branchExplicit = url.includes("/tree/");
  const branchesToTry = branchExplicit ? [branch] : [branch, "master"];

  let rawBase: string | undefined;
  let yamlText: string | undefined;
  let instructions: string | undefined;
  let lastError: unknown;

  for (const b of branchesToTry) {
    const base = `https://raw.githubusercontent.com/${owner}/${repo}/${b}${subdir ? `/${subdir}` : ""}`;
    try {
      [yamlText, instructions] = await Promise.all([
        fetchText(`${base}/template.yml`),
        fetchText(`${base}/instructions.md`),
      ]);
      rawBase = base;
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!rawBase || yamlText === undefined || instructions === undefined) {
    throw lastError ?? new Error(`Could not fetch template from ${url}`);
  }

  const { name, description, skills, plugins } = parseTemplateYaml(yamlText!);

  // Try to list rules via GitHub API
  const rules = await fetchGitHubRules(url);

  return { name, description, skills, plugins, instructions: instructions!, rules };
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

interface GitHubUrlParts {
  owner: string;
  repo: string;
  branch: string;
  subdir: string; // "" for root, "path/to/dir" for subdirectories
}

function parseGitHubUrl(url: string): GitHubUrlParts {
  // Supports:
  //   https://github.com/owner/repo
  //   https://github.com/owner/repo/tree/branch
  //   https://github.com/owner/repo/tree/branch/path/to/subdir
  const match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\/tree\/([^/]+?)(?:\/(.+))?)?(?:\/)?$/);
  if (!match) {
    throw new Error(`Invalid GitHub URL: "${url}". Expected format: https://github.com/owner/repo`);
  }
  const [, owner, repo, branch = "main", subdir = ""] = match;
  return { owner: owner!, repo: repo!, branch, subdir };
}

function githubUrlToRawBase(url: string): string {
  const { owner, repo, branch, subdir } = parseGitHubUrl(url);
  const base = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}`;
  return subdir ? `${base}/${subdir}` : base;
}

async function fetchGitHubRules(repoUrl: string): Promise<Array<{ name: string; content: string }>> {
  const { owner, repo, branch, subdir } = parseGitHubUrl(repoUrl);
  const rulesPath = subdir ? `${subdir}/rules` : "rules";
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${rulesPath}?ref=${branch}`;
  try {
    const response = await fetch(apiUrl, {
      headers: { Accept: "application/vnd.github.v3+json" },
    });
    if (!response.ok) return [];

    const files = (await response.json()) as Array<{ name: string; download_url: string | null }>;
    const mdFiles = files.filter((f) => f.name.endsWith(".md") && f.download_url);

    const rules = await Promise.all(
      mdFiles.map(async (f) => {
        const content = await fetchText(f.download_url!);
        return { name: path.basename(f.name, ".md"), content };
      }),
    );
    return rules;
  } catch {
    return [];
  }
}

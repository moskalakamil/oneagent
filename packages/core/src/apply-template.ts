import path from "path";
import fs from "fs/promises";

export interface TemplateDefinition {
  name: string;
  description: string;
  skills: string[];
  instructions: string;
  rules: Array<{ name: string; content: string }>;
}

// Phase 1: writes instructions.md and rules/*.md.
// Call this BEFORE generate() so symlinks to rules are created.
export async function applyTemplateFiles(root: string, template: TemplateDefinition): Promise<void> {
  const oneagentDir = path.join(root, ".oneagent");

  await fs.mkdir(path.join(oneagentDir, "rules"), { recursive: true });
  await fs.mkdir(path.join(oneagentDir, "skills"), { recursive: true });

  await Bun.write(path.join(oneagentDir, "instructions.md"), template.instructions);

  for (const rule of template.rules) {
    await Bun.write(path.join(oneagentDir, "rules", `${rule.name}.md`), rule.content);
  }
}

// Phase 2: installs skills via `bunx skills add <identifier> --yes`.
// Call this AFTER generate() so agent directories (symlinks) already exist.
export async function installTemplateSkills(
  root: string,
  template: TemplateDefinition,
  onSkillInstalled?: (identifier: string) => void,
): Promise<void> {
  for (const identifier of template.skills) {
    try {
      await Bun.$`bunx skills add ${identifier} --agent universal --yes`.cwd(root).quiet();
      onSkillInstalled?.(identifier);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to install skill "${identifier}": ${message}`);
    }
  }
}

// Fetches a template from a GitHub URL.
// Expects the repository to contain: template.yml, instructions.md, and optionally rules/*.md
export async function fetchTemplateFromGitHub(url: string): Promise<TemplateDefinition> {
  // Convert GitHub URL to raw content base URL
  // e.g. https://github.com/owner/repo → https://raw.githubusercontent.com/owner/repo/main
  const rawBase = githubUrlToRawBase(url);

  const [yamlText, instructions] = await Promise.all([
    fetchText(`${rawBase}/template.yml`),
    fetchText(`${rawBase}/instructions.md`),
  ]);

  const descMatch = yamlText.match(/^description:\s*(.+)$/m);
  const description = descMatch?.[1]?.trim() ?? "";

  const nameMatch = yamlText.match(/^name:\s*(.+)$/m);
  const name = nameMatch?.[1]?.trim() ?? "custom";

  const skills: string[] = [];
  const skillsBlockMatch = yamlText.match(/^skills:\s*\n((?:  - .+\n?)*)/m);
  if (skillsBlockMatch) {
    const lines = skillsBlockMatch[1]!.split("\n").filter(Boolean);
    for (const line of lines) {
      const skill = line.replace(/^\s*-\s*/, "").trim();
      if (skill) skills.push(skill);
    }
  }

  // Try to list rules via GitHub API
  const rules = await fetchGitHubRules(url);

  return { name, description, skills, instructions, rules };
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function githubUrlToRawBase(url: string): string {
  // Handle https://github.com/owner/repo/tree/branch or https://github.com/owner/repo
  const match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\/tree\/([^/]+))?(?:\/.*)?$/);
  if (!match) {
    throw new Error(`Invalid GitHub URL: "${url}". Expected format: https://github.com/owner/repo`);
  }
  const [, owner, repo, branch = "main"] = match;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}`;
}

async function fetchGitHubRules(repoUrl: string): Promise<Array<{ name: string; content: string }>> {
  // Parse owner/repo from URL
  const match = repoUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\/tree\/([^/]+))?(?:\/.*)?$/);
  if (!match) return [];
  const [, owner, repo, branch = "main"] = match;

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/rules?ref=${branch}`;
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

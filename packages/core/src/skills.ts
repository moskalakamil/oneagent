import path from "path";
import fs from "fs/promises";
import type { SkillFile } from "./types.ts";

const VALID_MODES = ["ask", "edit", "agent"] as const;
type SkillMode = (typeof VALID_MODES)[number];

export function parseSkillFrontmatter(raw: string): { description: string; mode: SkillMode; content: string } {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { description: "", mode: "agent", content: raw };

  const frontmatter = match[1] ?? "";
  const content = match[2] ?? "";

  const descMatch = frontmatter.match(/description:\s*["']?([^"'\n]+)["']?/);
  const description = descMatch?.[1]?.trim() ?? "";

  const modeMatch = frontmatter.match(/mode:\s*["']?([^"'\n]+)["']?/);
  const modeRaw = modeMatch?.[1]?.trim() ?? "agent";
  const mode: SkillMode = (VALID_MODES as readonly string[]).includes(modeRaw) ? (modeRaw as SkillMode) : "agent";

  return { description, mode, content };
}

export async function readSkillFile(filePath: string): Promise<SkillFile> {
  const raw = await fs.readFile(filePath, "utf-8");
  const { description, mode, content } = parseSkillFrontmatter(raw);
  return { name: path.basename(filePath, ".md"), path: filePath, description, mode, content };
}

export async function readSkills(root: string): Promise<SkillFile[]> {
  const skillsDir = path.join(root, ".oneagent/skills");
  try {
    const files = await fs.readdir(skillsDir);
    const mdFiles = files.filter((f) => f.endsWith(".md"));
    const skills = await Promise.all(mdFiles.map((f) => readSkillFile(path.join(skillsDir, f))));
    return skills.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}


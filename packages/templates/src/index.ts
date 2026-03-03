import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { type TemplatePlugin, type TemplateDefinition, parsePluginsFromYaml } from "@moskala/oneagent-core";

export type { TemplatePlugin, TemplateDefinition };

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type BuiltinTemplateName = "default" | "react" | "react-native";

const TEMPLATE_NAMES: BuiltinTemplateName[] = ["default", "react", "react-native"];

async function loadTemplate(name: BuiltinTemplateName): Promise<TemplateDefinition> {
  const templateDir = path.join(__dirname, "templates", name);

  const [yamlText, instructions] = await Promise.all([
    fs.readFile(path.join(templateDir, "template.yml"), "utf-8"),
    fs.readFile(path.join(templateDir, "instructions.md"), "utf-8"),
  ]);

  // Minimal YAML parsing for our simple structure
  const descMatch = yamlText.match(/^description:\s*(.+)$/m);
  const description = descMatch?.[1]?.trim() ?? "";

  const skills: string[] = [];
  const skillsBlockMatch = yamlText.match(/^skills:\s*\n((?:  - .+\n?)*)/m);
  if (skillsBlockMatch) {
    const lines = skillsBlockMatch[1]!.split("\n").filter(Boolean);
    for (const line of lines) {
      const skill = line.replace(/^\s*-\s*/, "").trim();
      if (skill) skills.push(skill);
    }
  }

  const plugins = parsePluginsFromYaml(yamlText);

  const rulesDir = path.join(templateDir, "rules");
  let rules: Array<{ name: string; content: string }> = [];
  try {
    const ruleFiles = await fs.readdir(rulesDir);
    rules = await Promise.all(
      ruleFiles
        .filter((f) => f.endsWith(".md"))
        .map(async (f) => ({
          name: path.basename(f, ".md"),
          content: await fs.readFile(path.join(rulesDir, f), "utf-8"),
        })),
    );
  } catch {
    // No rules directory — fine
  }

  return { name, description, skills, plugins, instructions, rules };
}

export async function resolveBuiltinTemplate(name: string): Promise<TemplateDefinition | null> {
  if (!TEMPLATE_NAMES.includes(name as BuiltinTemplateName)) return null;
  return loadTemplate(name as BuiltinTemplateName);
}

export const BUILTIN_TEMPLATE_NAMES: readonly string[] = TEMPLATE_NAMES;

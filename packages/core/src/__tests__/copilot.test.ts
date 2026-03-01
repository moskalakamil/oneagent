import { test, expect, describe } from "bun:test";
import { mkdtemp, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { buildCopilotContent, copilotFilePath, generateCopilotRules, buildCopilotPromptContent, copilotPromptFilePath, generateCopilotSkills } from "../copilot.ts";
import type { RuleFile, SkillFile } from "../types.ts";

async function mkTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "dotai-test-"));
}

const mockRule: RuleFile = {
  name: "typescript",
  path: "/root/.oneagent/rules/typescript.md",
  applyTo: "**/*.ts",
  content: "# TypeScript rules",
};

describe("buildCopilotContent", () => {
  test("wraps content with applyTo frontmatter", () => {
    const result = buildCopilotContent(mockRule);
    expect(result).toContain('applyTo: "**/*.ts"');
    expect(result).toContain("# TypeScript rules");
    expect(result.startsWith("---")).toBe(true);
  });
});

describe("copilotFilePath", () => {
  test("returns correct .instructions.md path", () => {
    expect(copilotFilePath("/root", "typescript")).toBe(
      "/root/.github/instructions/typescript.instructions.md",
    );
  });
});

const mockSkill: SkillFile = {
  name: "review",
  path: "/root/.oneagent/skills/review.md",
  description: "Review code for issues",
  mode: "ask",
  content: "Review the code carefully.",
};

describe("buildCopilotPromptContent", () => {
  test("wraps content with mode and description frontmatter", () => {
    const result = buildCopilotPromptContent(mockSkill);
    expect(result).toContain('mode: "ask"');
    expect(result).toContain('description: "Review code for issues"');
    expect(result).toContain("Review the code carefully.");
    expect(result.startsWith("---")).toBe(true);
  });

  test("omits description line when description is empty", () => {
    const skill: SkillFile = { ...mockSkill, description: "" };
    const result = buildCopilotPromptContent(skill);
    expect(result).not.toContain("description:");
    expect(result).toContain('mode: "ask"');
  });
});

describe("copilotPromptFilePath", () => {
  test("returns correct .prompt.md path", () => {
    expect(copilotPromptFilePath("/root", "review")).toBe(
      "/root/.github/prompts/review.prompt.md",
    );
  });
});

describe("generateCopilotSkills", () => {
  test("writes prompt files to .github/prompts/", async () => {
    const dir = await mkTempDir();
    const skill: SkillFile = { ...mockSkill, path: join(dir, "review.md") };

    await generateCopilotSkills(dir, [skill]);

    const expected = join(dir, ".github/prompts/review.prompt.md");
    expect(await Bun.file(expected).exists()).toBe(true);

    const content = await Bun.file(expected).text();
    expect(content).toContain('mode: "ask"');
    expect(content).toContain('description: "Review code for issues"');
  });

  test("creates parent directories if they do not exist", async () => {
    const dir = await mkTempDir();
    const skill: SkillFile = { ...mockSkill, path: join(dir, "review.md") };
    await generateCopilotSkills(dir, [skill]);
    expect(await Bun.file(join(dir, ".github/prompts/review.prompt.md")).exists()).toBe(true);
  });
});

describe("generateCopilotRules", () => {
  test("writes instruction files to .github/instructions/", async () => {
    const dir = await mkTempDir();
    const rule: RuleFile = { ...mockRule, path: join(dir, "typescript.md") };

    await generateCopilotRules(dir, [rule]);

    const expected = join(dir, ".github/instructions/typescript.instructions.md");
    expect(await Bun.file(expected).exists()).toBe(true);

    const content = await Bun.file(expected).text();
    expect(content).toContain('applyTo: "**/*.ts"');
    expect(content).toContain("# TypeScript rules");
  });

  test("creates parent directories if they do not exist", async () => {
    const dir = await mkTempDir();
    const rule: RuleFile = { ...mockRule, path: join(dir, "typescript.md") };
    // .github/instructions/ does not exist yet
    await generateCopilotRules(dir, [rule]);
    expect(await Bun.file(join(dir, ".github/instructions/typescript.instructions.md")).exists()).toBe(true);
  });
});

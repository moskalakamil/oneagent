import { test, expect, describe } from "bun:test";
import { mkdtemp, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { buildCopilotContent, copilotFilePath, generateCopilotRules } from "../copilot.ts";
import type { RuleFile } from "../types.ts";

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

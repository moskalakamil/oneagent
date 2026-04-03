import { test, expect, describe } from "bun:test";
import { copilotFilePath, buildCopilotRulesSymlinks } from "../copilot.ts";
import type { RuleFile } from "../types.ts";

describe("copilotFilePath", () => {
  test("returns correct .instructions.md path", () => {
    expect(copilotFilePath("/root", "typescript")).toBe(
      "/root/.github/instructions/typescript.instructions.md",
    );
  });
});

describe("buildCopilotRulesSymlinks", () => {
  test("returns per-file symlink entries with correct target and label", () => {
    const rules: RuleFile[] = [
      { name: "typescript", path: "/root/.oneagent/rules/typescript.md" },
      { name: "security", path: "/root/.oneagent/rules/security.md" },
    ];
    const entries = buildCopilotRulesSymlinks("/root", rules);
    expect(entries).toHaveLength(2);

    expect(entries[0]!.symlinkPath).toBe("/root/.github/instructions/typescript.instructions.md");
    expect(entries[0]!.target).toBe("../../.oneagent/rules/typescript.md");
    expect(entries[0]!.label).toBe(".github/instructions/typescript.instructions.md");

    expect(entries[1]!.symlinkPath).toBe("/root/.github/instructions/security.instructions.md");
    expect(entries[1]!.target).toBe("../../.oneagent/rules/security.md");
    expect(entries[1]!.label).toBe(".github/instructions/security.instructions.md");
  });

  test("returns empty array for no rules", () => {
    expect(buildCopilotRulesSymlinks("/root", [])).toEqual([]);
  });
});

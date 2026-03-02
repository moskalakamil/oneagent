import { test, expect, describe } from "bun:test";
import { mkdtemp, lstat } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { createSymlink, buildMainSymlinks, buildRulesSymlinks, buildSkillSymlinks, buildAgentsDirSymlinks, checkSymlink } from "../symlinks.ts";
import type { RuleFile, SkillFile } from "../types.ts";

async function mkTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "dotai-test-"));
}

describe("createSymlink", () => {
  test("creates a symlink at the given path", async () => {
    const dir = await mkTempDir();
    await Bun.write(join(dir, "target.md"), "content");
    await createSymlink(join(dir, "link.md"), "target.md");
    const stat = await lstat(join(dir, "link.md"));
    expect(stat.isSymbolicLink()).toBe(true);
  });

  test("is idempotent — overwrites existing symlink", async () => {
    const dir = await mkTempDir();
    await Bun.write(join(dir, "target.md"), "content");
    await createSymlink(join(dir, "link.md"), "target.md");
    await createSymlink(join(dir, "link.md"), "target.md");
    const stat = await lstat(join(dir, "link.md"));
    expect(stat.isSymbolicLink()).toBe(true);
  });

  test("creates parent directories automatically", async () => {
    const dir = await mkTempDir();
    await Bun.write(join(dir, "target.md"), "content");
    await createSymlink(join(dir, "subdir/nested/link.md"), "../../target.md");
    const stat = await lstat(join(dir, "subdir/nested/link.md"));
    expect(stat.isSymbolicLink()).toBe(true);
  });
});

describe("buildMainSymlinks", () => {
  test("produces CLAUDE.md entry for claude target", () => {
    const entries = buildMainSymlinks("/root", ["claude"]);
    expect(entries.some((e) => e.symlinkPath === "/root/CLAUDE.md")).toBe(true);
  });

  test("deduplicates AGENTS.md when cursor + opencode both selected", () => {
    const entries = buildMainSymlinks("/root", ["cursor", "opencode"]);
    const agentsEntries = entries.filter((e) => e.symlinkPath === "/root/AGENTS.md");
    expect(agentsEntries.length).toBe(1);
  });

  test("all entries have a relative target path", () => {
    const entries = buildMainSymlinks("/root", ["claude", "cursor", "copilot"]);
    for (const e of entries) {
      expect(e.target.startsWith("/")).toBe(false);
    }
  });

  test("copilot target produces .github/copilot-instructions.md", () => {
    const entries = buildMainSymlinks("/root", ["copilot"]);
    expect(entries[0]!.symlinkPath).toBe("/root/.github/copilot-instructions.md");
  });
});

describe("buildRulesSymlinks", () => {
  const rules: RuleFile[] = [
    { name: "typescript", path: "/root/.oneagent/rules/typescript.md", applyTo: "**", content: "" },
  ];

  test("creates .claude/rules/ entries for claude", () => {
    const entries = buildRulesSymlinks("/root", ["claude"], rules);
    expect(entries.some((e) => e.symlinkPath.includes(".claude/rules/typescript.md"))).toBe(true);
  });

  test("skips copilot and opencode (handled separately)", () => {
    const entries = buildRulesSymlinks("/root", ["copilot", "opencode"], rules);
    expect(entries.length).toBe(0);
  });
});

describe("buildSkillSymlinks", () => {
  const skills: SkillFile[] = [
    { name: "review", path: "/root/.oneagent/skills/review.md", description: "Review code", mode: "ask", content: "" },
  ];

  test("creates .claude/commands/ entries for claude target", () => {
    const entries = buildSkillSymlinks("/root", ["claude"], skills);
    expect(entries.some((e) => e.symlinkPath.includes(".claude/commands/review.md"))).toBe(true);
  });

  test("returns empty array when claude is not a target", () => {
    const entries = buildSkillSymlinks("/root", ["cursor", "copilot"], skills);
    expect(entries.length).toBe(0);
  });

  test("returns empty array when no skills", () => {
    const entries = buildSkillSymlinks("/root", ["claude"], []);
    expect(entries.length).toBe(0);
  });

  test("all entries have a relative target path", () => {
    const entries = buildSkillSymlinks("/root", ["claude"], skills);
    for (const e of entries) {
      expect(e.target.startsWith("/")).toBe(false);
    }
  });
});

describe("buildAgentsDirSymlinks", () => {
  test("returns single entry pointing to .agents/skills", () => {
    const entries = buildAgentsDirSymlinks("/root");
    expect(entries.length).toBe(1);
    expect(entries[0]!.symlinkPath).toBe("/root/.agents/skills");
  });

  test("target is relative (not absolute)", () => {
    const entries = buildAgentsDirSymlinks("/root");
    expect(entries[0]!.target.startsWith("/")).toBe(false);
  });

  test("target resolves to .oneagent/skills", () => {
    const entries = buildAgentsDirSymlinks("/root");
    expect(entries[0]!.target).toBe("../.oneagent/skills");
  });
});

describe("checkSymlink", () => {
  test("returns exists: false when symlink does not exist", async () => {
    const result = await checkSymlink({
      symlinkPath: "/nonexistent/path.md",
      target: "target.md",
      label: "path.md",
    });
    expect(result.exists).toBe(false);
    expect(result.valid).toBe(false);
  });

  test("returns valid: true when symlink matches expected target", async () => {
    const dir = await mkTempDir();
    await Bun.write(join(dir, "target.md"), "content");
    await createSymlink(join(dir, "link.md"), "target.md");
    const result = await checkSymlink({
      symlinkPath: join(dir, "link.md"),
      target: "target.md",
      label: "link.md",
    });
    expect(result.exists).toBe(true);
    expect(result.valid).toBe(true);
  });

  test("returns valid: false when symlink target does not match", async () => {
    const dir = await mkTempDir();
    await Bun.write(join(dir, "target.md"), "content");
    await createSymlink(join(dir, "link.md"), "target.md");
    const result = await checkSymlink({
      symlinkPath: join(dir, "link.md"),
      target: "other.md",
      label: "link.md",
    });
    expect(result.exists).toBe(true);
    expect(result.valid).toBe(false);
  });
});

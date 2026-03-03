import { test, expect, describe } from "bun:test";
import { mkdtemp, lstat, mkdir, writeFile, symlink, access } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { createSymlink, buildMainSymlinks, buildRulesSymlinks, buildSkillSymlinks, buildAgentsDirSymlinks, checkSymlink, migrateRuleAndSkillFiles } from "../symlinks.ts";

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
  test("creates directory symlink for claude", () => {
    const entries = buildRulesSymlinks("/root", ["claude"]);
    expect(entries.some((e) => e.symlinkPath === "/root/.claude/rules")).toBe(true);
  });

  test("target points to .oneagent/rules", () => {
    const entries = buildRulesSymlinks("/root", ["claude", "cursor", "windsurf"]);
    for (const e of entries) {
      expect(e.target).toBe("../.oneagent/rules");
    }
  });

  test("skips copilot and opencode (handled separately)", () => {
    const entries = buildRulesSymlinks("/root", ["copilot", "opencode"]);
    expect(entries.length).toBe(0);
  });
});

describe("buildSkillSymlinks", () => {
  test("creates directory symlinks for claude and cursor targets", () => {
    const entries = buildSkillSymlinks("/root", ["claude", "cursor"]);
    expect(entries.some((e) => e.symlinkPath === "/root/.claude/skills")).toBe(true);
    expect(entries.some((e) => e.symlinkPath === "/root/.cursor/skills")).toBe(true);
  });

  test("returns empty array when no relevant targets", () => {
    const entries = buildSkillSymlinks("/root", ["opencode"]);
    expect(entries.length).toBe(0);
  });

  test("all entries have a relative target pointing to .oneagent/skills", () => {
    const entries = buildSkillSymlinks("/root", ["claude", "cursor"]);
    for (const e of entries) {
      expect(e.target.startsWith("/")).toBe(false);
      expect(e.target).toBe("../.oneagent/skills");
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

  test("all targets resolve to .oneagent/skills", () => {
    const entries = buildAgentsDirSymlinks("/root");
    for (const entry of entries) {
      expect(entry.target).toBe("../.oneagent/skills");
    }
  });
});

describe("migrateRuleAndSkillFiles — .agents/skills", () => {
  test("no-op when .agents/skills does not exist", async () => {
    const dir = await mkTempDir();
    await migrateRuleAndSkillFiles(dir);
  });

  test("no-op when .agents/skills is already a symlink", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".agents"), { recursive: true });
    await mkdir(join(dir, ".oneagent/skills"), { recursive: true });
    await symlink(join(dir, ".oneagent/skills"), join(dir, ".agents/skills"));
    await migrateRuleAndSkillFiles(dir);
    const stat = await lstat(join(dir, ".agents/skills"));
    expect(stat.isSymbolicLink()).toBe(true);
  });

  test("moves files from .agents/skills to .oneagent/skills and removes dir", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".agents/skills"), { recursive: true });
    await writeFile(join(dir, ".agents/skills/review.md"), "# Review");
    await migrateRuleAndSkillFiles(dir);
    const content = await Bun.file(join(dir, ".oneagent/skills/review.md")).text();
    expect(content).toBe("# Review");
    await expect(access(join(dir, ".agents/skills"))).rejects.toThrow();
  });

  test("dest wins on conflict — does not overwrite existing file in .oneagent/skills", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".agents/skills"), { recursive: true });
    await mkdir(join(dir, ".oneagent/skills"), { recursive: true });
    await writeFile(join(dir, ".agents/skills/review.md"), "from agents");
    await writeFile(join(dir, ".oneagent/skills/review.md"), "from oneagent");
    await migrateRuleAndSkillFiles(dir);
    const content = await Bun.file(join(dir, ".oneagent/skills/review.md")).text();
    expect(content).toBe("from oneagent");
    // entire .agents/skills dir is removed after migration
    await expect(access(join(dir, ".agents/skills"))).rejects.toThrow();
  });

  test(".agents/skills no longer exists as directory after migration", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".agents/skills"), { recursive: true });
    await writeFile(join(dir, ".agents/skills/skill.md"), "content");
    await migrateRuleAndSkillFiles(dir);
    let isDir = false;
    try {
      const stat = await lstat(join(dir, ".agents/skills"));
      isDir = stat.isDirectory();
    } catch {
      isDir = false;
    }
    expect(isDir).toBe(false);
  });
});

describe("migrateRuleAndSkillFiles", () => {
  test("no-op when agent dirs don't exist", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".oneagent/rules"), { recursive: true });
    await mkdir(join(dir, ".oneagent/skills"), { recursive: true });
    // should not throw
    await migrateRuleAndSkillFiles(dir);
  });

  test("moves .cursor/rules/ files to .oneagent/rules/", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".cursor/rules"), { recursive: true });
    await writeFile(join(dir, ".cursor/rules/style.md"), "# Style");
    await migrateRuleAndSkillFiles(dir);
    const content = await Bun.file(join(dir, ".oneagent/rules/style.md")).text();
    expect(content).toBe("# Style");
  });

  test("moves .claude/rules/ files to .oneagent/rules/", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".claude/rules"), { recursive: true });
    await writeFile(join(dir, ".claude/rules/typescript.md"), "# TypeScript");
    await migrateRuleAndSkillFiles(dir);
    const content = await Bun.file(join(dir, ".oneagent/rules/typescript.md")).text();
    expect(content).toBe("# TypeScript");
  });

  test("dest wins on conflict — .claude/rules does not overwrite file already migrated from .cursor/rules", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".cursor/rules"), { recursive: true });
    await mkdir(join(dir, ".claude/rules"), { recursive: true });
    await writeFile(join(dir, ".cursor/rules/style.md"), "from cursor");
    await writeFile(join(dir, ".claude/rules/style.md"), "from claude");
    await migrateRuleAndSkillFiles(dir);
    // cursor was migrated first, claude should be skipped
    const content = await Bun.file(join(dir, ".oneagent/rules/style.md")).text();
    expect(content).toBe("from cursor");
    // source file was deleted (not left in place)
    await expect(access(join(dir, ".claude/rules/style.md"))).rejects.toThrow();
  });

  test("dest wins with same content — source deleted, no backup created", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".cursor/rules"), { recursive: true });
    await mkdir(join(dir, ".oneagent/rules"), { recursive: true });
    await writeFile(join(dir, ".cursor/rules/style.md"), "shared content");
    await writeFile(join(dir, ".oneagent/rules/style.md"), "shared content");
    await migrateRuleAndSkillFiles(dir);
    // source deleted
    await expect(access(join(dir, ".cursor/rules/style.md"))).rejects.toThrow();
    // no backup created (identical content)
    await expect(access(join(dir, ".oneagent/backup"))).rejects.toThrow();
  });

  test("dest wins with different content — source backed up then deleted", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".cursor/rules"), { recursive: true });
    await mkdir(join(dir, ".oneagent/rules"), { recursive: true });
    await writeFile(join(dir, ".cursor/rules/style.md"), "cursor version");
    await writeFile(join(dir, ".oneagent/rules/style.md"), "oneagent version");
    await migrateRuleAndSkillFiles(dir);
    // source deleted
    await expect(access(join(dir, ".cursor/rules/style.md"))).rejects.toThrow();
    // backup created with source content
    const backup = await Bun.file(join(dir, ".oneagent/backup/.cursor_rules_style.md")).text();
    expect(backup).toBe("cursor version");
    // dest unchanged
    const dest = await Bun.file(join(dir, ".oneagent/rules/style.md")).text();
    expect(dest).toBe("oneagent version");
  });

  test("moves .windsurf/rules/ files to .oneagent/rules/", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".windsurf/rules"), { recursive: true });
    await writeFile(join(dir, ".windsurf/rules/python.md"), "# Python");
    await migrateRuleAndSkillFiles(dir);
    const content = await Bun.file(join(dir, ".oneagent/rules/python.md")).text();
    expect(content).toBe("# Python");
  });

  test("removes agent rules dir entirely (to make room for directory symlink)", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".cursor/rules"), { recursive: true });
    await mkdir(join(dir, ".oneagent/rules"), { recursive: true });
    // create a real file that the symlink points to
    await writeFile(join(dir, ".oneagent/rules/real.md"), "real content");
    // create symlink in .cursor/rules (simulating already-generated symlink)
    await symlink(join(dir, ".oneagent/rules/real.md"), join(dir, ".cursor/rules/real.md"));
    await migrateRuleAndSkillFiles(dir);
    // .oneagent/rules/real.md should still be the original file content
    const content = await Bun.file(join(dir, ".oneagent/rules/real.md")).text();
    expect(content).toBe("real content");
    // .cursor/rules directory should be removed (ready for directory symlink)
    await expect(access(join(dir, ".cursor/rules"))).rejects.toThrow();
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

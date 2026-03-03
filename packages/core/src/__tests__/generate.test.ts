import { test, expect, describe } from "bun:test";
import { mkdtemp, mkdir, lstat, writeFile, symlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { generate, detectGenerateCollisions } from "../generate.ts";
import { makeTargets } from "../config.ts";
import { buildCopilotContent, copilotFilePath } from "../copilot.ts";
import type { Config } from "../types.ts";

async function mkTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "dotai-test-"));
}

async function setupProject(dir: string): Promise<void> {
  await mkdir(join(dir, ".oneagent/rules"), { recursive: true });
  await Bun.write(join(dir, ".oneagent/instructions.md"), "# Instructions");
}

function makeConfig(...targets: Parameters<typeof makeTargets>[0][]): Config {
  return { version: 1, targets: makeTargets(...targets) };
}

describe("detectGenerateCollisions", () => {
  test("returns empty on first run — no files exist", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    const collisions = await detectGenerateCollisions(dir, makeConfig("claude"));
    expect(collisions).toEqual({ mainFiles: [], ruleSkillFiles: [] });
  });

  test("returns empty when symlinks already point to .oneagent/ (idempotent)", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    await generate(dir, makeConfig("claude"));
    const collisions = await detectGenerateCollisions(dir, makeConfig("claude"));
    expect(collisions).toEqual({ mainFiles: [], ruleSkillFiles: [] });
  });

  test("detects real CLAUDE.md in mainFiles for claude target", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    await Bun.write(join(dir, "CLAUDE.md"), "# Real instructions");
    const { mainFiles, ruleSkillFiles } = await detectGenerateCollisions(dir, makeConfig("claude"));
    expect(mainFiles.some((f) => f.relativePath === "CLAUDE.md")).toBe(true);
    expect(ruleSkillFiles.some((f) => f.relativePath === "CLAUDE.md")).toBe(false);
  });

  test("returns empty ruleSkillFiles when .cursor/rules is a real directory (migration handles it)", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    await mkdir(join(dir, ".cursor/rules"), { recursive: true });
    await writeFile(join(dir, ".cursor/rules/style.md"), "# Real cursor style");
    const { ruleSkillFiles } = await detectGenerateCollisions(dir, makeConfig("cursor"));
    // Directory collisions are handled by migrateRuleAndSkillFiles, not detectGenerateCollisions
    expect(ruleSkillFiles.some((f) => f.relativePath === ".cursor/rules")).toBe(false);
  });

  test("detects copilot rule file with different content in ruleSkillFiles", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    await writeFile(join(dir, ".oneagent/rules/style.md"), "# Style");
    await mkdir(join(dir, ".github/instructions"), { recursive: true });
    await writeFile(join(dir, ".github/instructions/style.instructions.md"), "# Different content");
    const { ruleSkillFiles } = await detectGenerateCollisions(dir, makeConfig("copilot"));
    expect(ruleSkillFiles.some((f) => f.relativePath === ".github/instructions/style.instructions.md")).toBe(true);
  });

  test("does NOT detect copilot rule file with matching content (idempotent)", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    await writeFile(join(dir, ".oneagent/rules/style.md"), "# Style");
    // Generate so the copilot file has the correct content
    await generate(dir, makeConfig("copilot"));
    const { ruleSkillFiles } = await detectGenerateCollisions(dir, makeConfig("copilot"));
    expect(ruleSkillFiles.some((f) => f.relativePath === ".github/instructions/style.instructions.md")).toBe(false);
  });
});

describe("generate", () => {
  test("creates CLAUDE.md symlink for claude target", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    await generate(dir, makeConfig("claude"));
    const stat = await lstat(join(dir, "CLAUDE.md"));
    expect(stat.isSymbolicLink()).toBe(true);
  });

  test("creates AGENTS.md symlink for cursor target", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    await generate(dir, makeConfig("cursor"));
    const stat = await lstat(join(dir, "AGENTS.md"));
    expect(stat.isSymbolicLink()).toBe(true);
  });

  test("creates .windsurfrules symlink for windsurf target", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    await generate(dir, makeConfig("windsurf"));
    const stat = await lstat(join(dir, ".windsurfrules"));
    expect(stat.isSymbolicLink()).toBe(true);
  });

  test("writes opencode.json for opencode target", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    await generate(dir, makeConfig("opencode"));
    expect(await Bun.file(join(dir, "opencode.json")).exists()).toBe(true);
  });

  test("generates copilot instruction files for copilot target", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".oneagent/rules"), { recursive: true });
    await Bun.write(join(dir, ".oneagent/instructions.md"), "# Instructions");
    await writeFile(join(dir, ".oneagent/rules/style.md"), "# Style");
    await generate(dir, makeConfig("copilot"));
    expect(
      await Bun.file(join(dir, ".github/instructions/style.instructions.md")).exists(),
    ).toBe(true);
  });

  test("creates .claude/rules directory symlink pointing to .oneagent/rules", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".oneagent/rules"), { recursive: true });
    await Bun.write(join(dir, ".oneagent/instructions.md"), "# Instructions");
    await writeFile(join(dir, ".oneagent/rules/style.md"), "# Style");
    await generate(dir, makeConfig("claude"));
    const stat = await lstat(join(dir, ".claude/rules"));
    expect(stat.isSymbolicLink()).toBe(true);
  });

  test("creates .agents/skills directory symlink pointing to .oneagent/skills", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    await mkdir(join(dir, ".oneagent/skills"), { recursive: true });
    await generate(dir, makeConfig("claude"));
    const stat = await lstat(join(dir, ".agents/skills"));
    expect(stat.isSymbolicLink()).toBe(true);
  });

  test("migrates real .agents/skills dir before creating symlink", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    await mkdir(join(dir, ".agents/skills"), { recursive: true });
    await writeFile(join(dir, ".agents/skills/review.md"), "# Review");
    await generate(dir, makeConfig("claude"));
    const content = await Bun.file(join(dir, ".oneagent/skills/review.md")).text();
    expect(content).toBe("# Review");
    const stat = await lstat(join(dir, ".agents/skills"));
    expect(stat.isSymbolicLink()).toBe(true);
  });

  test("is idempotent — running twice produces same result", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    const config = makeConfig("claude");
    await generate(dir, config);
    await generate(dir, config);
    const stat = await lstat(join(dir, "CLAUDE.md"));
    expect(stat.isSymbolicLink()).toBe(true);
  });
});

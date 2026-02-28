import { test, expect, describe } from "bun:test";
import { mkdtemp, mkdir, lstat, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { generate } from "../generate.ts";
import type { Config } from "../types.ts";

async function mkTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "dotai-test-"));
}

async function setupProject(dir: string): Promise<void> {
  await mkdir(join(dir, ".oneagent/rules"), { recursive: true });
  await Bun.write(join(dir, ".oneagent/instructions.md"), "# Instructions");
}

describe("generate", () => {
  test("creates CLAUDE.md symlink for claude target", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    const config: Config = { version: 1, targets: ["claude"] };
    await generate(dir, config);
    const stat = await lstat(join(dir, "CLAUDE.md"));
    expect(stat.isSymbolicLink()).toBe(true);
  });

  test("creates AGENTS.md symlink for cursor target", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    const config: Config = { version: 1, targets: ["cursor"] };
    await generate(dir, config);
    const stat = await lstat(join(dir, "AGENTS.md"));
    expect(stat.isSymbolicLink()).toBe(true);
  });

  test("creates .windsurfrules symlink for windsurf target", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    const config: Config = { version: 1, targets: ["windsurf"] };
    await generate(dir, config);
    const stat = await lstat(join(dir, ".windsurfrules"));
    expect(stat.isSymbolicLink()).toBe(true);
  });

  test("writes opencode.json for opencode target", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    const config: Config = { version: 1, targets: ["opencode"] };
    await generate(dir, config);
    expect(await Bun.file(join(dir, "opencode.json")).exists()).toBe(true);
  });

  test("generates copilot instruction files for copilot target", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".oneagent/rules"), { recursive: true });
    await Bun.write(join(dir, ".oneagent/instructions.md"), "# Instructions");
    await writeFile(join(dir, ".oneagent/rules/style.md"), "# Style");
    const config: Config = { version: 1, targets: ["copilot"] };
    await generate(dir, config);
    expect(
      await Bun.file(join(dir, ".github/instructions/style.instructions.md")).exists(),
    ).toBe(true);
  });

  test("creates rules symlinks for claude + rules", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".oneagent/rules"), { recursive: true });
    await Bun.write(join(dir, ".oneagent/instructions.md"), "# Instructions");
    await writeFile(join(dir, ".oneagent/rules/style.md"), "# Style");
    const config: Config = { version: 1, targets: ["claude"] };
    await generate(dir, config);
    const stat = await lstat(join(dir, ".claude/rules/style.md"));
    expect(stat.isSymbolicLink()).toBe(true);
  });

  test("is idempotent — running twice produces same result", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    const config: Config = { version: 1, targets: ["claude"] };
    await generate(dir, config);
    await generate(dir, config);
    const stat = await lstat(join(dir, "CLAUDE.md"));
    expect(stat.isSymbolicLink()).toBe(true);
  });
});

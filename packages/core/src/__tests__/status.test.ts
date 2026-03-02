import { test, expect, describe } from "bun:test";
import { mkdtemp, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { checkStatus } from "../status.ts";
import { generate } from "../generate.ts";
import { makeTargets } from "../config.ts";
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

describe("checkStatus", () => {
  test("all symlinks valid after generate", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    const config = makeConfig("claude");
    await generate(dir, config);
    const status = await checkStatus(dir, config);
    expect(status.symlinks.every((s) => s.valid)).toBe(true);
  });

  test("symlinks missing before generate", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    const config = makeConfig("claude");
    const status = await checkStatus(dir, config);
    expect(status.symlinks.some((s) => !s.exists)).toBe(true);
  });

  test("opencode check: valid after generate", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    const config = makeConfig("opencode");
    await generate(dir, config);
    const status = await checkStatus(dir, config);
    expect(status.opencode.exists).toBe(true);
    expect(status.opencode.valid).toBe(true);
  });

  test("opencode check: missing before generate", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    const config = makeConfig("opencode");
    const status = await checkStatus(dir, config);
    expect(status.opencode.exists).toBe(false);
  });

  test("generatedFiles empty when copilot not in targets", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    const config = makeConfig("claude");
    const status = await checkStatus(dir, config);
    expect(status.generatedFiles).toEqual([]);
  });
});

import { test, expect, describe } from "bun:test";
import { mkdtemp, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { configExists, readConfig, writeConfig, makeTargets, activeTargets } from "../config.ts";

async function mkTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "dotai-test-"));
}

describe("configExists", () => {
  test("returns false when config does not exist", async () => {
    const dir = await mkTempDir();
    expect(await configExists(dir)).toBe(false);
  });

  test("returns true after writeConfig", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".oneagent"), { recursive: true });
    await writeConfig(dir, { version: 1, targets: makeTargets("claude") });
    expect(await configExists(dir)).toBe(true);
  });
});

describe("writeConfig / readConfig", () => {
  test("round-trips config correctly", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".oneagent"), { recursive: true });
    const targets = makeTargets("claude", "cursor");
    await writeConfig(dir, { version: 1, targets });
    const read = await readConfig(dir);
    expect(read.version).toBe(1);
    expect(read.targets.claude).toBe(true);
    expect(read.targets.cursor).toBe(true);
    expect(read.targets.windsurf).toBe(false);
  });
});

describe("makeTargets", () => {
  test("sets enabled targets to true, rest to false", () => {
    const targets = makeTargets("claude", "copilot");
    expect(targets.claude).toBe(true);
    expect(targets.copilot).toBe(true);
    expect(targets.cursor).toBe(false);
    expect(targets.windsurf).toBe(false);
    expect(targets.opencode).toBe(false);
  });

  test("all false when no targets given", () => {
    const targets = makeTargets();
    expect(Object.values(targets).every((v) => v === false)).toBe(true);
  });
});

describe("activeTargets", () => {
  test("returns only enabled targets", () => {
    const config = { version: 1 as const, targets: makeTargets("claude", "windsurf") };
    expect(activeTargets(config)).toEqual(["claude", "windsurf"]);
  });

  test("returns empty array when all disabled", () => {
    const config = { version: 1 as const, targets: makeTargets() };
    expect(activeTargets(config)).toEqual([]);
  });
});

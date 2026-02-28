import { test, expect, describe } from "bun:test";
import { mkdtemp, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { configExists, readConfig, writeConfig } from "../config.ts";

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
    await mkdir(join(dir, ".ai"), { recursive: true });
    await writeConfig(dir, { version: 1, targets: ["claude"] });
    expect(await configExists(dir)).toBe(true);
  });
});

describe("writeConfig / readConfig", () => {
  test("round-trips config correctly", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".ai"), { recursive: true });
    await writeConfig(dir, { version: 1, targets: ["claude", "cursor"] });
    const read = await readConfig(dir);
    expect(read.version).toBe(1);
    expect(read.targets).toEqual(["claude", "cursor"]);
  });
});

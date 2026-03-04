import { test, expect, describe } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { readRules } from "../rules.ts";

async function mkTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "dotai-test-"));
}

describe("readRules", () => {
  test("returns empty array when rules dir does not exist", async () => {
    const dir = await mkTempDir();
    expect(await readRules(dir)).toEqual([]);
  });

  test("reads rule files and returns name and path", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".oneagent/rules"), { recursive: true });
    await writeFile(join(dir, ".oneagent/rules/typescript.md"), `---\napplyTo: "**/*.ts"\n---\n# TS`);

    const rules = await readRules(dir);
    expect(rules.length).toBe(1);
    expect(rules[0]!.name).toBe("typescript");
    expect(rules[0]!.path).toContain("typescript.md");
  });

  test("ignores non-.md files", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".oneagent/rules"), { recursive: true });
    await writeFile(join(dir, ".oneagent/rules/style.md"), "# Style");
    await writeFile(join(dir, ".oneagent/rules/ignore.txt"), "ignore");

    const rules = await readRules(dir);
    expect(rules.length).toBe(1);
    expect(rules[0]!.name).toBe("style");
  });

  test("returns rules sorted alphabetically", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".oneagent/rules"), { recursive: true });
    await writeFile(join(dir, ".oneagent/rules/zebra.md"), "# Z");
    await writeFile(join(dir, ".oneagent/rules/apple.md"), "# A");

    const rules = await readRules(dir);
    expect(rules.map((r) => r.name)).toEqual(["apple", "zebra"]);
  });
});

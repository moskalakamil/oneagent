import { test, expect, describe } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { parseFrontmatter, readRules } from "../rules.ts";

async function mkTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "dotai-test-"));
}

describe("parseFrontmatter", () => {
  test("returns default applyTo when no frontmatter present", () => {
    const result = parseFrontmatter("# Hello\n\nContent.");
    expect(result.applyTo).toBe("**");
    expect(result.content).toBe("# Hello\n\nContent.");
  });

  test("parses applyTo from frontmatter", () => {
    const raw = `---\napplyTo: "**/*.ts"\n---\n# TypeScript rules`;
    const result = parseFrontmatter(raw);
    expect(result.applyTo).toBe("**/*.ts");
    expect(result.content).toBe("# TypeScript rules");
  });

  test("defaults applyTo to ** when key is absent in frontmatter", () => {
    const raw = `---\nother: value\n---\n# Content`;
    const result = parseFrontmatter(raw);
    expect(result.applyTo).toBe("**");
  });

  test("handles applyTo without quotes", () => {
    const raw = `---\napplyTo: src/**/*.ts\n---\n# Content`;
    const result = parseFrontmatter(raw);
    expect(result.applyTo).toBe("src/**/*.ts");
  });
});

describe("readRules", () => {
  test("returns empty array when rules dir does not exist", async () => {
    const dir = await mkTempDir();
    expect(await readRules(dir)).toEqual([]);
  });

  test("reads and parses rule files", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".oneagent/rules"), { recursive: true });
    await writeFile(join(dir, ".oneagent/rules/typescript.md"), `---\napplyTo: "**/*.ts"\n---\n# TS`);

    const rules = await readRules(dir);
    expect(rules.length).toBe(1);
    expect(rules[0]!.name).toBe("typescript");
    expect(rules[0]!.applyTo).toBe("**/*.ts");
    expect(rules[0]!.content).toBe("# TS");
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

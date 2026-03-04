import { test, expect, describe } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { readCommands } from "../commands.ts";

async function mkTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "dotai-test-"));
}

describe("readCommands", () => {
  test("returns empty array when dir does not exist", async () => {
    const dir = await mkTempDir();
    expect(await readCommands(dir)).toEqual([]);
  });

  test("reads .md files and returns name and path", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".oneagent/commands"), { recursive: true });
    await writeFile(join(dir, ".oneagent/commands/deploy.md"), "# Deploy");

    const commands = await readCommands(dir);
    expect(commands.length).toBe(1);
    expect(commands[0]!.name).toBe("deploy");
    expect(commands[0]!.path).toContain("deploy.md");
  });

  test("ignores non-.md files", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".oneagent/commands"), { recursive: true });
    await writeFile(join(dir, ".oneagent/commands/deploy.md"), "# Deploy");
    await writeFile(join(dir, ".oneagent/commands/notes.txt"), "ignore");

    const commands = await readCommands(dir);
    expect(commands.length).toBe(1);
    expect(commands[0]!.name).toBe("deploy");
  });

  test("returns commands sorted alphabetically", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".oneagent/commands"), { recursive: true });
    await writeFile(join(dir, ".oneagent/commands/zebra.md"), "# Z");
    await writeFile(join(dir, ".oneagent/commands/apple.md"), "# A");

    const commands = await readCommands(dir);
    expect(commands.map((c) => c.name)).toEqual(["apple", "zebra"]);
  });
});

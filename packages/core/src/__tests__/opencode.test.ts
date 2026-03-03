import { test, expect, describe } from "bun:test";
import { mkdtemp, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { readOpencode, buildOpencodeConfig, writeOpencode, addOpenCodePlugin } from "../opencode.ts";

async function mkTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "dotai-test-"));
}

describe("readOpencode", () => {
  test("returns null when file does not exist", async () => {
    const dir = await mkTempDir();
    expect(await readOpencode(dir)).toBeNull();
  });

  test("reads and parses existing opencode.json", async () => {
    const dir = await mkTempDir();
    await Bun.write(join(dir, "opencode.json"), JSON.stringify({ model: "gpt-4" }));
    const result = await readOpencode(dir);
    expect(result).toEqual({ model: "gpt-4" });
  });
});

describe("buildOpencodeConfig", () => {
  test("sets instructions field when no existing config", () => {
    const config = buildOpencodeConfig(null) as Record<string, unknown>;
    expect(config["instructions"]).toBe(".oneagent/instructions.md");
  });

  test("merges with existing config preserving other keys", () => {
    const config = buildOpencodeConfig({ model: "gpt-4" }) as Record<string, unknown>;
    expect(config["model"]).toBe("gpt-4");
    expect(config["instructions"]).toBe(".oneagent/instructions.md");
  });
});

describe("addOpenCodePlugin", () => {
  test("adds plugin id to plugin array", async () => {
    const dir = await mkTempDir();
    await writeFile(join(dir, "opencode.json"), JSON.stringify({ instructions: ".oneagent/instructions.md" }));
    await addOpenCodePlugin(dir, "opencode-wakatime");
    const content = JSON.parse(await readFile(join(dir, "opencode.json"), "utf-8")) as Record<string, unknown>;
    expect(content["plugin"]).toContain("opencode-wakatime");
  });

  test("creates plugin array when not present", async () => {
    const dir = await mkTempDir();
    await writeFile(join(dir, "opencode.json"), JSON.stringify({}));
    await addOpenCodePlugin(dir, "opencode-wakatime");
    const content = JSON.parse(await readFile(join(dir, "opencode.json"), "utf-8")) as Record<string, unknown>;
    expect(content["plugin"]).toEqual(["opencode-wakatime"]);
  });

  test("does not duplicate plugin ids", async () => {
    const dir = await mkTempDir();
    await writeFile(join(dir, "opencode.json"), JSON.stringify({ plugin: ["opencode-wakatime"] }));
    await addOpenCodePlugin(dir, "opencode-wakatime");
    const content = JSON.parse(await readFile(join(dir, "opencode.json"), "utf-8")) as Record<string, unknown>;
    expect(content["plugin"]).toEqual(["opencode-wakatime"]);
  });

  test("no-op when opencode.json does not exist", async () => {
    const dir = await mkTempDir();
    await expect(addOpenCodePlugin(dir, "opencode-wakatime")).resolves.toBeUndefined();
  });
});

describe("writeOpencode", () => {
  test("writes opencode.json with instructions field", async () => {
    const dir = await mkTempDir();
    await writeOpencode(dir, []);
    const content = await Bun.file(join(dir, "opencode.json")).text();
    const parsed = JSON.parse(content) as Record<string, unknown>;
    expect(parsed["instructions"]).toBe(".oneagent/instructions.md");
  });

  test("preserves existing keys when merging", async () => {
    const dir = await mkTempDir();
    await Bun.write(join(dir, "opencode.json"), JSON.stringify({ theme: "dark" }));
    await writeOpencode(dir, []);
    const content = await Bun.file(join(dir, "opencode.json")).text();
    const parsed = JSON.parse(content) as Record<string, unknown>;
    expect(parsed["theme"]).toBe("dark");
    expect(parsed["instructions"]).toBe(".oneagent/instructions.md");
  });
});

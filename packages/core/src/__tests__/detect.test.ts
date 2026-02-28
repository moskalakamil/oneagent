import { test, expect, describe } from "bun:test";
import { mkdtemp, writeFile, mkdir, symlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { detectExistingFiles, filesHaveSameContent } from "../detect.ts";
import type { DetectedFile } from "../types.ts";

async function mkTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "dotai-test-"));
}

function makeFile(name: string, content: string): DetectedFile {
  return { relativePath: name, absolutePath: `/${name}`, sizeBytes: content.length, modifiedAt: new Date(), content };
}

describe("detectExistingFiles", () => {
  test("returns empty array when no known files exist", async () => {
    const dir = await mkTempDir();
    expect(await detectExistingFiles(dir)).toEqual([]);
  });

  test("returns files that exist", async () => {
    const dir = await mkTempDir();
    await writeFile(join(dir, "CLAUDE.md"), "# Hello");
    const files = await detectExistingFiles(dir);
    expect(files.length).toBe(1);
    expect(files[0]!.relativePath).toBe("CLAUDE.md");
    expect(files[0]!.content).toBe("# Hello");
  });

  test("returns multiple files", async () => {
    const dir = await mkTempDir();
    await writeFile(join(dir, "CLAUDE.md"), "# Claude");
    await writeFile(join(dir, "AGENTS.md"), "# Agents");
    const files = await detectExistingFiles(dir);
    expect(files.length).toBe(2);
  });

  test("ignores symlinks pointing into .oneagent/", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".oneagent"), { recursive: true });
    await Bun.write(join(dir, ".oneagent/instructions.md"), "# Instructions");
    await symlink(".oneagent/instructions.md", join(dir, "CLAUDE.md"));
    const files = await detectExistingFiles(dir);
    expect(files.length).toBe(0);
  });
});

describe("filesHaveSameContent", () => {
  test("returns true for empty array", () => {
    expect(filesHaveSameContent([])).toBe(true);
  });

  test("returns true for single file", () => {
    expect(filesHaveSameContent([makeFile("a.md", "hello")])).toBe(true);
  });

  test("returns true when all files have same content", () => {
    const files = [makeFile("a.md", "hello"), makeFile("b.md", "hello")];
    expect(filesHaveSameContent(files)).toBe(true);
  });

  test("returns false when files differ", () => {
    const files = [makeFile("a.md", "hello"), makeFile("b.md", "world")];
    expect(filesHaveSameContent(files)).toBe(false);
  });
});

import { test, expect, describe } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { parseSkillFrontmatter, readSkills } from "../skills.ts";

async function mkTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "dotai-test-"));
}

describe("parseSkillFrontmatter", () => {
  test("returns defaults when no frontmatter present", () => {
    const result = parseSkillFrontmatter("Do something useful.");
    expect(result.description).toBe("");
    expect(result.mode).toBe("agent");
    expect(result.content).toBe("Do something useful.");
  });

  test("parses description and mode from frontmatter", () => {
    const raw = `---\ndescription: Review code\nmode: ask\n---\nReview the code.`;
    const result = parseSkillFrontmatter(raw);
    expect(result.description).toBe("Review code");
    expect(result.mode).toBe("ask");
    expect(result.content).toBe("Review the code.");
  });

  test("defaults mode to agent when key absent", () => {
    const raw = `---\ndescription: Commit changes\n---\nCommit staged changes.`;
    const result = parseSkillFrontmatter(raw);
    expect(result.mode).toBe("agent");
  });

  test("defaults mode to agent for invalid value", () => {
    const raw = `---\nmode: invalid\n---\nContent.`;
    const result = parseSkillFrontmatter(raw);
    expect(result.mode).toBe("agent");
  });

  test("accepts all valid mode values", () => {
    for (const mode of ["ask", "edit", "agent"] as const) {
      const raw = `---\nmode: ${mode}\n---\nContent.`;
      expect(parseSkillFrontmatter(raw).mode).toBe(mode);
    }
  });
});

describe("readSkills", () => {
  test("returns empty array when skills dir does not exist", async () => {
    const dir = await mkTempDir();
    expect(await readSkills(dir)).toEqual([]);
  });

  test("reads and parses skill files", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".oneagent/skills"), { recursive: true });
    await writeFile(
      join(dir, ".oneagent/skills/review.md"),
      `---\ndescription: Review code\nmode: ask\n---\nReview the code.`,
    );

    const skills = await readSkills(dir);
    expect(skills.length).toBe(1);
    expect(skills[0]!.name).toBe("review");
    expect(skills[0]!.description).toBe("Review code");
    expect(skills[0]!.mode).toBe("ask");
    expect(skills[0]!.content).toBe("Review the code.");
  });

  test("returns skills sorted alphabetically", async () => {
    const dir = await mkTempDir();
    await mkdir(join(dir, ".oneagent/skills"), { recursive: true });
    await writeFile(join(dir, ".oneagent/skills/zebra.md"), "Z");
    await writeFile(join(dir, ".oneagent/skills/apple.md"), "A");

    const skills = await readSkills(dir);
    expect(skills.map((s) => s.name)).toEqual(["apple", "zebra"]);
  });
});


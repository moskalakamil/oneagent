import { test, expect, describe } from "bun:test";
import { mkdtemp, mkdir, lstat, readlink, readdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { generate } from "../generate.ts";
import { makeTargets, ALL_AGENT_TARGETS, activeTargets } from "../config.ts";
import { AGENT_DEFINITIONS } from "../agents.ts";
import type { AgentTarget, Config } from "../types.ts";

async function mkTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "dotai-test-"));
}

async function setupProject(dir: string): Promise<void> {
  await mkdir(join(dir, ".oneagent/rules"), { recursive: true });
  await mkdir(join(dir, ".oneagent/skills"), { recursive: true });
  await Bun.write(join(dir, ".oneagent/instructions.md"), "# Instructions");
}

function makeConfig(...targets: AgentTarget[]): Config {
  return { version: 1, targets: makeTargets(...targets) };
}

const codexDef = () => AGENT_DEFINITIONS.find((d) => d.target === "codex");

describe("codex registry", () => {
  test("codex is a known target in ALL_AGENT_TARGETS", () => {
    expect(ALL_AGENT_TARGETS).toContain("codex");
  });

  test("codex definition maps to AGENTS.md", () => {
    expect(codexDef()?.mainFile).toBe("AGENTS.md");
  });

  test("codex declares no rules/skills/commands directory (Codex has none)", () => {
    const def = codexDef();
    expect(def).toBeDefined();
    expect(def!.rulesDir).toBeUndefined();
    expect(def!.skillsDir).toBeUndefined();
    expect(def!.commandsDir).toBeUndefined();
  });

  test("codex is detected via a .codex indicator", () => {
    expect(codexDef()?.detectIndicators).toContain(".codex");
  });

  test("makeTargets and activeTargets round-trip codex", () => {
    expect(makeTargets("codex").codex).toBe(true);
    expect(activeTargets(makeConfig("codex"))).toContain("codex");
  });
});

describe("codex generate", () => {
  test("codex-only config creates AGENTS.md symlink to .oneagent/instructions.md", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    await generate(dir, makeConfig("codex"));
    const stat = await lstat(join(dir, "AGENTS.md"));
    expect(stat.isSymbolicLink()).toBe(true);
    expect(await readlink(join(dir, "AGENTS.md"))).toBe(".oneagent/instructions.md");
  });

  test("codex-only config still creates .agents/skills symlink to .oneagent/skills", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    const config = makeConfig("codex");
    expect(activeTargets(config)).toContain("codex"); // ties this test to codex being a real target
    await generate(dir, config);
    const stat = await lstat(join(dir, ".agents/skills"));
    expect(stat.isSymbolicLink()).toBe(true);
    expect(await readlink(join(dir, ".agents/skills"))).toBe("../.oneagent/skills");
  });

  test("codex + cursor share a single AGENTS.md symlink — no collision, no conflict copy", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    const config = makeConfig("codex", "cursor");
    expect(activeTargets(config)).toContain("codex"); // both codex and cursor must want AGENTS.md
    await generate(dir, config);
    const stat = await lstat(join(dir, "AGENTS.md"));
    expect(stat.isSymbolicLink()).toBe(true);
    expect(await readlink(join(dir, "AGENTS.md"))).toBe(".oneagent/instructions.md");
    const entries = await readdir(dir);
    expect(entries.filter((e) => e.startsWith("AGENTS.md"))).toEqual(["AGENTS.md"]);
  });

  test("codex generate is idempotent — second run keeps one valid AGENTS.md symlink", async () => {
    const dir = await mkTempDir();
    await setupProject(dir);
    const config = makeConfig("codex", "cursor");
    expect(activeTargets(config)).toContain("codex");
    await generate(dir, config);
    await generate(dir, config);
    const entries = await readdir(dir);
    expect(entries.filter((e) => e.startsWith("AGENTS.md"))).toEqual(["AGENTS.md"]);
    expect((await lstat(join(dir, "AGENTS.md"))).isSymbolicLink()).toBe(true);
  });
});

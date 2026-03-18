#!/usr/bin/env bun
import { $ } from "bun";
import { join } from "path";
import { intro, select, outro, cancel, isCancel, log } from "@clack/prompts";

const ROOT = new URL("..", import.meta.url).pathname;
const CORE_DIR = join(ROOT, "packages/core");
const TEMPLATES_DIR = join(ROOT, "packages/templates");
const CLI_DIR = join(ROOT, "packages/cli");

const CORE_PKG = join(CORE_DIR, "package.json");
const TEMPLATES_PKG = join(TEMPLATES_DIR, "package.json");
const CLI_PKG = join(CLI_DIR, "package.json");
const PKG_PATHS = [CORE_PKG, TEMPLATES_PKG, CLI_PKG];

function bumpVersion(version: string, type: "patch" | "minor" | "major") {
  const [major, minor, patch] = version.split(".").map(Number);
  if (type === "patch") return `${major}.${minor}.${patch + 1}`;
  if (type === "minor") return `${major}.${minor + 1}.0`;
  return `${major + 1}.0.0`;
}

const corePkg = await Bun.file(CORE_PKG).json();
const current: string = corePkg.version;

intro(`oneagent release  (current: v${current})`);

const choice = await select({
  message: "Bump type",
  options: [
    { value: "patch", label: "patch", hint: `${current} → ${bumpVersion(current, "patch")}` },
    { value: "minor", label: "minor", hint: `${current} → ${bumpVersion(current, "minor")}` },
    { value: "major", label: "major", hint: `${current} → ${bumpVersion(current, "major")}` },
  ],
}) as "patch" | "minor" | "major" | symbol;

if (isCancel(choice)) {
  cancel("Release cancelled.");
  process.exit(0);
}

const newVersion = bumpVersion(current, choice);

const originals = await Promise.all(PKG_PATHS.map((p) => Bun.file(p).text()));

async function rollback() {
  await Promise.all(originals.map((content, i) => Bun.write(PKG_PATHS[i], content)));
  log.error(`Rolled back all package.json files to v${current}.`);
}

for (const pkgPath of PKG_PATHS) {
  const json = await Bun.file(pkgPath).json();
  json.version = newVersion;
  await Bun.write(pkgPath, JSON.stringify(json, null, 2) + "\n");
}

async function publish(pkgPath: string, cwd: string) {
  const original = await Bun.file(pkgPath).text();
  const pkg = JSON.parse(original);
  const deps = pkg.dependencies as Record<string, string> | undefined;
  if (deps) {
    pkg.dependencies = Object.fromEntries(
      Object.entries(deps).map(([k, v]) => [k, v.startsWith("workspace:") ? newVersion : v]),
    );
  }
  await Bun.write(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  try {
    const proc = Bun.spawn(["bun", "publish", "--access", "public"], {
      cwd,
      stdio: ["inherit", "inherit", "inherit"],
    });
    if (await proc.exited !== 0) throw new Error("bun publish failed");
  } finally {
    await Bun.write(pkgPath, original);
  }
}

try {
  console.log("Building packages...");
  await $`bun run --filter='*' build`.cwd(ROOT);

  console.log("\nPublishing @moskala/oneagent-core...");
  await publish(CORE_PKG, CORE_DIR);

  console.log("\nPublishing @moskala/oneagent-templates...");
  await publish(TEMPLATES_PKG, TEMPLATES_DIR);

  console.log("\nPublishing oneagent CLI...");
  await publish(CLI_PKG, CLI_DIR);
} catch (err) {
  await rollback();
  process.exit(1);
}

outro(`Published v${newVersion}!`);

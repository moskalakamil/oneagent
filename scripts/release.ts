#!/usr/bin/env bun
import { $ } from "bun";
import { join } from "path";
import { intro, select, outro, cancel, isCancel, log } from "@clack/prompts";

const ROOT = new URL("..", import.meta.url).pathname;
const CORE_DIR = join(ROOT, "packages/core");
const TEMPLATES_DIR = join(ROOT, "packages/templates");
const CLI_DIR = join(ROOT, "packages/cli");

const PKG_PATHS = [
  join(CORE_DIR, "package.json"),
  join(TEMPLATES_DIR, "package.json"),
  join(CLI_DIR, "package.json"),
];

function bumpVersion(version: string, type: "patch" | "minor" | "major") {
  const [major, minor, patch] = version.split(".").map(Number);
  if (type === "patch") return `${major}.${minor}.${patch + 1}`;
  if (type === "minor") return `${major}.${minor + 1}.0`;
  return `${major + 1}.0.0`;
}

const corePkg = await Bun.file(PKG_PATHS[0]).json();
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
console.log("");

// Save originals before any modifications
const originals = await Promise.all(PKG_PATHS.map((p) => Bun.file(p).text()));

async function rollback() {
  await Promise.all(originals.map((content, i) => Bun.write(PKG_PATHS[i], content)));
  log.error(`Rolled back all package.json files to v${current}.`);
}

// Update version in all package.json files
for (const pkgPath of PKG_PATHS) {
  const raw = await Bun.file(pkgPath).text();
  const json = JSON.parse(raw);
  json.version = newVersion;
  await Bun.write(pkgPath, JSON.stringify(json, null, 2) + "\n");
}

try {
  // --- Build ---
  console.log("Building packages...");
  await $`bun run build`.cwd(CLI_DIR);

  // --- Publish core ---
  console.log("\nPublishing @moskala/oneagent-core...");
  await $`bun publish --access public`.cwd(CORE_DIR);

  // --- Publish templates ---
  console.log("\nPublishing @moskala/oneagent-templates...");
  await $`bun publish --access public`.cwd(TEMPLATES_DIR);

  // --- Publish CLI (patch package.json to point to dist) ---
  const cliPkgPath = PKG_PATHS[2];
  const bumpedCliPkg = await Bun.file(cliPkgPath).text();
  const cliPkg = JSON.parse(bumpedCliPkg);

  const publishPkg = {
    ...cliPkg,
    bin: { oneagent: "./dist/index.js" },
    files: ["dist"],
    dependencies: Object.fromEntries(
      Object.entries(cliPkg.dependencies ?? {}).filter(
        ([, v]) => !(v as string).startsWith("workspace:")
      )
    ),
  };

  await Bun.write(cliPkgPath, JSON.stringify(publishPkg, null, 2) + "\n");

  try {
    console.log("\nPublishing oneagent CLI...");
    await $`bun publish --access public`.cwd(CLI_DIR);
  } finally {
    // Always restore the bumped (not original) cli package.json after publish patch
    await Bun.write(cliPkgPath, bumpedCliPkg);
  }
} catch (err) {
  await rollback();
  process.exit(1);
}

outro(`Published v${newVersion}!`);

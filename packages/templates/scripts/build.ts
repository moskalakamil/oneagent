#!/usr/bin/env bun
import { join } from "path";
import { $ } from "bun";

const DIR = join(import.meta.dir, "..");

await Bun.build({
  entrypoints: [join(DIR, "src/index.ts")],
  outdir: join(DIR, "dist"),
  target: "node",
  format: "esm",
  naming: "index.js",
  external: ["@moskala/oneagent-core"],
});

// Generate .d.ts so TypeScript consumers resolve types from dist/
await $`tsc --project ${join(DIR, "tsconfig.build.json")}`.quiet();

// Copy template data files (yml, md, rules/) — not bundled by Bun.build
await $`rm -rf ${join(DIR, "dist/templates")}`.quiet();
await $`cp -r ${join(DIR, "src/templates")} ${join(DIR, "dist/templates")}`.quiet();

console.log("Templates built → dist/index.js + dist/templates/");

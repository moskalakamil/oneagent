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
  external: ["yaml"],
});

// Generate .d.ts so TypeScript consumers resolve types from dist/
await $`tsc --project ${join(DIR, "tsconfig.build.json")}`.quiet();

console.log("Core built → dist/index.js");

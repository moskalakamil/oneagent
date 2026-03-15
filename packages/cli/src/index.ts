#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "oneagent",
    description: "One source of truth for AI agent rules",
  },
  subCommands: {
    init: () => import("./commands/init.ts").then((r) => r.default),
    generate: () => import("./commands/generate.ts").then((r) => r.default),
    status: () => import("./commands/status.ts").then((r) => r.default),
    targets: () => import("./commands/targets.ts").then((r) => r.default),
    add: () => import("./commands/add.ts").then((r) => r.default),
    remove: () => import("./commands/remove.ts").then((r) => r.default),
  },
});

runMain(main);

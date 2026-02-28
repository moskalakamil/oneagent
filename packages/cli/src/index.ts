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
  },
});

runMain(main);

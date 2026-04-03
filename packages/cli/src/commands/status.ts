import { defineCommand } from "citty";
import { readConfig, checkStatus, activeTargets, ONEAGENT_DIR } from "@moskala/oneagent-core";

export default defineCommand({
  meta: {
    name: "status",
    description: "Check status of symlinks and generated files",
  },
  async run() {
    const root = process.cwd();

    let config;
    try {
      config = await readConfig(root);
    } catch {
      console.error(`Error: No ${ONEAGENT_DIR}/config.yml found. Run \`oneagent init\` first.`);
      process.exit(1);
    }

    const status = await checkStatus(root, config);

    console.log("\nSymlinks:");
    for (const s of status.symlinks) {
      const icon = !s.exists ? "✗" : s.valid ? "✓" : "⚠";
      const text = !s.exists ? "missing" : s.valid ? "valid" : "broken (wrong target)";
      console.log(`  ${icon} ${s.label} — ${text}`);
    }

    if (activeTargets(config).includes("opencode")) {
      const { opencode } = status;
      const icon = !opencode.exists ? "✗" : opencode.valid ? "✓" : "⚠";
      const text = !opencode.exists ? "missing" : opencode.valid ? "valid" : "invalid";
      console.log(`\nOpenCode:\n  ${icon} opencode.json — ${text}`);
    }

    console.log();
  },
});

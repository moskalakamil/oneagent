import { defineCommand } from "citty";
import { readConfig, checkStatus } from "@moskala/oneagent-core";

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
      console.error("Error: No .oneagent/config.yml found. Run `oneagent init` first.");
      process.exit(1);
    }

    const status = await checkStatus(root, config);

    console.log("\nSymlinks:");
    for (const s of status.symlinks) {
      const icon = !s.exists ? "✗" : s.valid ? "✓" : "⚠";
      const text = !s.exists ? "missing" : s.valid ? "valid" : "broken (wrong target)";
      console.log(`  ${icon} ${s.label} — ${text}`);
    }

    if (status.generatedFiles.length > 0) {
      console.log("\nGenerated files (Copilot):");
      for (const f of status.generatedFiles) {
        const icon = !f.exists ? "✗" : f.upToDate ? "✓" : "⚠";
        const text = !f.exists ? "missing" : f.upToDate ? "up to date" : "outdated";
        console.log(`  ${icon} ${f.path} — ${text}`);
      }
    }

    if (config.targets.includes("opencode")) {
      const { opencode } = status;
      const icon = !opencode.exists ? "✗" : opencode.valid ? "✓" : "⚠";
      const text = !opencode.exists ? "missing" : opencode.valid ? "valid" : "invalid";
      console.log(`\nOpenCode:\n  ${icon} opencode.json — ${text}`);
    }

    console.log();
  },
});

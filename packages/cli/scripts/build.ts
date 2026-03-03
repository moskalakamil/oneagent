#!/usr/bin/env bun
import { join } from "path";

const DIR = join(import.meta.dir, "..");
const DIST = join(DIR, "dist/index.js");

await Bun.build({
  entrypoints: [join(DIR, "src/index.ts")],
  outdir: join(DIR, "dist"),
  target: "node",
  naming: "index.js",
});

// Strip any existing shebang from bundle, then prepend the correct one
const content = await Bun.file(DIST).text();
const stripped = content.startsWith("#!") ? content.slice(content.indexOf("\n") + 1) : content;
await Bun.write(DIST, "#!/usr/bin/env node\n" + stripped);

console.log("CLI built → dist/index.js");

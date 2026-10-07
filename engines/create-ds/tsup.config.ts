import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/types-entry.ts"],
  format: ["esm"],
  target: "node20",
  banner: { js: "#!/usr/bin/env node" },
  clean: true,
  minify: false,
});

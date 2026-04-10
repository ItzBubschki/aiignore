import { defineConfig } from "tsup";

export default defineConfig([
  // CLI entry point (external deps resolved at runtime from node_modules)
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    target: "node20",
    clean: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
  // Hook bundle — single file with all deps inlined, ready for bun build --compile
  {
    entry: { "hook-bundle": "src/hook/index.ts" },
    format: ["esm"],
    target: "node20",
    noExternal: [/.*/],
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
  // Version check hook — runs once at session start, not compiled to binary
  {
    entry: { "version-check": "src/hook/version-check.ts" },
    format: ["esm"],
    target: "node20",
    noExternal: [/.*/],
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);

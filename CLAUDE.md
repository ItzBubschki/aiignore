# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

`@aiignore/cli` — a CLI tool that enforces `.aiignore` files (gitignore syntax) to block Claude Code from reading/writing sensitive files. It works by compiling a native binary hook (via `bun build --compile`) that runs as a Claude Code PreToolUse hook on every Read/Write/Edit/MultiEdit operation.

## Commands

```bash
bun install          # install dependencies
bun run build        # build with tsup (outputs to dist/)
bun run dev          # build in watch mode
bun test             # run all tests
bun test test/hook/hook.test.ts  # run a single test file
```

## Architecture

**Two entry points**, both configured in `tsup.config.ts`:

1. **CLI** (`src/cli.ts` → `dist/cli.js`) — Commander-based CLI with subcommands in `src/commands/`. External deps resolved at runtime. This is the `aiignore` binary users invoke.

2. **Hook** (`src/hook/index.ts` → `dist/hook-bundle.js`) — The PreToolUse hook that actually enforces blocking. Built as a **self-contained bundle** with all deps inlined (`noExternal: [/.*/]`), because `aiignore install` compiles it into a native binary via `bun build --compile`. The hook reads JSON from stdin, checks file paths against `.aiignore` patterns, and exits with code 2 to block or 0 to allow. It is fail-open: any error results in exit 0.

**Shared libraries** in `src/lib/`:
- `constants.ts` — paths and names (hook binary, settings file, audit log)
- `aiignore-parser.ts` — loads and evaluates `.aiignore` files using the `ignore` npm package
- `claude-settings.ts` — reads/writes Claude Code's `~/.claude/settings.json` to register/remove the hook
- `completions.ts` — shell completion installation

## Adding a New Command

Every new command requires all of the following:
1. Implementation in `src/commands/` and registered in `src/cli.ts`
2. Tests in `test/` (mirror the `src/` structure, e.g. `test/commands/foo.test.ts`)
3. Shell completions updated in `src/lib/completions.ts`
4. All tests passing (`bun test`) before considering the work done
5. README.md updated with documentation for the new command

Tests must always live under the root `test/` directory, matching the source structure.

## Key Design Decisions
- The hook bundle in `src/hook/index.ts` duplicates some logic from the shared libs (e.g., path constants, ignore loading) because it must be fully self-contained — it cannot import from `src/lib/` at runtime since it gets compiled to a standalone binary.
- Global `~/.aiignore` patterns are checked against both home-relative and cwd-relative paths.
- Tests use `bun:test` and run the hook as a subprocess with `execSync`, using temp dirs with a fake `HOME` to isolate from the real filesystem.

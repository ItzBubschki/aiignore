# @aiignore/cli

Protect sensitive files from AI coding assistants using `.aiignore` files.

Drop a `.aiignore` in your project root — just like `.gitignore` — and AI tools will be blocked from reading matched files. One command to set up, zero per-project configuration.

## Quick Start

```bash
# Install the hook (one-time setup, requires bun)
npx @aiignore/cli install

# Create a .aiignore in any project
echo ".env" >> .aiignore
echo "secrets/" >> .aiignore

# Done. Claude Code will now respect your .aiignore.
```

## `.aiignore` Syntax

`.aiignore` uses the same syntax as `.gitignore`:

```gitignore
# Block environment files
.env
.env.*

# Block entire directories
secrets/
private/

# Block by extension
*.key
*.pem

# Negation (allow specific files)
!.env.example
```

## Commands

### `aiignore install`

One-time global setup. Compiles a fast native hook binary and registers it with Claude Code's PreToolUse hooks. Requires [Bun](https://bun.sh) to compile.

### `aiignore uninstall`

Removes the hook from Claude Code settings and deletes the hook binary. Does not delete your `.aiignore` files.

### `aiignore status`

Shows whether the hook is installed and working — checks the settings entry, the hook binary, and whether a `.aiignore` exists in the current directory.

### `aiignore check`

Dry-run that scans the current directory and reports which files would be blocked by `.aiignore`.

## How It Works

1. `aiignore install` compiles a native binary (via `bun build --compile`) and installs it as a Claude Code [PreToolUse hook](https://docs.anthropic.com/en/docs/claude-code/hooks)
2. On every file access (Read, Write, Edit), the hook checks for a `.aiignore` in the current working directory
3. If the accessed file matches a pattern, the hook blocks the operation with a clear message
4. If no `.aiignore` exists, everything is allowed (fail-open)

## Limitations

- **Direct file reads only.** Blocking file access doesn't prevent AI tools from seeing file names, directory structures, or error messages that may reveal context.
- **Root-level `.aiignore` only.** Subdirectory `.aiignore` files are not supported yet.
- **Claude Code only.** Other AI tools are not supported yet.
- **Not a security boundary.** This is a guardrail, not a sandbox. It prevents accidental access, not determined circumvention.

## Requirements

- [Bun](https://bun.sh) (for compiling the hook binary)
- Claude Code

## License

MIT

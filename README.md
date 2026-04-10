# @aiignore/cli

Protect sensitive files from AI coding assistants using `.aiignore` files.

Drop a `.aiignore` in your project root -- just like `.gitignore` -- and Claude Code will be blocked from reading, writing, or editing matched files. Supports both global and per-project ignore files.

## Quick Start

```bash
# One-time setup (compiles a native hook binary via bun)
npx @aiignore/cli install

# Create a local .aiignore in any project
echo ".env" >> .aiignore
echo "secrets/" >> .aiignore

# Or set global rules that apply everywhere
aiignore add --global "*.pem"

# Done. Claude Code will now respect your .aiignore.
```

For permanent CLI access:

```bash
npm install -g @aiignore/cli
```

## Features

- **Global `~/.aiignore`** -- patterns that apply across all projects
- **Local `.aiignore`** -- per-project patterns using gitignore syntax
- **Blocks Read, Write, Edit, and MultiEdit** operations
- **Audit logging** -- blocked attempts are logged to `~/.claude/aiignore-audit.log`
- **Shell completions** -- installed automatically with `aiignore install`

## `.aiignore` Syntax

Uses the same syntax as `.gitignore`:

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

One-time setup. Compiles a fast native hook binary (via `bun build --compile`) and registers it as a Claude Code PreToolUse hook. Also installs shell completions. Requires [Bun](https://bun.sh).

- `--local` -- install the hook config in the project-level `.claude/settings.json` instead of the global `~/.claude/settings.json`. The binary is still installed globally.

### `aiignore uninstall`

Removes the hook from Claude Code settings and deletes the hook binary. Does not delete your `.aiignore` files.

- `--local` -- remove the hook config from the project-level `.claude/settings.json` only (keeps the global binary).

### `aiignore status`

Shows whether the hook is installed and working -- checks the settings entry, the hook binary, shell completions, and whether global/local `.aiignore` files exist.

### `aiignore check`

Dry-run that scans the current directory and reports which files would be blocked. Shows whether each match comes from the global or local `.aiignore`.

### `aiignore suggest`

Auto-detects sensitive files in the current directory (`.env`, keys, credentials, etc.) and suggests adding them to `.aiignore`.

### `aiignore add <paths...>`

Adds patterns to `.aiignore`. Defaults to local if a `.aiignore` exists in the current directory, otherwise adds to the global `~/.aiignore`.

- `--local` -- force writing to the local `.aiignore`
- `--global` -- force writing to the global `~/.aiignore`

### `aiignore list`

Shows all patterns currently configured across both the global `~/.aiignore` and local `.aiignore`.

### `aiignore audit`

Shows recent blocked access attempts from the audit log.

- `--lines <n>` -- number of log entries to show
- `--clear` -- clear the audit log

## How It Works

1. `aiignore install` compiles a native binary (via `bun build --compile`) and installs it as a Claude Code [PreToolUse hook](https://docs.anthropic.com/en/docs/claude-code/hooks)
2. On every file operation (Read, Write, Edit, MultiEdit), the hook checks for `.aiignore` patterns
3. Both global (`~/.aiignore`) and local (`.aiignore` in cwd) patterns are evaluated
4. If the accessed file matches a pattern, the hook blocks the operation and logs the attempt
5. If no `.aiignore` exists, everything is allowed (fail-open)

## Limitations

- **Direct file operations only.** Blocking file access doesn't prevent AI tools from seeing file names, directory structures, or error messages that may reveal context.
- **Root-level `.aiignore` only.** Subdirectory `.aiignore` files are not supported yet.
- **Claude Code only.** Other AI tools are not supported yet.
- **Not a security boundary.** This is a guardrail, not a sandbox. It prevents accidental access, not determined circumvention.

## Requirements

- [Bun](https://bun.sh) (for compiling the hook binary)
- Claude Code

## License

MIT

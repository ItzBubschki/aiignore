# TODOS

## MVP Scope

- [x] `npx @aiignore/cli install` — one-time global setup that installs a Claude Code PreToolUse hook
- [x] Auto-discovery of `.aiignore` in current working directory on every file access
- [x] Block files matching patterns with clear denial message

## Additional Features

- [x] `ai-guard add <path>` — add files/directories to `.aiignore` (convenience wrapper)
- [ ] `ai-guard list` — show what's currently blocked (globally and per-project)
- [x] `ai-guard status` — show whether the hook is installed and working
- [x] `ai-guard check` — dry-run that reports which files would be blocked
- [x] `ai-guard suggest` — auto-detect common sensitive files (.env, credentials, private keys) and suggest adding them to `.aiignore`
- [x] **Global blocklist** — a `~/.aiignore` that applies everywhere
- [x] **Write blocking** — block writes/edits to protected files too, not just reads
- [ ] **Audit log** — log when Claude attempts to access a blocked file

## Next Steps (from brainstorm)

- [x] Set up TypeScript CLI project structure with commander.js
- [x] Implement `install` command that installs a PreToolUse hook into Claude Code's global settings
- [x] Implement `.aiignore` parser (using `ignore` npm package)
- [x] Build the hook script that checks file paths against `.aiignore` patterns
- [x] Write a README with clear install/usage instructions
- [ ] Test with real Claude Code sessions

## Distribution

- [x] Publish to npm as `@aiignore/cli`
- [ ] Cross-compile hook binary for all platforms (plan in `plans/cross-compilation-setup.md`)
- [ ] Remove bun requirement for end users (ship pre-compiled binaries)

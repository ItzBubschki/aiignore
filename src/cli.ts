import { createRequire } from "node:module";
import { Command } from "commander";
import { install } from "./commands/install.js";
import { uninstall } from "./commands/uninstall.js";
import { status } from "./commands/status.js";
import { check } from "./commands/check.js";
import { suggest } from "./commands/suggest.js";
import { add } from "./commands/add.js";
import { list } from "./commands/list.js";
import { audit } from "./commands/audit.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

const program = new Command()
  .name("aiignore")
  .description("Protect sensitive files from AI coding assistants")
  .version(version, "-v, --version");

program
  .command("install")
  .description("Install the Claude Code hook for .aiignore enforcement")
  .option("--local", "install hook config in local .claude/settings.json (project-level)")
  .action(install);

program
  .command("uninstall")
  .description("Remove the Claude Code hook")
  .option("--local", "remove hook config from local .claude/settings.json (project-level)")
  .action(uninstall);

program
  .command("status")
  .description("Show whether the hook is installed and working")
  .action(status);

program
  .command("check")
  .description("Dry-run: show which files would be blocked by .aiignore")
  .action(check);

program
  .command("suggest")
  .description("Auto-detect sensitive files and suggest adding them to .aiignore")
  .action(suggest);

program
  .command("add")
  .description(
    "Add patterns to .aiignore (quote globs to prevent shell expansion, e.g. '*.key')"
  )
  .argument("<paths...>", "patterns to block (quote wildcards: '*.env', '*.key')")
  .option("--local", "force add to local .aiignore (in current directory)")
  .option("--global", "force add to global ~/.aiignore")
  .action(add);

program
  .command("list")
  .description("Show patterns currently blocked (globally and per-project)")
  .action(list);

program
  .command("audit")
  .description("Show recent blocked access attempts")
  .option("--lines <n>", "number of entries to show", "20")
  .option("--clear", "clear the audit log")
  .action(audit);

program.parse();

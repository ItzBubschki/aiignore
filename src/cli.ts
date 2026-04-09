import { createRequire } from "node:module";
import { Command } from "commander";
import { install } from "./commands/install.js";
import { uninstall } from "./commands/uninstall.js";
import { status } from "./commands/status.js";
import { check } from "./commands/check.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

const program = new Command()
  .name("aiignore")
  .description("Protect sensitive files from AI coding assistants")
  .version(version, "-v, --version");

program
  .command("install")
  .description("Install the Claude Code hook for .aiignore enforcement")
  .action(install);

program
  .command("uninstall")
  .description("Remove the Claude Code hook")
  .action(uninstall);

program
  .command("status")
  .description("Show whether the hook is installed and working")
  .action(status);

program
  .command("check")
  .description("Dry-run: show which files would be blocked by .aiignore")
  .action(check);

program.parse();

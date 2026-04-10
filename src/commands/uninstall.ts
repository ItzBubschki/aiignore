import fs from "node:fs";
import chalk from "chalk";
import {
  HOOK_INSTALL_PATH,
  HOOK_SCRIPT_INSTALL_PATH,
  VERSION_CHECK_INSTALL_PATH,
} from "../lib/constants.js";
import {
  readSettings,
  writeSettings,
  isHookInstalled,
  removeHook,
  removeVersionCheckHook,
} from "../lib/claude-settings.js";
import { uninstallCompletions } from "../lib/completions.js";

export async function uninstall(): Promise<void> {
  const settings = readSettings();

  if (!isHookInstalled(settings)) {
    console.log(chalk.yellow("AI Guard hook is not installed."));
    return;
  }

  // Remove hooks from settings
  let updated = removeHook(settings);
  updated = removeVersionCheckHook(updated);
  writeSettings(updated);

  // Delete the hook binary/scripts
  for (const hookPath of [HOOK_INSTALL_PATH, HOOK_SCRIPT_INSTALL_PATH, VERSION_CHECK_INSTALL_PATH]) {
    try {
      fs.unlinkSync(hookPath);
    } catch {
      // File may already be gone
    }
  }

  // Remove shell completions
  uninstallCompletions();

  console.log(chalk.green("AI Guard hook has been uninstalled from ~/.claude/settings.json."));
  console.log(
    chalk.dim(
      "Your .aiignore files have been kept — delete them manually if needed."
    )
  );
}

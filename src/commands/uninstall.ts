import fs from "node:fs";
import chalk from "chalk";
import { HOOK_INSTALL_PATH, HOOK_SCRIPT_INSTALL_PATH, VERSION_CHECK_INSTALL_PATH } from "../lib/constants.js";
import {
  readSettings,
  writeSettings,
  isHookInstalled,
  removeHook,
  removeVersionCheckHook,
  getSettingsPath,
} from "../lib/claude-settings.js";
import { uninstallCompletions } from "../lib/completions.js";

export async function uninstall(options: { local?: boolean }): Promise<void> {
  const local = options.local ?? false;
  const settingsPath = getSettingsPath(local);
  const settings = readSettings(settingsPath);

  if (!isHookInstalled(settings)) {
    console.log(chalk.yellow("AI Guard hook is not installed."));
    return;
  }

  // Remove hooks from settings
  let updated = removeHook(settings);
  updated = removeVersionCheckHook(updated);
  writeSettings(updated, settingsPath);

  // Only delete the hook binary/scripts when uninstalling from global settings
  if (!local) {
    for (const hookPath of [HOOK_INSTALL_PATH, HOOK_SCRIPT_INSTALL_PATH, VERSION_CHECK_INSTALL_PATH]) {
      try {
        fs.unlinkSync(hookPath);
      } catch {
        // File may already be gone
      }
    }
  }

  // Remove shell completions
  uninstallCompletions();

  const target = local ? "local .claude/settings.json" : "~/.claude/settings.json";
  console.log(chalk.green(`AI Guard hook has been uninstalled from ${target}.`));
  console.log(
    chalk.dim(
      "Your .aiignore files have been kept — delete them manually if needed."
    )
  );
}

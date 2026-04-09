import fs from "node:fs";
import chalk from "chalk";
import { HOOK_INSTALL_PATH } from "../lib/constants.js";
import {
  readSettings,
  writeSettings,
  isHookInstalled,
  removeHook,
} from "../lib/claude-settings.js";
import { uninstallCompletions } from "../lib/completions.js";

export async function uninstall(): Promise<void> {
  const settings = readSettings();

  if (!isHookInstalled(settings)) {
    console.log(chalk.yellow("AI Guard hook is not installed."));
    return;
  }

  // Remove hook from settings
  const updated = removeHook(settings);
  writeSettings(updated);

  // Delete the hook binary
  try {
    fs.unlinkSync(HOOK_INSTALL_PATH);
  } catch {
    // Binary may already be gone
  }

  // Remove shell completions
  uninstallCompletions();

  console.log(chalk.green("AI Guard hook has been uninstalled."));
  console.log(
    chalk.dim(
      "Your .aiignore files have been kept — delete them manually if needed."
    )
  );
}

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { HOOKS_DIR, HOOK_INSTALL_PATH } from "../lib/constants.js";
import {
  readSettings,
  writeSettings,
  isHookInstalled,
  addHook,
} from "../lib/claude-settings.js";
import { installCompletions } from "../lib/completions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findHookSource(): string {
  // 1. Pre-bundled hook (exists in dist/ after build, used by npx/npm)
  const bundlePath = path.resolve(__dirname, "hook-bundle.js");
  if (fs.existsSync(bundlePath)) {
    return bundlePath;
  }

  // 2. Raw source file (for local dev via `bun src/cli.ts`)
  const sourcePath = path.resolve(__dirname, "../hook/index.ts");
  if (fs.existsSync(sourcePath)) {
    return sourcePath;
  }

  throw new Error(
    "Could not find hook source. Run 'bun run build' first, or run from the project root."
  );
}

function bunAvailable(): boolean {
  try {
    execSync("bun --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export async function install(): Promise<void> {
  // Check if already installed
  const settings = readSettings();
  if (isHookInstalled(settings)) {
    console.log(chalk.yellow("AI Guard hook is already installed."));
    return;
  }

  // Check for bun
  if (!bunAvailable()) {
    console.error(
      chalk.red("Bun is required to compile the hook binary.\n") +
        "Install it: https://bun.sh"
    );
    process.exit(1);
  }

  // Ensure hooks directory exists
  fs.mkdirSync(HOOKS_DIR, { recursive: true });

  // Find the pre-bundled hook source (all deps inlined, no node_modules needed)
  const hookSource = findHookSource();
  console.log(chalk.dim("Compiling hook binary..."));

  try {
    execSync(
      `bun build --compile "${hookSource}" --outfile "${HOOK_INSTALL_PATH}"`,
      { stdio: "pipe" }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error(chalk.red(`Failed to compile hook binary: ${message}`));
    process.exit(1);
  }

  // Add hook to Claude Code settings
  const updated = addHook(settings);
  writeSettings(updated);

  // Install shell completions
  const completionResult = installCompletions();
  if (completionResult) {
    console.log(
      chalk.green(`Shell completions installed for ${completionResult.shell}:`)
    );
    console.log(chalk.dim(`  ${completionResult.path}`));
  } else {
    console.log(
      chalk.dim("Could not detect shell — skipping completion install.")
    );
  }

  console.log(chalk.green("\nAI Guard installed successfully!\n"));
  console.log("Create a .aiignore file in any project to protect sensitive files:\n");
  console.log(chalk.dim('  echo ".env" >> .aiignore'));
  console.log(chalk.dim('  echo "secrets/" >> .aiignore'));
  console.log(
    "\nThe hook will automatically enforce .aiignore on every Claude Code session."
  );
}

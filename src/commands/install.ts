import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { HOOKS_DIR, HOOK_INSTALL_PATH, HOOK_SCRIPT_INSTALL_PATH, VERSION_CHECK_INSTALL_PATH } from "../lib/constants.js";
import {
  readSettings,
  writeSettings,
  isHookInstalled,
  addHook,
  addVersionCheckHook,
  getSettingsPath,
} from "../lib/claude-settings.js";
import { installCompletions } from "../lib/completions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const require = createRequire(import.meta.url);
const { version: packageVersion } = require("../../package.json");

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

function findVersionCheckSource(): string | null {
  // 1. Pre-bundled (exists in dist/ after build)
  const bundlePath = path.resolve(__dirname, "version-check.js");
  if (fs.existsSync(bundlePath)) {
    return bundlePath;
  }

  // 2. Raw source file (for local dev)
  const sourcePath = path.resolve(__dirname, "../hook/version-check.ts");
  if (fs.existsSync(sourcePath)) {
    return sourcePath;
  }

  return null;
}

function bunAvailable(): boolean {
  try {
    execSync("bun --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function installCompiledHook(hookSource: string): boolean {
  console.log(chalk.dim("Compiling hook binary..."));
  try {
    execSync(
      `bun build --compile "${hookSource}" --outfile "${HOOK_INSTALL_PATH}"`,
      { stdio: "pipe" }
    );
    return true;
  } catch {
    return false;
  }
}

function installScriptHook(hookSource: string): string {
  fs.copyFileSync(hookSource, HOOK_SCRIPT_INSTALL_PATH);
  return `node "${HOOK_SCRIPT_INSTALL_PATH}"`;
}

export async function install(options: { local?: boolean }): Promise<void> {
  const local = options.local ?? false;
  const settingsPath = getSettingsPath(local);

  // Check if already installed
  const settings = readSettings(settingsPath);
  if (isHookInstalled(settings)) {
    console.log(chalk.yellow("AI Guard hook is already installed."));
    return;
  }

  // Ensure hooks directory exists (binary always goes global)
  fs.mkdirSync(HOOKS_DIR, { recursive: true });

  // Find the pre-bundled hook source (all deps inlined, no node_modules needed)
  const hookSource = findHookSource();

  let hookCommand: string | undefined;

  if (bunAvailable()) {
    if (installCompiledHook(hookSource)) {
      hookCommand = undefined; // uses default (binary path)
    }
  }

  // Fallback: install as a Node.js script if Bun isn't available or compilation failed
  if (!hookCommand && !fs.existsSync(HOOK_INSTALL_PATH)) {
    hookCommand = installScriptHook(hookSource);

    console.log("");
    console.log(chalk.yellow.bold("⚠  Bun not found — installing hook as a Node.js script instead."));
    console.log("");
    console.log(chalk.yellow("   The hook will work, but each Claude Code tool call will be ~50ms"));
    console.log(chalk.yellow("   instead of ~5ms. This may make Claude Code feel slightly slower."));
    console.log("");
    console.log(chalk.yellow("   To fix this, install Bun and re-install:"));
    console.log(chalk.dim("     curl -fsSL https://bun.sh/install | bash"));
    console.log(chalk.dim("     aiignore uninstall && aiignore install"));
    console.log("");
  }

  // Install version check script (always goes to global hooks dir)
  const versionCheckSource = findVersionCheckSource();
  if (versionCheckSource) {
    fs.copyFileSync(versionCheckSource, VERSION_CHECK_INSTALL_PATH);
  }

  // Add hooks to Claude Code settings (with version)
  let updated = addHook(settings, hookCommand, packageVersion);
  if (versionCheckSource) {
    updated = addVersionCheckHook(updated);
  }
  writeSettings(updated, settingsPath);

  // Install shell completions
  const completionResult = installCompletions();
  if (completionResult) {
    console.log(
      chalk.green(`Shell completions installed for ${completionResult.shell}:`)
    );
    console.log(chalk.dim(`  ${completionResult.path}`));
    if (completionResult.sourceCommand) {
      console.log(
        chalk.dim(`  Run to enable in this session: ${completionResult.sourceCommand}`)
      );
    }
  } else {
    console.log(
      chalk.dim("Could not detect shell — skipping completion install.")
    );
  }

  const target = local ? "local .claude/settings.json" : "~/.claude/settings.json";
  console.log(chalk.green(`\nAI Guard v${packageVersion} installed successfully! (${target})\n`));
  console.log("Create a .aiignore file in any project to protect sensitive files:\n");
  console.log(chalk.dim('  echo ".env" >> .aiignore'));
  console.log(chalk.dim('  echo "secrets/" >> .aiignore'));
  console.log(
    "\nThe hook will automatically enforce .aiignore on every Claude Code session."
  );
}

import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { readSettings, isHookInstalled } from "../lib/claude-settings.js";
import { HOOK_INSTALL_PATH, AIIGNORE_FILENAME } from "../lib/constants.js";

function countPatterns(filePath: string): number {
  const content = fs.readFileSync(filePath, "utf-8");
  return content
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith("#");
    }).length;
}

export async function status(): Promise<void> {
  const settings = readSettings();
  const hookRegistered = isHookInstalled(settings);
  const hookBinaryExists = fs.existsSync(HOOK_INSTALL_PATH);
  const aiignorePath = path.join(process.cwd(), AIIGNORE_FILENAME);
  const aiignoreExists = fs.existsSync(aiignorePath);

  console.log("\nAI Guard Status:\n");

  // Hook registered
  if (hookRegistered) {
    console.log(
      `  Hook registered:  ${chalk.green("✓")} (in ~/.claude/settings.json)`
    );
  } else {
    console.log(
      `  Hook registered:  ${chalk.red("✗")} Not found in settings`
    );
  }

  // Hook binary
  if (hookBinaryExists) {
    console.log(
      `  Hook binary:      ${chalk.green("✓")} (${HOOK_INSTALL_PATH})`
    );
  } else {
    console.log(`  Hook binary:      ${chalk.red("✗")} Not found`);
  }

  // .aiignore
  if (aiignoreExists) {
    const patterns = countPatterns(aiignorePath);
    console.log(
      `  .aiignore (cwd):  ${chalk.green("✓")} (${patterns} pattern${patterns === 1 ? "" : "s"})`
    );
  } else {
    console.log(
      `  .aiignore (cwd):  ${chalk.dim("-")} No .aiignore in current directory`
    );
  }

  console.log();

  if (hookRegistered && hookBinaryExists) {
    console.log(chalk.green("Everything is working."));
  } else {
    console.log(
      chalk.yellow("Run 'aiignore install' to set up the hook.")
    );
  }

  console.log();
}

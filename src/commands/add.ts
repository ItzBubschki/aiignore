import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { AIIGNORE_FILENAME, GLOBAL_AIIGNORE_PATH } from "../lib/constants.js";

function getLocalAiignorePath(): string {
  return path.join(process.cwd(), AIIGNORE_FILENAME);
}

function localAiignoreExists(): boolean {
  return fs.existsSync(getLocalAiignorePath());
}

function appendPatterns(filePath: string, patterns: string[]): void {
  const existing = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf-8")
    : "";

  const existingLines = new Set(
    existing.split("\n").map((l) => l.trim()).filter(Boolean)
  );

  const newPatterns = patterns.filter((p) => !existingLines.has(p));

  if (newPatterns.length === 0) {
    console.log(chalk.yellow("All patterns are already in the file."));
    return;
  }

  const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  fs.appendFileSync(filePath, separator + newPatterns.join("\n") + "\n");

  const target = filePath === GLOBAL_AIIGNORE_PATH ? "~/.aiignore (global)" : ".aiignore";
  console.log(chalk.green(`Added to ${target}:`));
  for (const pattern of newPatterns) {
    console.log(chalk.dim(`  ${pattern}`));
  }
}

export async function add(
  paths: string[],
  options: { local?: boolean; global?: boolean }
): Promise<void> {
  if (options.local && options.global) {
    console.error(chalk.red("Cannot use both --local and --global."));
    process.exit(1);
  }

  let targetFile: string;

  if (options.global) {
    targetFile = GLOBAL_AIIGNORE_PATH;
  } else if (options.local) {
    targetFile = getLocalAiignorePath();
  } else {
    // Default: local if .aiignore exists, otherwise global
    targetFile = localAiignoreExists()
      ? getLocalAiignorePath()
      : GLOBAL_AIIGNORE_PATH;
  }

  appendPatterns(targetFile, paths);
}

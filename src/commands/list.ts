import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { AIIGNORE_FILENAME, GLOBAL_AIIGNORE_PATH } from "../lib/constants.js";

function readPatterns(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
  } catch {
    return [];
  }
}

export async function list(): Promise<void> {
  const localPath = path.join(process.cwd(), AIIGNORE_FILENAME);
  const globalPatterns = readPatterns(GLOBAL_AIIGNORE_PATH);
  const localPatterns = readPatterns(localPath);

  if (globalPatterns.length === 0 && localPatterns.length === 0) {
    console.log("No patterns configured.");
    console.log(
      chalk.dim("Run 'aiignore add <path>' or create a .aiignore file.")
    );
    return;
  }

  if (globalPatterns.length > 0) {
    console.log(chalk.bold(`Global (~/.aiignore) — ${globalPatterns.length} pattern${globalPatterns.length === 1 ? "" : "s"}:\n`));
    for (const pattern of globalPatterns) {
      console.log(chalk.yellow(`  ${pattern}`));
    }
    console.log();
  }

  if (localPatterns.length > 0) {
    console.log(chalk.bold(`Local (.aiignore) — ${localPatterns.length} pattern${localPatterns.length === 1 ? "" : "s"}:\n`));
    for (const pattern of localPatterns) {
      console.log(chalk.cyan(`  ${pattern}`));
    }
    console.log();
  }
}

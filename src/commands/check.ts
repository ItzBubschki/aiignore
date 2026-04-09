import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { loadAiignore, isBlocked } from "../lib/aiignore-parser.js";
import { AIIGNORE_FILENAME } from "../lib/constants.js";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist"]);

function walkFiles(cwd: string): string[] {
  const entries = fs.readdirSync(cwd, { recursive: true, withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    // Skip files inside directories we want to exclude
    const relativePath =
      entry.parentPath !== undefined
        ? path.relative(cwd, path.join(entry.parentPath, entry.name))
        : entry.name;

    const parts = relativePath.split(path.sep);
    if (parts.some((part) => SKIP_DIRS.has(part))) {
      continue;
    }

    if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files.sort();
}

export async function check(): Promise<void> {
  const cwd = process.cwd();
  const ig = loadAiignore(cwd);

  if (ig === null) {
    console.log(
      `No ${AIIGNORE_FILENAME} file found in the current directory.`
    );
    console.log("Create one to protect sensitive files from AI tools.");
    return;
  }

  const allFiles = walkFiles(cwd);
  const blockedFiles = allFiles.filter((file) => isBlocked(ig, file, cwd));

  if (blockedFiles.length === 0) {
    console.log(`No files matched by ${AIIGNORE_FILENAME} patterns.`);
    return;
  }

  console.log(
    chalk.bold(`Files blocked by ${AIIGNORE_FILENAME}:\n`)
  );

  for (const file of blockedFiles) {
    console.log(chalk.red(`  ${file}`));
  }

  console.log(
    `\n${chalk.bold(String(blockedFiles.length))} files blocked (out of ${allFiles.length} total)`
  );
}

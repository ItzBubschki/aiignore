import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import {
  loadAiignore,
  loadGlobalAiignore,
  isBlocked,
} from "../lib/aiignore-parser.js";
import { AIIGNORE_FILENAME } from "../lib/constants.js";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist"]);

function walkFiles(dir: string, cwd: string, files: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(cwd, fullPath);

    if (entry.isDirectory()) {
      walkFiles(fullPath, cwd, files);
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

export async function check(): Promise<void> {
  const cwd = process.cwd();
  const localIg = loadAiignore(cwd);
  const globalIg = loadGlobalAiignore();

  if (localIg === null && globalIg === null) {
    console.log(
      `No ${AIIGNORE_FILENAME} file found in the current directory or globally (~/.aiignore).`
    );
    console.log("Create one to protect sensitive files from AI tools.");
    return;
  }

  const allFiles = walkFiles(cwd, cwd).sort();

  const blockedLocal: string[] = [];
  const blockedGlobal: string[] = [];

  for (const file of allFiles) {
    const globallyBlocked = globalIg ? isBlocked(globalIg, file, cwd) : false;
    const locallyBlocked = localIg ? isBlocked(localIg, file, cwd) : false;

    if (globallyBlocked) {
      blockedGlobal.push(file);
    } else if (locallyBlocked) {
      blockedLocal.push(file);
    }
  }

  const totalBlocked = blockedLocal.length + blockedGlobal.length;

  if (totalBlocked === 0) {
    console.log(`No files matched by ${AIIGNORE_FILENAME} patterns.`);
    return;
  }

  console.log(chalk.bold(`Files blocked by ${AIIGNORE_FILENAME}:\n`));

  // Find the longest filename for alignment
  const allBlocked = [
    ...blockedGlobal.map((f) => ({ file: f, source: "global" as const })),
    ...blockedLocal.map((f) => ({ file: f, source: "local" as const })),
  ].sort((a, b) => a.file.localeCompare(b.file));

  const maxLen = Math.max(...allBlocked.map((b) => b.file.length));

  for (const { file, source } of allBlocked) {
    const padding = " ".repeat(maxLen - file.length + 4);
    const sourceLabel =
      source === "global"
        ? chalk.yellow(`(${source})`)
        : chalk.dim(`(${source})`);
    console.log(chalk.red(`  ${file}`) + padding + sourceLabel);
  }

  console.log(
    `\n${chalk.bold(String(totalBlocked))} files blocked (out of ${allFiles.length} total)`
  );
}

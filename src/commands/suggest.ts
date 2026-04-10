import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { loadAiignoreChain, isBlockedByChain } from "../lib/aiignore-parser.js";
import { AIIGNORE_FILENAME } from "../lib/constants.js";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist"]);

/**
 * Sensitive file patterns.
 * Each pattern is tested against the basename (or full relative path where noted).
 */
const SENSITIVE_PATTERNS: ((basename: string, relativePath: string) => boolean)[] = [
  // .env and .env.* but NOT .env.example
  (basename) => basename === ".env" || (/^\.env\..+$/.test(basename) && basename !== ".env.example"),

  // Private key / certificate files
  (basename) => /\.(key|pem|p12|pfx|jks)$/i.test(basename),

  // Secret files
  (basename) => /\.(secret|secrets)$/i.test(basename),

  // credentials.json
  (basename) => basename === "credentials.json",

  // service-account*.json
  (basename) => /^service-account.*\.json$/i.test(basename),

  // SSH keys
  (basename) => ["id_rsa", "id_ed25519", "id_ecdsa"].includes(basename),

  // Package registry tokens
  (basename) => basename === ".npmrc" || basename === ".pypirc",

  // Keystore files
  (basename) => /\.keystore$/i.test(basename),

  // docker-compose override
  (basename) => basename === "docker-compose.override.yml",

  // htpasswd
  (basename) => basename === ".htpasswd",

  // WordPress config
  (basename) => basename === "wp-config.php",
];

function isSensitive(relativePath: string): boolean {
  const basename = path.basename(relativePath);
  return SENSITIVE_PATTERNS.some((check) => check(basename, relativePath));
}

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

/**
 * Detect sensitive files in the given directory (recursively).
 * Returns a sorted list of relative paths.
 */
export function detectSensitiveFiles(cwd: string): string[] {
  const allFiles = walkFiles(cwd, cwd);
  return allFiles.filter((file) => isSensitive(file)).sort();
}

/**
 * Filter out files that are already covered by the local .aiignore.
 * Returns the subset of files that are NOT yet blocked.
 */
export function filterAlreadyBlocked(files: string[], cwd: string): string[] {
  const chain = loadAiignoreChain(cwd);
  if (chain.length === 0) {
    return files;
  }
  return files.filter((file) => isBlockedByChain(chain, file, cwd) === null);
}

export async function suggest(): Promise<void> {
  const cwd = process.cwd();
  const detected = detectSensitiveFiles(cwd);

  if (detected.length === 0) {
    console.log("No sensitive files detected in this project.");
    return;
  }

  const unblocked = filterAlreadyBlocked(detected, cwd);

  if (unblocked.length === 0) {
    console.log("All detected sensitive files are already covered by .aiignore.");
    return;
  }

  console.log(chalk.bold("Detected sensitive files:\n"));

  for (const file of unblocked) {
    console.log(`  ${file}`);
  }

  console.log(
    `\nAdd these to ${AIIGNORE_FILENAME}? Run:\n  aiignore add ${unblocked.join(" ")}`
  );
  console.log(chalk.dim("\nAfter adding, you can:"));
  console.log(chalk.dim("  aiignore list    — view all configured patterns"));
  console.log(chalk.dim("  aiignore check   — verify which files are blocked"));
  console.log(chalk.dim("  aiignore audit   — monitor blocked access attempts"));
}

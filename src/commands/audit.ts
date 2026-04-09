import fs from "node:fs";
import chalk from "chalk";
import { AUDIT_LOG_PATH } from "../lib/constants.js";

export interface AuditEntry {
  timestamp: string;
  source: string;
  cwd: string;
  file: string;
}

export function parseAuditLog(
  content: string
): Array<AuditEntry> {
  if (!content.trim()) {
    return [];
  }

  const lines = content.split("\n").filter((line) => line.trim().length > 0);
  const entries: AuditEntry[] = [];

  for (const line of lines) {
    const match = line.match(
      /^\[(.+?)\]\s+BLOCKED\s+(global|local)\s+(\S+)\s+(.+)$/
    );
    if (match) {
      entries.push({
        timestamp: match[1],
        source: match[2],
        cwd: match[3],
        file: match[4],
      });
    }
  }

  return entries;
}

export async function audit(options: {
  lines?: string;
  clear?: boolean;
}): Promise<void> {
  if (options.clear) {
    try {
      fs.writeFileSync(AUDIT_LOG_PATH, "");
      console.log(chalk.green("Audit log cleared."));
    } catch {
      console.log(chalk.yellow("No audit log to clear."));
    }
    return;
  }

  let content: string;
  try {
    content = fs.readFileSync(AUDIT_LOG_PATH, "utf-8");
  } catch {
    console.log("No blocked access attempts logged.");
    return;
  }

  const entries = parseAuditLog(content);

  if (entries.length === 0) {
    console.log("No blocked access attempts logged.");
    return;
  }

  const limit = parseInt(options.lines ?? "20", 10);
  const shown = entries.slice(-limit);

  console.log(chalk.bold("\nRecent blocked access attempts:\n"));

  // Compute column widths for alignment
  const maxCwdLen = Math.max(...shown.map((e) => e.cwd.length));

  for (const entry of shown) {
    const date = entry.timestamp.replace("T", " ").replace(/\.\d+Z$/, "");
    const source =
      entry.source === "global"
        ? chalk.red(entry.source.padEnd(8))
        : chalk.yellow(entry.source.padEnd(8));
    const cwd = chalk.dim(entry.cwd.padEnd(maxCwdLen));
    const file = chalk.white(entry.file);
    console.log(`  ${chalk.cyan(date)}  ${source}${cwd}  ${file}`);
  }

  console.log(
    `\n${entries.length} ${entries.length === 1 ? "entry" : "entries"} (showing last ${limit})\n`
  );
}

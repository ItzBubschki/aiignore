import fs from "node:fs";
import path from "node:path";
import ignore, { type Ignore } from "ignore";
import { AIIGNORE_FILENAME } from "./constants.js";

export function loadAiignore(cwd: string): Ignore | null {
  const filePath = path.join(cwd, AIIGNORE_FILENAME);

  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  return ignore().add(content);
}

export function isBlocked(
  ig: Ignore,
  filePath: string,
  cwd: string
): boolean {
  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(cwd, filePath);

  const relative = path.relative(cwd, absolute);

  // Files outside the project directory are not subject to .aiignore
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return false;
  }

  return ig.ignores(relative);
}

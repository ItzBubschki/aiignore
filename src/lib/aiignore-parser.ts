import fs from "node:fs";
import path from "node:path";
import ignore, { type Ignore } from "ignore";
import { AIIGNORE_FILENAME, GLOBAL_AIIGNORE_PATH } from "./constants.js";

export interface AiignoreEntry {
  ig: Ignore;
  basePath: string;
}

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

/**
 * Walk from `cwd` up to the filesystem root, collecting all .aiignore files.
 * Returns entries ordered from closest (cwd) to farthest (root).
 */
export function loadAiignoreChain(cwd: string): AiignoreEntry[] {
  const chain: AiignoreEntry[] = [];
  let dir = path.resolve(cwd);

  while (true) {
    const filePath = path.join(dir, AIIGNORE_FILENAME);
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      chain.push({ ig: ignore().add(content), basePath: dir });
    } catch {
      // No .aiignore at this level — continue walking up
    }

    const parent = path.dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  return chain;
}

export function loadGlobalAiignore(): Ignore | null {
  let content: string;
  try {
    content = fs.readFileSync(GLOBAL_AIIGNORE_PATH, "utf-8");
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

/**
 * Check if a file is blocked by any .aiignore in the chain.
 * Each entry's patterns are evaluated relative to that entry's basePath.
 * Returns the basePath of the .aiignore that blocked it, or null if allowed.
 */
export function isBlockedByChain(
  chain: AiignoreEntry[],
  filePath: string,
  cwd: string
): string | null {
  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(cwd, filePath);

  for (const { ig, basePath } of chain) {
    const relative = path.relative(basePath, absolute);

    // Skip if the file is outside this .aiignore's directory tree
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      continue;
    }

    if (ig.ignores(relative)) {
      return basePath;
    }
  }

  return null;
}

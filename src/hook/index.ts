import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import ignore from "ignore";

const AIIGNORE_FILENAME = ".aiignore";
const GLOBAL_AIIGNORE_PATH = path.join(os.homedir(), AIIGNORE_FILENAME);
const AUDIT_LOG_PATH = path.join(os.homedir(), ".claude", "aiignore-audit.log");

function logBlocked(source: "global" | "local", cwd: string, filePath: string): void {
  try {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] BLOCKED ${source} ${cwd} ${filePath}\n`;
    fs.appendFileSync(AUDIT_LOG_PATH, line);
  } catch {
    // Fire-and-forget: never break the hook
  }
}

async function main(): Promise<void> {
  // Read JSON from stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const input = JSON.parse(Buffer.concat(chunks).toString("utf-8"));

  // Extract file path from tool input
  const toolInput = input.tool_input ?? {};
  const filePath: string | undefined =
    toolInput.file_path ?? toolInput.path ?? undefined;

  if (!filePath) {
    process.exit(0);
  }

  // Resolve to absolute path
  const cwd = process.cwd();
  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(cwd, filePath);

  // Check global ~/.aiignore first
  try {
    const globalContent = fs.readFileSync(GLOBAL_AIIGNORE_PATH, "utf-8");
    const globalIg = ignore().add(globalContent);
    // For global blocklist, compute relative path from home dir
    const relativeToHome = path.relative(os.homedir(), absolute);
    if (
      relativeToHome &&
      !relativeToHome.startsWith("..") &&
      !path.isAbsolute(relativeToHome) &&
      globalIg.ignores(relativeToHome)
    ) {
      logBlocked("global", cwd, filePath);
      process.stderr.write(
        `BLOCKED by ~/.aiignore (global): Access to '${filePath}' is denied.\n` +
          `This file matches a pattern in ~/.aiignore. Remove the pattern to allow access.\n`
      );
      process.exit(2);
    }
    // Also check with relative path from cwd for patterns that are project-relative
    const relativeToCwd = path.relative(cwd, absolute);
    if (
      relativeToCwd &&
      !relativeToCwd.startsWith("..") &&
      !path.isAbsolute(relativeToCwd) &&
      globalIg.ignores(relativeToCwd)
    ) {
      logBlocked("global", cwd, filePath);
      process.stderr.write(
        `BLOCKED by ~/.aiignore (global): Access to '${filePath}' is denied.\n` +
          `This file matches a pattern in ~/.aiignore. Remove the pattern to allow access.\n`
      );
      process.exit(2);
    }
  } catch {
    // No global .aiignore — continue
  }

  // Walk up from cwd to filesystem root, checking each .aiignore
  let dir = path.resolve(cwd);

  while (true) {
    const aiignorePath = path.join(dir, AIIGNORE_FILENAME);
    try {
      const content = fs.readFileSync(aiignorePath, "utf-8");
      const ig = ignore().add(content);

      const relative = path.relative(dir, absolute);

      // Only check if the file is within this .aiignore's directory tree
      if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
        if (ig.ignores(relative)) {
          logBlocked("local", cwd, filePath);
          const displayPath = dir === cwd
            ? AIIGNORE_FILENAME
            : path.join(path.relative(cwd, dir), AIIGNORE_FILENAME);
          process.stderr.write(
            `BLOCKED by ${displayPath}: Access to '${filePath}' is denied.\n` +
              `This file matches a pattern in ${displayPath}. Remove the pattern to allow access.\n`
          );
          process.exit(2);
        }
      }
    } catch {
      // No .aiignore at this level — continue walking up
    }

    const parent = path.dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  process.exit(0);
}

main().catch(() => {
  // Fail-open: if anything goes wrong, allow the operation
  process.exit(0);
});
